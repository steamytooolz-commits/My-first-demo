import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { db } from './db';
import { getSessionUser } from './auth';
import { getStoreSettings } from './settings';

export const GUEST_CART_COOKIE_NAME = 'jpf_cart';

export interface CartItemWithDetails {
  id: string;
  cart_id: string;
  variant_id: string;
  qty: number;
  unit_price_cents: number;
  line_subtotal_cents: number;
  variant_name: string;
  variant_sku: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  image_url: string | null;
  stock_qty: number;
  weight_g: number;
  active: boolean;
}

export interface CartSummary {
  cartId: string;
  items: CartItemWithDetails[];
  itemCount: number;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  totalWeightG: number;
  shippingMethod: 'pickup' | 'standard' | 'express';
  couponCode: string | null;
  couponWarning: string | null;
  freeShippingProgress: {
    enabled: boolean;
    thresholdCents: number;
    remainingCents: number;
    qualifies: boolean;
  };
}

/**
 * Find existing active cart for the current user or guest.
 * Safe to call anywhere (including server components) as it only reads cookies.
 */
export async function findActiveCart(): Promise<{ cartId: string; isGuest: boolean } | null> {
  const user = await getSessionUser();
  const cookieStore = await cookies();

  if (user) {
    const cart = await db.prepare(`
      SELECT id FROM carts WHERE user_id = ? AND status = 'active'
    `).get(user.id) as { id: string } | undefined;

    if (cart) {
      return { cartId: cart.id, isGuest: false };
    }
  }

  // Guest cart check
  const guestToken = cookieStore.get(GUEST_CART_COOKIE_NAME)?.value;
  if (guestToken) {
    const cart = await db.prepare(`
      SELECT id FROM carts WHERE guest_token = ? AND status = 'active'
    `).get(guestToken) as { id: string } | undefined;

    if (cart) {
      return { cartId: cart.id, isGuest: true };
    }
  }

  return null;
}

/**
 * Get or create an active cart for the current user or guest.
 * Should be called from Server Actions or Route Handlers where cookies can be set.
 */
export async function getOrCreateActiveCart(): Promise<{ cartId: string; isGuest: boolean }> {
  const existing = await findActiveCart();
  if (existing) {
    return existing;
  }

  const user = await getSessionUser();
  const cookieStore = await cookies();

  if (user) {
    const cartId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO carts (id, user_id, guest_token, status, shipping_method, created_at, updated_at)
      VALUES (?, ?, NULL, 'active', 'standard', datetime('now'), datetime('now'))
    `).run(cartId, user.id);
    return { cartId, isGuest: false };
  }

  // Create new guest cart
  const newGuestToken = crypto.randomBytes(24).toString('hex');
  const cartId = crypto.randomUUID();

  await db.prepare(`
    INSERT INTO carts (id, user_id, guest_token, status, shipping_method, created_at, updated_at)
    VALUES (?, NULL, ?, 'active', 'standard', datetime('now'), datetime('now'))
  `).run(cartId, newGuestToken);

  try {
    const isProd = process.env.NODE_ENV === 'production';
    cookieStore.set(GUEST_CART_COOKIE_NAME, newGuestToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
  } catch {
    // Graceful fallback if called outside a mutation context
  }

  return { cartId, isGuest: true };
}

/**
 * Merge guest cart items into customer cart after login/register
 */
export async function mergeGuestCart(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const guestToken = cookieStore.get(GUEST_CART_COOKIE_NAME)?.value;
  if (!guestToken) return;

  const guestCart = await db.prepare(`
    SELECT id, coupon_code, shipping_method FROM carts WHERE guest_token = ? AND status = 'active'
  `).get(guestToken) as { id: string; coupon_code: string | null; shipping_method: string } | undefined;

  if (!guestCart) return;

  await db.transaction(async () => {
    // Find or create active user cart
    let userCart = await db.prepare(`
      SELECT id, coupon_code, shipping_method FROM carts WHERE user_id = ? AND status = 'active'
    `).get(userId) as { id: string; coupon_code: string | null; shipping_method: string } | undefined;

    if (!userCart) {
      const newCartId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO carts (id, user_id, guest_token, status, coupon_code, shipping_method, created_at, updated_at)
        VALUES (?, ?, NULL, 'active', ?, ?, datetime('now'), datetime('now'))
      `).run(newCartId, userId, guestCart.coupon_code, guestCart.shipping_method || 'standard');
      userCart = { id: newCartId, coupon_code: guestCart.coupon_code, shipping_method: guestCart.shipping_method };
    }

    // Get items from guest cart
    const guestItems = await db.prepare(`
      SELECT ci.variant_id, ci.qty, pv.stock_qty, pv.price_cents
      FROM cart_items ci
      JOIN product_variants pv ON ci.variant_id = pv.id
      WHERE ci.cart_id = ?
    `).all(guestCart.id) as { variant_id: string; qty: number; stock_qty: number; price_cents: number }[];

    for (const item of guestItems) {
      const existingUserItem = await db.prepare(`
        SELECT id, qty FROM cart_items WHERE cart_id = ? AND variant_id = ?
      `).get(userCart.id, item.variant_id) as { id: string; qty: number } | undefined;

      const currentStock = Math.max(0, item.stock_qty);
      if (existingUserItem) {
        const combinedQty = Math.min(existingUserItem.qty + item.qty, currentStock);
        if (combinedQty > 0) {
          await db.prepare(`
            UPDATE cart_items
            SET qty = ?, unit_price_cents = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(combinedQty, item.price_cents, existingUserItem.id);
        }
      } else {
        const targetQty = Math.min(item.qty, currentStock);
        if (targetQty > 0) {
          await db.prepare(`
            INSERT INTO cart_items (id, cart_id, variant_id, qty, unit_price_cents, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `).run(crypto.randomUUID(), userCart.id, item.variant_id, targetQty, item.price_cents);
        }
      }
    }

    // Mark guest cart as converted/abandoned and clear cookie
    await db.prepare(`UPDATE carts SET status = 'abandoned', updated_at = datetime('now') WHERE id = ?`).run(guestCart.id);
  })();

  try {
    const isProd = process.env.NODE_ENV === 'production';
    cookieStore.set(GUEST_CART_COOKIE_NAME, '', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  } catch {
    // Graceful fallback
  }
}

/**
 * Recalculate and fetch full cart summary with server-authoritative pricing and validation
 */
export async function getCartSummary(): Promise<CartSummary> {
  const activeCart = await findActiveCart();
  const settings = await getStoreSettings();

  if (!activeCart) {
    return {
      cartId: '',
      items: [],
      itemCount: 0,
      subtotalCents: 0,
      discountCents: 0,
      shippingCents: 0,
      taxCents: 0,
      totalCents: 0,
      totalWeightG: 0,
      shippingMethod: 'standard',
      couponCode: null,
      couponWarning: null,
      freeShippingProgress: {
        enabled: settings.free_shipping_enabled,
        thresholdCents: settings.free_shipping_threshold_cents,
        remainingCents: settings.free_shipping_threshold_cents,
        qualifies: false,
      },
    };
  }

  const { cartId } = activeCart;
  const user = await getSessionUser();

  const cartRow = await db.prepare(`
    SELECT id, coupon_code, shipping_method FROM carts WHERE id = ?
  `).get(cartId) as { id: string; coupon_code: string | null; shipping_method: string } | undefined;

  const shippingMethod = (cartRow?.shipping_method ?? 'standard') as 'pickup' | 'standard' | 'express';
  let couponCode = cartRow?.coupon_code ?? null;
  let couponWarning: string | null = null;

  // Query raw items with current variant prices, stock, and product details
  const rawItems = await db.prepare(`
    SELECT 
      ci.id,
      ci.cart_id,
      ci.variant_id,
      ci.qty,
      pv.price_cents as current_unit_price,
      pv.stock_qty,
      pv.weight_g,
      pv.name as variant_name,
      pv.sku as variant_sku,
      pv.active as variant_active,
      p.id as product_id,
      p.name as product_name,
      p.slug as product_slug,
      p.active as product_active,
      (SELECT url FROM product_images WHERE product_id = p.id ORDER BY position ASC LIMIT 1) as image_url
    FROM cart_items ci
    JOIN product_variants pv ON ci.variant_id = pv.id
    JOIN products p ON pv.product_id = p.id
    WHERE ci.cart_id = ?
  `).all(cartId) as any[];

  // Update cart item unit prices if they changed in DB
  const items: CartItemWithDetails[] = [];
  let subtotalCents = 0;
  let totalWeightG = 0;
  let itemCount = 0;

  for (const row of rawItems) {
    const isActive = Boolean(row.variant_active && row.product_active && row.stock_qty > 0);
    const unitPrice = row.current_unit_price;
    const lineSubtotal = unitPrice * row.qty;

    if (isActive) {
      subtotalCents += lineSubtotal;
      totalWeightG += (row.weight_g || 0) * row.qty;
      itemCount += row.qty;
    }

    items.push({
      id: row.id,
      cart_id: row.cart_id,
      variant_id: row.variant_id,
      qty: row.qty,
      unit_price_cents: unitPrice,
      line_subtotal_cents: lineSubtotal,
      variant_name: row.variant_name,
      variant_sku: row.variant_sku,
      product_id: row.product_id,
      product_name: row.product_name,
      product_slug: row.product_slug,
      image_url: row.image_url ?? null,
      stock_qty: row.stock_qty,
      weight_g: row.weight_g || 0,
      active: isActive,
    });
  }

  // 10.2 Coupon calculation
  let discountCents = 0;
  let isFreeShippingCoupon = false;

  if (couponCode && subtotalCents > 0) {
    const coupon = await db.prepare(`
      SELECT * FROM coupons WHERE code = ? COLLATE NOCASE
    `).get(couponCode) as any;

    const now = new Date().toISOString();
    let valid = true;

    if (!coupon || !coupon.active) {
      valid = false;
      couponWarning = 'Coupon code is invalid or inactive';
    } else if (coupon.starts_at && coupon.starts_at > now) {
      valid = false;
      couponWarning = 'Coupon is not yet active';
    } else if (coupon.expires_at && coupon.expires_at < now) {
      valid = false;
      couponWarning = 'Coupon has expired';
    } else if (subtotalCents < coupon.min_subtotal_cents) {
      valid = false;
      couponWarning = `Coupon requires a minimum subtotal of R${(coupon.min_subtotal_cents / 100).toFixed(2)}`;
    } else if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      valid = false;
      couponWarning = 'Coupon usage limit has been reached';
    } else if (coupon.one_per_customer && user) {
      const redemption = await db.prepare(`
        SELECT id FROM coupon_redemptions WHERE coupon_id = ? AND user_id = ?
      `).get(coupon.id, user.id);
      if (redemption) {
        valid = false;
        couponWarning = 'You have already redeemed this coupon';
      }
    }

    if (!valid) {
      // Remove invalid coupon from cart
      await db.prepare(`UPDATE carts SET coupon_code = NULL, updated_at = datetime('now') WHERE id = ?`).run(cartId);
      couponCode = null;
    } else {
      if (coupon.type === 'percent') {
        discountCents = Math.round((subtotalCents * coupon.value) / 100);
        if (coupon.max_discount_cents && discountCents > coupon.max_discount_cents) {
          discountCents = coupon.max_discount_cents;
        }
      } else if (coupon.type === 'fixed') {
        discountCents = Math.min(coupon.value, subtotalCents);
      } else if (coupon.type === 'free_shipping') {
        discountCents = 0;
        isFreeShippingCoupon = true;
      }
    }
  } else if (couponCode && subtotalCents === 0) {
    await db.prepare(`UPDATE carts SET coupon_code = NULL, updated_at = datetime('now') WHERE id = ?`).run(cartId);
    couponCode = null;
  }

  // 10.3 Shipping Calculation
  let shippingCents = 0;
  const netSubtotal = Math.max(0, subtotalCents - discountCents);

  if (shippingMethod === 'pickup' || items.length === 0) {
    shippingCents = 0;
  } else if (isFreeShippingCoupon) {
    shippingCents = 0;
  } else if (shippingMethod === 'standard') {
    if (settings.free_shipping_enabled && netSubtotal >= settings.free_shipping_threshold_cents) {
      shippingCents = 0;
    } else {
      shippingCents = settings.standard_base_cents;
      if (totalWeightG > settings.weight_threshold_g) {
        shippingCents += settings.weight_surcharge_cents;
      }
    }
  } else if (shippingMethod === 'express') {
    shippingCents = settings.express_base_cents;
    if (totalWeightG > settings.weight_threshold_g) {
      shippingCents += settings.express_weight_surcharge_cents;
    }
  }

  // 10.4 Total Calculation
  const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);

  // Tax calculation
  let taxCents = 0;
  if (settings.tax_enabled && settings.tax_rate_percent > 0) {
    const taxableGoods = netSubtotal;
    const taxableShipping = settings.shipping_taxable ? shippingCents : 0;
    const taxableIncl = taxableGoods + taxableShipping;
    taxCents = Math.round((taxableIncl * settings.tax_rate_percent) / (100 + settings.tax_rate_percent));
  }

  const freeShippingQualifies = netSubtotal >= settings.free_shipping_threshold_cents;
  const remainingForFreeShipping = Math.max(0, settings.free_shipping_threshold_cents - netSubtotal);

  return {
    cartId,
    items,
    itemCount,
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents,
    totalWeightG,
    shippingMethod,
    couponCode,
    couponWarning,
    freeShippingProgress: {
      enabled: settings.free_shipping_enabled,
      thresholdCents: settings.free_shipping_threshold_cents,
      remainingCents: remainingForFreeShipping,
      qualifies: freeShippingQualifies,
    },
  };
}

/**
 * Add product variant to active cart with stock validation
 */
export async function addToCart(variantId: string, qty: number): Promise<{ success: boolean; error?: string }> {
  if (qty <= 0) return { success: false, error: 'Quantity must be at least 1' };

  const variant = await db.prepare(`
    SELECT pv.id, pv.stock_qty, pv.price_cents, pv.active as variant_active, p.active as product_active
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE pv.id = ?
  `).get(variantId) as { id: string; stock_qty: number; price_cents: number; variant_active: number; product_active: number } | undefined;

  if (!variant || !variant.variant_active || !variant.product_active) {
    return { success: false, error: 'Product is unavailable' };
  }

  const { cartId } = await getOrCreateActiveCart();

  const existingItem = await db.prepare(`
    SELECT id, qty FROM cart_items WHERE cart_id = ? AND variant_id = ?
  `).get(cartId, variantId) as { id: string; qty: number } | undefined;

  const currentQty = existingItem ? existingItem.qty : 0;
  const newQty = currentQty + qty;

  if (newQty > variant.stock_qty) {
    return {
      success: false,
      error: `Only ${variant.stock_qty} available in stock`,
    };
  }

  if (existingItem) {
    await db.prepare(`
      UPDATE cart_items
      SET qty = ?, unit_price_cents = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(newQty, variant.price_cents, existingItem.id);
  } else {
    await db.prepare(`
      INSERT INTO cart_items (id, cart_id, variant_id, qty, unit_price_cents, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(crypto.randomUUID(), cartId, variantId, qty, variant.price_cents);
  }

  await db.prepare(`UPDATE carts SET updated_at = datetime('now') WHERE id = ?`).run(cartId);
  return { success: true };
}

/**
 * Update quantity of cart item
 */
export async function updateCartItemQuantity(variantId: string, qty: number): Promise<{ success: boolean; error?: string }> {
  const { cartId } = await getOrCreateActiveCart();

  if (qty <= 0) {
    await db.prepare(`DELETE FROM cart_items WHERE cart_id = ? AND variant_id = ?`).run(cartId, variantId);
    await db.prepare(`UPDATE carts SET updated_at = datetime('now') WHERE id = ?`).run(cartId);
    return { success: true };
  }

  const variant = await db.prepare('SELECT stock_qty, price_cents FROM product_variants WHERE id = ?').get(variantId) as { stock_qty: number; price_cents: number } | undefined;
  if (!variant) return { success: false, error: 'Product variant not found' };

  if (qty > variant.stock_qty) {
    return { success: false, error: `Only ${variant.stock_qty} available in stock` };
  }

  await db.prepare(`
    UPDATE cart_items
    SET qty = ?, unit_price_cents = ?, updated_at = datetime('now')
    WHERE cart_id = ? AND variant_id = ?
  `).run(qty, variant.price_cents, cartId, variantId);

  await db.prepare(`UPDATE carts SET updated_at = datetime('now') WHERE id = ?`).run(cartId);
  return { success: true };
}

/**
 * Remove item from cart
 */
export async function removeCartItem(variantId: string): Promise<void> {
  const { cartId } = await getOrCreateActiveCart();
  await db.prepare(`DELETE FROM cart_items WHERE cart_id = ? AND variant_id = ?`).run(cartId, variantId);
  await db.prepare(`UPDATE carts SET updated_at = datetime('now') WHERE id = ?`).run(cartId);
}

/**
 * Update selected shipping method on active cart
 */
export async function setShippingMethod(method: 'pickup' | 'standard' | 'express'): Promise<void> {
  if (method !== 'pickup' && method !== 'standard' && method !== 'express') {
    throw new Error('Invalid shipping method');
  }
  const { cartId } = await getOrCreateActiveCart();
  await db.prepare(`UPDATE carts SET shipping_method = ?, updated_at = datetime('now') WHERE id = ?`).run(method, cartId);
}

/**
 * Apply coupon code to active cart
 */
export async function applyCoupon(code: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = code.trim();
  if (!trimmed) return { success: false, error: 'Coupon code cannot be empty' };

  const coupon = await db.prepare('SELECT * FROM coupons WHERE code = ? COLLATE NOCASE').get(trimmed) as any;
  if (!coupon || !coupon.active) {
    return { success: false, error: 'Invalid or inactive coupon code' };
  }

  const { cartId } = await getOrCreateActiveCart();
  await db.prepare(`UPDATE carts SET coupon_code = ?, updated_at = datetime('now') WHERE id = ?`).run(coupon.code, cartId);
  return { success: true };
}

/**
 * Remove coupon code from active cart
 */
export async function removeCoupon(): Promise<void> {
  const { cartId } = await getOrCreateActiveCart();
  await db.prepare(`UPDATE carts SET coupon_code = NULL, updated_at = datetime('now') WHERE id = ?`).run(cartId);
}
