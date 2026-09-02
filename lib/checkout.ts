import crypto from 'node:crypto';
import { db } from './db';
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
}

export interface CheckoutResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  error?: string;
}

export function executeCheckout(user: User, input: CheckoutInput): CheckoutResult {
  // 1. Rate-limit check
  const rateLimitKey = `checkout:${user.id}:${input.ip || 'local'}`;
  const rateCheck = checkRateLimit(rateLimitKey, 10, 15 * 60 * 1000);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Too many checkout attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
    };
  }

  // Execute inside SQLite transaction
  return db.transaction(() => {
    // 2. Load active cart
    const cart = db.prepare(`
      SELECT * FROM carts WHERE user_id = ? AND status = 'active'
    `).get(user.id) as any;

    if (!cart) {
      return { success: false, error: 'No active cart found' };
    }

    // 3. Load cart items with current variants and products
    const cartItems = db.prepare(`
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

    // 4. Validate variants and stock
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

    // 5. Validate shipping address
    const address = db.prepare(`
      SELECT * FROM addresses WHERE id = ? AND user_id = ?
    `).get(input.addressId, user.id) as any;

    if (!address) {
      return { success: false, error: 'Please select a valid shipping address' };
    }

    const settings = getStoreSettings();

    // 6. Validate and calculate coupon
    let couponDiscountCents = 0;
    let isFreeShippingCoupon = false;
    let appliedCoupon: any = null;

    if (cart.coupon_code) {
      const coupon = db.prepare(`
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
        const redemption = db.prepare(`
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

    // 7. Calculate shipping
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

    // 8. Order total
    const totalCents = subtotalCents - couponDiscountCents + shippingCents;

    // 9. Tax calculation & allocation
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

    // 10. Generate order number
    const orderNumber = nextSequence('order', settings.order_prefix || 'ORD');
    const orderId = crypto.randomUUID();

    // 11. Determine statuses based on payment method
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

    // 12. Insert order
    db.prepare(`
      INSERT INTO orders (
        id, order_number, user_id, email, status, currency,
        subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
        shipping_method, shipping_address_json, billing_address_json,
        coupon_code, customer_note, placed_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, 'ZAR',
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, datetime('now'), datetime('now')
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
      shippingAddressJson, // same as shipping
      appliedCoupon ? appliedCoupon.code : null,
      input.customerNote || null
    );

    // 13. Insert order items, decrement stock, and record stock movements
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

      db.prepare(`
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

      // Decrement stock
      db.prepare(`
        UPDATE product_variants
        SET stock_qty = stock_qty - ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(item.qty, item.variant_id);

      // Record stock movement
      db.prepare(`
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

    // 14. Increment coupon count and create redemption
    if (appliedCoupon) {
      db.prepare(`
        UPDATE coupons SET used_count = used_count + 1 WHERE id = ?
      `).run(appliedCoupon.id);

      db.prepare(`
        INSERT INTO coupon_redemptions (id, coupon_id, user_id, order_id, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(crypto.randomUUID(), appliedCoupon.id, user.id, orderId);
    }

    // 15. Create order event
    db.prepare(`
      INSERT INTO order_events (id, order_id, actor_id, type, note, created_at)
      VALUES (?, ?, ?, 'order_placed', ?, datetime('now'))
    `).run(crypto.randomUUID(), orderId, user.id, `Order placed with ${input.paymentMethod}`);

    // 16. Create payment record
    const paymentId = crypto.randomUUID();
    const gatewayRef = input.paymentMethod === 'sim_card'
      ? `sim_${crypto.randomBytes(8).toString('hex')}`
      : null;

    db.prepare(`
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

    // 17. Create invoice
    const buyer: InvoiceBuyer = {
      name: address.full_name,
      email: user.email,
      phone: address.phone,
      address_line1: address.line1,
      address_line2: address.line2 || '',
      city: address.city,
      province: address.province,
      postal_code: address.postal_code,
      country: address.country,
    };

    createInvoiceForOrder(
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
        ? settings.bank_reference_note
        : ''
    );

    // 18. Mark cart converted
    db.prepare(`
      UPDATE carts SET status = 'converted', updated_at = datetime('now') WHERE id = ?
    `).run(cart.id);

    return {
      success: true,
      orderId,
      orderNumber,
    };
  })();
}

/**
 * Retry payment for an existing pending_payment order
 */
export function retryOrderPayment(
  orderId: string,
  userId: string,
  outcome: 'success' | 'declined' | 'pending'
): { success: boolean; error?: string } {
  return db.transaction(() => {
    const order = db.prepare(`
      SELECT * FROM orders WHERE id = ? AND user_id = ?
    `).get(orderId, userId) as any;

    if (!order) return { success: false, error: 'Order not found' };
    if (order.status !== 'pending_payment') {
      return { success: false, error: 'Order is not in pending payment state' };
    }

    const newPaymentId = crypto.randomUUID();
    const gatewayRef = `sim_${crypto.randomBytes(8).toString('hex')}`;
    const paymentStatus = outcome === 'success' ? 'success' : outcome === 'declined' ? 'failed' : 'pending';

    db.prepare(`
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
      db.prepare(`
        UPDATE orders SET status = 'paid', updated_at = datetime('now') WHERE id = ?
      `).run(orderId);

      db.prepare(`
        UPDATE invoices
        SET status = 'paid', amount_paid_cents = total_cents, updated_at = datetime('now')
        WHERE order_id = ?
      `).run(orderId);

      db.prepare(`
        INSERT INTO order_events (id, order_id, actor_id, type, note, created_at)
        VALUES (?, ?, ?, 'payment_received', 'Simulated payment retry succeeded', datetime('now'))
      `).run(crypto.randomUUID(), orderId, userId);
    } else {
      db.prepare(`
        INSERT INTO order_events (id, order_id, actor_id, type, note, created_at)
        VALUES (?, ?, ?, 'payment_failed', 'Simulated payment retry failed', datetime('now'))
      `).run(crypto.randomUUID(), orderId, userId);
    }

    return { success: true };
  })();
}
