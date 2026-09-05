import crypto from 'node:crypto';
import { db, isPg } from './db';
import { User } from './auth';
import { getStoreSettings } from './settings';
import { nextSequence } from './sequences';
import { allocateDiscounts, calculateAndAllocateTax } from './money';
import { createInvoiceForOrder, InvoiceBuyer, InvoiceLineItem } from './invoicing';
import { checkRateLimit } from './rate-limit';

export interface CheckoutInput {
  addressId: string;
  shippingMethod: 'pickup' | 'standard' | 'express';
  paymentMethod: 'sim_card' | 'manual_eft' | 'pay_on_delivery';
  simCardOutcome?: 'success' | 'declined' | 'pending';
  customerNote?: string;
  ip?: string;
  idempotencyKey?: string;
}

export interface CheckoutResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
}

export async function executeCheckout(user: User, input: CheckoutInput): Promise<CheckoutResult> {
  const validShipping = ['pickup', 'standard', 'express'] as const;
  const validPayment = ['sim_card', 'manual_eft', 'pay_on_delivery'] as const;
  const validOutcome = ['success', 'declined', 'pending'] as const;
  if (!validShipping.includes(input.shippingMethod as any)) {
    return { success: false, error: 'Invalid shipping method selected.' };
  }
  if (!validPayment.includes(input.paymentMethod as any)) {
    return { success: false, error: 'Invalid payment method selected.' };
  }
  if (input.simCardOutcome && !validOutcome.includes(input.simCardOutcome as any)) {
    return { success: false, error: 'Invalid payment outcome.' };
  }
  const idempotencyKey = (input.idempotencyKey || '').trim().slice(0, 64) || null;

  // Idempotency: if this browser tab already placed an order (double-click / retry),
  // return the existing order instead of creating a duplicate.
  if (idempotencyKey) {
    try {
      const existing = await db.prepare(`
        SELECT id, order_number FROM orders WHERE idempotency_key = ? AND user_id = ?
      `).get(idempotencyKey, user.id) as any;
      if (existing) {
        return { success: true, orderId: existing.id, orderNumber: existing.order_number };
      }
    } catch {
      // Column may not exist on DBs that haven't run 002 yet — continue; self-heal later.
    }
  }

  const rateLimitKey = `checkout:${user.id}`;
  const rateCheck = await checkRateLimit(rateLimitKey, 10, 15 * 60 * 1000);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Too many checkout attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
    };
  }

  const exec = async () => {
    const cart = await db.prepare(`
      SELECT * FROM carts WHERE user_id = ? AND status = 'active'
    `).get(user.id) as any;

    if (!cart) {
      return { success: false, error: 'No active cart found' };
    }

    const cartItems = await db.prepare(`
      SELECT 
        ci.id as cart_item_id,
        ci.variant_id,
        ci.qty,
        pv.id,
        pv.sku,
        pv.name as variant_name,
        pv.price_cents,
        pv.stock_qty,
        pv.weight_g,
        pv.active as variant_active,
        p.id as product_id,
        p.name as product_name,
        p.active as product_active
      FROM cart_items ci
      JOIN product_variants pv ON ci.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      WHERE ci.cart_id = ?
    `).all(cart.id) as any[];

    if (!cartItems || cartItems.length === 0) {
      return { success: false, error: 'Your cart is empty' };
    }

    let subtotalCents = 0;
    let totalWeightG = 0;

    for (const item of cartItems) {
      if (!item.variant_active || !item.product_active) {
        return {
          success: false,
          error: `Item "${item.product_name} - ${item.variant_name}" is no longer available.`,
        };
      }
      if (item.stock_qty < item.qty) {
        return {
          success: false,
          error: `Insufficient stock for "${item.product_name} - ${item.variant_name}". Available: ${item.stock_qty}`,
        };
      }
      subtotalCents += item.price_cents * item.qty;
      totalWeightG += (item.weight_g || 0) * item.qty;
    }

    const address = await db.prepare(`
      SELECT * FROM addresses WHERE id = ? AND user_id = ?
    `).get(input.addressId, user.id) as any;

    if (!address) {
      return { success: false, error: 'Please select a valid shipping address' };
    }

    if (input.paymentMethod === 'pay_on_delivery' && address.province !== 'Gauteng') {
      return { success: false, error: 'Pay on delivery is available in Gauteng only. Please choose card or EFT.' };
    }

    const settings = await getStoreSettings();

    let couponDiscountCents = 0;
    let isFreeShippingCoupon = false;
    let appliedCoupon: any = null;

    if (cart.coupon_code) {
      const coupon = await db.prepare(`
        SELECT * FROM coupons WHERE code = ? COLLATE NOCASE
      `).get(cart.coupon_code) as any;

      const now = new Date().toISOString();
      let valid = true;

      if (!coupon || !coupon.active) valid = false;
      else if (coupon.starts_at && coupon.starts_at > now) valid = false;
      else if (coupon.expires_at && coupon.expires_at < now) valid = false;
      else if (subtotalCents < coupon.min_subtotal_cents) valid = false;
      else if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) valid = false;
      else if (coupon.one_per_customer) {
        const redemption = await db.prepare(`
          SELECT id FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?
        `).get(coupon.id, user.id);
        if (redemption) valid = false;
      }

      if (valid) {
        appliedCoupon = coupon;
        if (coupon.type === 'percent') {
          couponDiscountCents = Math.round((subtotalCents * coupon.value) / 100);
          if (coupon.max_discount_cents && couponDiscountCents > coupon.max_discount_cents) {
            couponDiscountCents = coupon.max_discount_cents;
          }
        } else if (coupon.type === 'fixed') {
          couponDiscountCents = Math.min(coupon.value, subtotalCents);
        } else if (coupon.type === 'free_shipping') {
          couponDiscountCents = 0;
          isFreeShippingCoupon = true;
        }
      }
    }

    let shippingCents = 0;
    const netSubtotal = Math.max(0, subtotalCents - couponDiscountCents);

    if (input.shippingMethod === 'pickup') {
      shippingCents = 0;
    } else if (isFreeShippingCoupon) {
      shippingCents = 0;
    } else if (input.shippingMethod === 'standard') {
      if (settings.free_shipping_enabled && netSubtotal >= settings.free_shipping_threshold_cents) {
        shippingCents = 0;
      } else {
        shippingCents = settings.standard_base_cents;
        if (totalWeightG > settings.weight_threshold_g) {
          shippingCents += settings.weight_surcharge_cents;
        }
      }
    } else if (input.shippingMethod === 'express') {
      shippingCents = settings.express_base_cents;
      if (totalWeightG > settings.weight_threshold_g) {
        shippingCents += settings.express_weight_surcharge_cents;
      }
    }

    const totalCents = subtotalCents - couponDiscountCents + shippingCents;

    const preparedLineItems = cartItems.map(item => ({
      ...item,
      line_subtotal_cents: item.price_cents * item.qty,
    }));

    const itemsWithDiscounts = allocateDiscounts(
      preparedLineItems,
      couponDiscountCents,
      subtotalCents
    );

    const taxResult = calculateAndAllocateTax(
      itemsWithDiscounts,
      settings.tax_enabled,
      settings.tax_rate_percent,
      shippingCents,
      settings.shipping_taxable
    );

    const orderNumber = await nextSequence('order', settings.order_prefix || 'ORD');
    const orderId = crypto.randomUUID();

    let orderStatus: 'pending_payment' | 'paid' | 'processing' = 'pending_payment';
    let paymentStatus: 'pending' | 'success' | 'failed' = 'pending';
    let invoiceStatus: 'issued' | 'paid' = 'issued';
    let invoiceAmountPaid = 0;

    const simOutcome = input.simCardOutcome ?? 'success';

    if (input.paymentMethod === 'sim_card') {
      if (simOutcome === 'success') {
        orderStatus = 'paid';
        paymentStatus = 'success';
        invoiceStatus = 'paid';
        invoiceAmountPaid = totalCents;
      } else if (simOutcome === 'declined') {
        orderStatus = 'pending_payment';
        paymentStatus = 'failed';
        invoiceStatus = 'issued';
      } else {
        orderStatus = 'pending_payment';
        paymentStatus = 'pending';
        invoiceStatus = 'issued';
      }
    } else if (input.paymentMethod === 'manual_eft') {
      orderStatus = 'pending_payment';
      paymentStatus = 'pending';
      invoiceStatus = 'issued';
    } else if (input.paymentMethod === 'pay_on_delivery') {
      orderStatus = 'processing';
      paymentStatus = 'pending';
      invoiceStatus = 'issued';
    }

    const shippingAddressJson = JSON.stringify({
      label: address.label,
      full_name: address.full_name,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 || '',
      city: address.city,
      province: address.province,
      postal_code: address.postal_code,
      country: address.country,
    });

    try {
      await db.prepare(`
        INSERT INTO orders (
          id, order_number, user_id, email, status, currency,
          subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
          shipping_method, shipping_address_json, billing_address_json,
          coupon_code, customer_note, idempotency_key, placed_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, 'ZAR',
          ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?, ?, ?, datetime('now'), datetime('now')
        )
      `).run(
        orderId,
        orderNumber,
        user.id,
        user.email,
        orderStatus,
        subtotalCents,
        couponDiscountCents,
        shippingCents,
        taxResult.totalTaxCents,
        totalCents,
        input.shippingMethod,
        shippingAddressJson,
        shippingAddressJson,
        appliedCoupon ? appliedCoupon.code : null,
        input.customerNote?.slice(0, 500) || null,
        idempotencyKey
      );
    } catch (e: any) {
      // Self-heal DBs that haven't run 002_qol.sql yet (missing idempotency_key column)
      if (/no such column: idempotency_key/i.test(String(e?.message || ''))) {
        try { await db.exec(`ALTER TABLE orders ADD COLUMN idempotency_key TEXT`); } catch {}
        try { await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL`); } catch {}
        await db.prepare(`
          INSERT INTO orders (
            id, order_number, user_id, email, status, currency,
            subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
            shipping_method, shipping_address_json, billing_address_json,
            coupon_code, customer_note, idempotency_key, placed_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, 'ZAR',
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, datetime('now'), datetime('now')
          )
        `).run(
          orderId, orderNumber, user.id, user.email, orderStatus,
          subtotalCents, couponDiscountCents, shippingCents, taxResult.totalTaxCents, totalCents,
          input.shippingMethod, shippingAddressJson, shippingAddressJson,
          appliedCoupon ? appliedCoupon.code : null, input.customerNote?.slice(0, 500) || null, idempotencyKey
        );
      } else {
        throw e;
      }
    }

    const invoiceItems: InvoiceLineItem[] = [];

    for (const item of taxResult.items) {
      const orderItemId = crypto.randomUUID();
      const variantSnapshot = JSON.stringify({
        sku: item.sku,
        name: `${item.product_name} - ${item.variant_name}`,
        unit_price_cents: item.price_cents,
        product_id: item.product_id,
        variant_id: item.variant_id,
      });

      await db.prepare(`
        INSERT INTO order_items (
          id, order_id, variant_id, variant_snapshot_json,
          qty, unit_price_cents, line_subtotal_cents, line_discount_cents,
          line_total_cents, tax_cents
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderItemId,
        orderId,
        item.variant_id,
        variantSnapshot,
        item.qty,
        item.price_cents,
        item.line_subtotal_cents,
        item.line_discount_cents,
        item.line_total_cents,
        item.tax_cents
      );

      const stockUpdate = await db.prepare(`
        UPDATE product_variants
        SET stock_qty = stock_qty - ?, updated_at = datetime('now')
        WHERE id = ? AND stock_qty >= ?
      `).run(item.qty, item.variant_id, item.qty) as any;
      if (!stockUpdate || Number(stockUpdate.changes ?? 0) < 1) {
        throw new Error(`Insufficient stock for "${item.product_name} - ${item.variant_name}". Another order took the last units.`);
      }

      await db.prepare(`
        INSERT INTO stock_movements (id, variant_id, delta, reason, order_id, note, created_at)
        VALUES (?, ?, ?, 'order', ?, ?, datetime('now'))
      `).run(
        crypto.randomUUID(),
        item.variant_id,
        -item.qty,
        orderId,
        `Order ${orderNumber}`
      );

      invoiceItems.push({
        sku: item.sku,
        name: `${item.product_name} - ${item.variant_name}`,
        qty: item.qty,
        unit_price_cents: item.price_cents,
        line_subtotal_cents: item.line_subtotal_cents,
        line_discount_cents: item.line_discount_cents,
        line_total_cents: item.line_total_cents,
        tax_cents: item.tax_cents,
      });
    }

    if (appliedCoupon) {
      // Atomic guard: only one concurrent checkout can consume the last use.
      const couponUpdate = await db.prepare(`
        UPDATE coupons SET used_count = used_count + 1
        WHERE id = ? AND (usage_limit IS NULL OR used_count < usage_limit)
      `).run(appliedCoupon.id) as any;
      if (Number(couponUpdate?.changes ?? 0) < 1) {
        throw new Error('COUPON_LIMIT_REACHED');
      }

      // OR IGNORE keeps reusable coupons working on pre-002 DBs with UNIQUE(coupon,user)
      await db.prepare(`
        INSERT OR IGNORE INTO coupon_redemptions (id, coupon_id, user_id, order_id, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(crypto.randomUUID(), appliedCoupon.id, user.id, orderId);
    }

    await db.prepare(`
      INSERT INTO order_events (id, order_id, actor_id, type, note, created_at)
      VALUES (?, ?, ?, 'order_placed', ?, datetime('now'))
    `).run(crypto.randomUUID(), orderId, user.id, `Order placed with ${input.paymentMethod}`);

    const paymentId = crypto.randomUUID();
    const gatewayRef = input.paymentMethod === 'sim_card'
      ? `sim_${crypto.randomBytes(8).toString('hex')}`
      : null;

    await db.prepare(`
      INSERT INTO payments (
        id, order_id, method, status, amount_cents, gateway_ref, simulated_result_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      paymentId,
      orderId,
      input.paymentMethod,
      paymentStatus,
      totalCents,
      gatewayRef,
      JSON.stringify({ outcome: simOutcome, note: 'Simulated payment processing' })
    );

    const isTrade = (user as any).trade_status === 'approved' || (user as any).account_type === 'trade';
    const buyer: InvoiceBuyer = {
      name: isTrade && (user as any).business_name
        ? `${(user as any).business_name} — ${address.full_name}`
        : address.full_name,
      email: user.email,
      phone: address.phone,
      address_line1: address.line1,
      address_line2: [
        address.line2 || '',
        isTrade && (user as any).trade_vat_number ? `VAT ${(user as any).trade_vat_number}` : '',
      ].filter(Boolean).join(' • '),
      city: address.city,
      province: address.province,
      postal_code: address.postal_code,
      country: address.country,
    };

    await createInvoiceForOrder(
      {
        id: orderId,
        order_number: orderNumber,
        subtotal_cents: subtotalCents,
        discount_cents: couponDiscountCents,
        shipping_cents: shippingCents,
        tax_cents: taxResult.totalTaxCents,
        total_cents: totalCents,
        email: user.email,
      },
      buyer,
      invoiceItems,
      invoiceStatus,
      invoiceAmountPaid,
      input.paymentMethod === 'manual_eft'
        ? (await getStoreSettings()).bank_reference_note
        : ''
    );

    await db.prepare(`
      UPDATE carts SET status = 'converted', updated_at = datetime('now') WHERE id = ?
    `).run(cart.id);

    return {
      success: true,
      orderId,
      orderNumber,
    };
  };

  try {
    if (isPg) {
      return await (db as any).transaction(exec)();
    } else {
      return (db as any).transaction(exec)();
    }
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (/insufficient stock/i.test(msg)) return { success: false, error: msg };
    if (/COUPON_LIMIT_REACHED/i.test(msg)) {
      return { success: false, error: 'This coupon just reached its usage limit. Remove it in the cart and place the order again.' };
    }
    throw e;
  }
}

/**
 * Retry payment for an existing pending_payment order
 */
export async function retryOrderPayment(
  orderId: string,
  userId: string,
  outcome: 'success' | 'declined' | 'pending'
): Promise<{ success: boolean; error?: string }> {
  const exec = async () => {
    const order = await db.prepare(`
      SELECT * FROM orders WHERE id = ? AND user_id = ?
    `).get(orderId, userId) as any;

    if (!order) return { success: false, error: 'Order not found' };
    if (order.status !== 'pending_payment') {
      return { success: false, error: 'Order is not in pending payment state' };
    }

    const newPaymentId = crypto.randomUUID();
    const gatewayRef = `sim_${crypto.randomBytes(8).toString('hex')}`;
    const paymentStatus = outcome === 'success' ? 'success' : outcome === 'declined' ? 'failed' : 'pending';

    await db.prepare(`
      INSERT INTO payments (
        id, order_id, method, status, amount_cents, gateway_ref, simulated_result_json, created_at
      ) VALUES (?, ?, 'sim_card', ?, ?, ?, ?, datetime('now'))
    `).run(
      newPaymentId,
      orderId,
      paymentStatus,
      order.total_cents,
      gatewayRef,
      JSON.stringify({ retry: true, outcome })
    );

    if (outcome === 'success') {
      await db.prepare(`
        UPDATE orders SET status = 'paid', updated_at = datetime('now') WHERE id = ?
      `).run(orderId);

      await db.prepare(`
        UPDATE invoices
        SET status = 'paid', amount_paid_cents = total_cents, updated_at = datetime('now')
        WHERE order_id = ?
      `).run(orderId);

      await db.prepare(`
        INSERT INTO order_events (id, order_id, actor_id, type, note, created_at)
        VALUES (?, ?, ?, 'payment_received', 'Simulated payment retry succeeded', datetime('now'))
      `).run(crypto.randomUUID(), orderId, userId);
    } else {
      await db.prepare(`
        INSERT INTO order_events (id, order_id, actor_id, type, note, created_at)
        VALUES (?, ?, ?, 'payment_failed', 'Simulated payment retry failed', datetime('now'))
      `).run(crypto.randomUUID(), orderId, userId);
    }

    return { success: true };
  };

  if (isPg) {
    return await (db as any).transaction(exec)();
  } else {
    return (db as any).transaction(exec)();
  }
}
