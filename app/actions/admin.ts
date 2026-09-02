'use server';

import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { updateStoreSettings } from '@/lib/settings';
import { processErasure } from '@/lib/privacy';
import { productSchema, variantSchema, categorySchema, couponSchema } from '@/lib/validation';

export interface AdminActionResponse {
  success: boolean;
  error?: string;
}

// -------------------------------------------------------------
// Products & Variants
// -------------------------------------------------------------
export async function adminSaveProductAction(prevState: any, formData: FormData): Promise<AdminActionResponse> {
  const admin = await requireAdmin();
  const id = String(formData.get('id') || '');
  const imageUrl = String(formData.get('imageUrl') || '').trim();

  const raw = {
    name: String(formData.get('name') || '').trim(),
    slug: String(formData.get('slug') || '').trim().toLowerCase(),
    category_id: String(formData.get('category_id') || '') || null,
    brand: String(formData.get('brand') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    active: formData.get('active') === 'on',
    featured: formData.get('featured') === 'on',
  };

  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid product data' };
  }

  const p = parsed.data;

  // Slug collision check
  const slugCheck = await db.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').get(p.slug, id);
  if (slugCheck) {
    return { success: false, error: 'A product with this URL slug already exists.' };
  }

  // Validate category_id FK — if provided but not found, set to null to avoid FOREIGN KEY constraint failed (ephemeral DB may have empty categories)
  let categoryId: string | null = p.category_id ?? null;
  if (categoryId) {
    const catExists = await db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId) as any;
    if (!catExists) {
      console.warn(`[adminSaveProduct] category_id ${categoryId} not found, setting to null to avoid FK fail`);
      categoryId = null;
    }
  }

  await db.transaction(async () => {
    if (id) {
      await db.prepare(`
        UPDATE products
        SET category_id = ?, name = ?, slug = ?, description = ?, brand = ?,
            active = ?, featured = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(categoryId, p.name, p.slug, p.description, p.brand, p.active ? 1 : 0, p.featured ? 1 : 0, id);

      if (imageUrl) {
        await db.prepare('DELETE FROM product_images WHERE product_id = ?').run(id);
        await db.prepare(`
          INSERT INTO product_images (id, product_id, url, alt, position)
          VALUES (?, ?, ?, ?, 0)
        `).run(crypto.randomUUID(), id, imageUrl, p.name);
      }

      await logAudit(admin.id, 'update_product', 'product', id, p);
    } else {
      const newId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO products (
          id, category_id, name, slug, description, brand, active, featured, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(newId, categoryId, p.name, p.slug, p.description, p.brand, p.active ? 1 : 0, p.featured ? 1 : 0);

      if (imageUrl) {
        await db.prepare(`
          INSERT INTO product_images (id, product_id, url, alt, position)
          VALUES (?, ?, ?, ?, 0)
        `).run(crypto.randomUUID(), newId, imageUrl, p.name);
      }

      await logAudit(admin.id, 'create_product', 'product', newId, p);
    }
  })();

  revalidatePath('/admin/products');
  revalidatePath('/catalog');
  return { success: true };
}

export async function adminDeleteProductAction(productId: string): Promise<AdminActionResponse> {
  const admin = await requireAdmin();
  await db.prepare('DELETE FROM products WHERE id = ?').run(productId);
  await logAudit(admin.id, 'delete_product', 'product', productId);
  revalidatePath('/admin/products');
  revalidatePath('/catalog');
  return { success: true };
}

export async function adminSaveVariantAction(prevState: any, formData: FormData): Promise<AdminActionResponse> {
  const admin = await requireAdmin();
  const id = String(formData.get('id') || '');
  const productId = String(formData.get('productId') || '');

  if (!productId) return { success: false, error: 'Product ID is missing' };

  const raw = {
    sku: String(formData.get('sku') || '').trim().toUpperCase(),
    name: String(formData.get('name') || '').trim(),
    options_json: String(formData.get('options_json') || '{}'),
    price_cents: Math.round(parseFloat(String(formData.get('price_rand') || '0')) * 100),
    compare_at_price_cents: formData.get('compare_at_rand')
      ? Math.round(parseFloat(String(formData.get('compare_at_rand'))) * 100)
      : null,
    cost_cents: formData.get('cost_rand')
      ? Math.round(parseFloat(String(formData.get('cost_rand'))) * 100)
      : null,
    stock_qty: parseInt(String(formData.get('stock_qty') || '0'), 10),
    low_stock_threshold: parseInt(String(formData.get('low_stock_threshold') || '5'), 10),
    weight_g: parseInt(String(formData.get('weight_g') || '0'), 10),
    barcode: String(formData.get('barcode') || '').trim() || null,
    active: formData.get('active') === 'on',
  };

  const parsed = variantSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid variant inputs' };
  }

  const v = parsed.data;

  // SKU unique check
  const skuCheck = await db.prepare('SELECT id FROM product_variants WHERE sku = ? AND id != ?').get(v.sku, id);
  if (skuCheck) {
    return { success: false, error: `SKU "${v.sku}" is already assigned to another variant.` };
  }

  await db.transaction(async () => {
    if (id) {
      const oldVariant = await db.prepare('SELECT stock_qty FROM product_variants WHERE id = ?').get(id) as any;
      const stockDiff = v.stock_qty - (oldVariant?.stock_qty || 0);

      await db.prepare(`
        UPDATE product_variants
        SET sku = ?, name = ?, options_json = ?, price_cents = ?,
            compare_at_price_cents = ?, cost_cents = ?, stock_qty = ?,
            low_stock_threshold = ?, weight_g = ?, barcode = ?, active = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        v.sku, v.name, v.options_json, v.price_cents,
        v.compare_at_price_cents, v.cost_cents, v.stock_qty,
        v.low_stock_threshold, v.weight_g, v.barcode, v.active ? 1 : 0, id
      );

      if (stockDiff !== 0) {
        await db.prepare(`
          INSERT INTO stock_movements (id, variant_id, delta, reason, note, created_at)
          VALUES (?, ?, ?, 'admin_adjustment', 'Admin variant update', datetime('now'))
        `).run(crypto.randomUUID(), id, stockDiff);
      }

      await logAudit(admin.id, 'update_variant', 'product_variant', id, v);
    } else {
      const newId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO product_variants (
          id, product_id, sku, name, options_json, price_cents, compare_at_price_cents,
          cost_cents, stock_qty, low_stock_threshold, weight_g, barcode, active, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')
        )
      `).run(
        newId, productId, v.sku, v.name, v.options_json, v.price_cents,
        v.compare_at_price_cents, v.cost_cents, v.stock_qty,
        v.low_stock_threshold, v.weight_g, v.barcode, v.active ? 1 : 0
      );

      await db.prepare(`
        INSERT INTO stock_movements (id, variant_id, delta, reason, note, created_at)
        VALUES (?, ?, ?, 'admin_adjustment', 'Initial variant stock creation', datetime('now'))
      `).run(crypto.randomUUID(), newId, v.stock_qty);

      await logAudit(admin.id, 'create_variant', 'product_variant', newId, v);
    }
  })();

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath('/catalog');
  return { success: true };
}

export async function adminAdjustStockAction(prevState: any, formData: FormData): Promise<AdminActionResponse> {
  const admin = await requireAdmin();
  const variantId = String(formData.get('variantId') || '');
  const delta = parseInt(String(formData.get('delta') || '0'), 10);
  const note = String(formData.get('note') || 'Manual stock adjustment').trim();

  if (!variantId || delta === 0) {
    return { success: false, error: 'Valid variant and non-zero adjustment delta are required' };
  }

  const variant = await db.prepare('SELECT id, stock_qty, product_id FROM product_variants WHERE id = ?').get(variantId) as any;
  if (!variant) return { success: false, error: 'Variant not found' };

  const newStock = variant.stock_qty + delta;
  if (newStock < 0) {
    return { success: false, error: `Stock cannot be negative. Current stock is ${variant.stock_qty}` };
  }

  await db.transaction(async () => {
    await db.prepare(`
      UPDATE product_variants SET stock_qty = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newStock, variantId);

    await db.prepare(`
      INSERT INTO stock_movements (id, variant_id, delta, reason, note, created_at)
      VALUES (?, ?, ?, 'admin_adjustment', ?, datetime('now'))
    `).run(crypto.randomUUID(), variantId, delta, note);

    await logAudit(admin.id, 'adjust_stock', 'product_variant', variantId, { delta, newStock, note });
  })();

  revalidatePath('/admin/products');
  return { success: true };
}

// -------------------------------------------------------------
// Categories
// -------------------------------------------------------------
export async function adminSaveCategoryAction(prevState: any, formData: FormData): Promise<AdminActionResponse> {
  const admin = await requireAdmin();
  const id = String(formData.get('id') || '');

  const raw = {
    name: String(formData.get('name') || '').trim(),
    slug: String(formData.get('slug') || '').trim().toLowerCase(),
    description: String(formData.get('description') || '').trim(),
    parent_id: String(formData.get('parent_id') || '') || null,
    active: formData.get('active') === 'on',
    sort_order: parseInt(String(formData.get('sort_order') || '0'), 10),
  };

  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid category inputs' };
  }

  const c = parsed.data;

  // Slug check
  const slugCheck = await db.prepare('SELECT id FROM categories WHERE slug = ? AND id != ?').get(c.slug, id);
  if (slugCheck) {
    return { success: false, error: 'A category with this slug already exists.' };
  }

  if (id) {
    await db.prepare(`
      UPDATE categories
      SET name = ?, slug = ?, description = ?, parent_id = ?, active = ?, sort_order = ?
      WHERE id = ?
    `).run(c.name, c.slug, c.description, c.parent_id, c.active ? 1 : 0, c.sort_order, id);
    await logAudit(admin.id, 'update_category', 'category', id, c);
  } else {
    const newId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO categories (id, name, slug, description, parent_id, active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(newId, c.name, c.slug, c.description, c.parent_id, c.active ? 1 : 0, c.sort_order);
    await logAudit(admin.id, 'create_category', 'category', newId, c);
  }

  revalidatePath('/admin/categories');
  revalidatePath('/catalog');
  return { success: true };
}

export async function adminDeleteCategoryAction(categoryId: string): Promise<AdminActionResponse> {
  const admin = await requireAdmin();
  await db.prepare('DELETE FROM categories WHERE id = ?').run(categoryId);
  await logAudit(admin.id, 'delete_category', 'category', categoryId);
  revalidatePath('/admin/categories');
  revalidatePath('/catalog');
  return { success: true };
}

// -------------------------------------------------------------
// Orders & Invoices Management
// -------------------------------------------------------------
export async function adminUpdateOrderStatusAction(
  orderId: string,
  newStatus: string,
  note: string = ''
): Promise<AdminActionResponse> {
  const admin = await requireAdmin();

  const allowedStatuses = ['pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
  if (!allowedStatuses.includes(newStatus)) {
    return { success: false, error: 'Invalid order status' };
  }

  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) return { success: false, error: 'Order not found' };

  await db.transaction(async () => {
    // If transitioning to cancelled/refunded, restore inventory
    if ((newStatus === 'cancelled' || newStatus === 'refunded') && order.status !== 'cancelled' && order.status !== 'refunded') {
      const items = await db.prepare('SELECT variant_id, qty FROM order_items WHERE order_id = ?').all(orderId) as any[];
      for (const item of items) {
        if (item.variant_id) {
          await db.prepare(`
            UPDATE product_variants SET stock_qty = stock_qty + ?, updated_at = datetime('now') WHERE id = ?
          `).run(item.qty, item.variant_id);

          await db.prepare(`
            INSERT INTO stock_movements (id, variant_id, delta, reason, order_id, note, created_at)
            VALUES (?, ?, ?, 'order_cancelled', ?, 'Stock restored from order cancellation', datetime('now'))
          `).run(crypto.randomUUID(), item.variant_id, item.qty, orderId);
        }
      }
    }

    await db.prepare(`
      UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(newStatus, orderId);

    // Update invoice status accordingly
    if (newStatus === 'paid') {
      await db.prepare(`
        UPDATE invoices SET status = 'paid', amount_paid_cents = total_cents, updated_at = datetime('now') WHERE order_id = ?
      `).run(orderId);
    } else if (newStatus === 'cancelled') {
      await db.prepare(`
        UPDATE invoices SET status = 'void', updated_at = datetime('now') WHERE order_id = ?
      `).run(orderId);
    } else if (newStatus === 'refunded') {
      await db.prepare(`
        UPDATE invoices SET status = 'refunded', updated_at = datetime('now') WHERE order_id = ?
      `).run(orderId);
    }

    await db.prepare(`
      INSERT INTO order_events (id, order_id, actor_id, type, note, created_at)
      VALUES (?, ?, ?, 'status_change', ?, datetime('now'))
    `).run(crypto.randomUUID(), orderId, admin.id, `Status updated to ${newStatus}. ${note}`);

    await logAudit(admin.id, 'update_order_status', 'order', orderId, { oldStatus: order.status, newStatus, note });
  })();

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/orders');
  return { success: true };
}

// -------------------------------------------------------------
// Coupons Management
// -------------------------------------------------------------
export async function adminSaveCouponAction(prevState: any, formData: FormData): Promise<AdminActionResponse> {
  const admin = await requireAdmin();
  const id = String(formData.get('id') || '');

  const type = String(formData.get('type') || 'percent') as 'percent' | 'fixed' | 'free_shipping';
  let value = 0;
  if (type === 'percent') {
    value = parseInt(String(formData.get('value_percent') || '0'), 10);
  } else if (type === 'fixed') {
    value = Math.round(parseFloat(String(formData.get('value_rand') || '0')) * 100);
  }

  const raw = {
    code: String(formData.get('code') || '').trim().toUpperCase(),
    type,
    value,
    min_subtotal_cents: Math.round(parseFloat(String(formData.get('min_subtotal_rand') || '0')) * 100),
    max_discount_cents: formData.get('max_discount_rand')
      ? Math.round(parseFloat(String(formData.get('max_discount_rand'))) * 100)
      : null,
    usage_limit: formData.get('usage_limit')
      ? parseInt(String(formData.get('usage_limit')), 10)
      : null,
    one_per_customer: formData.get('one_per_customer') === 'on',
    active: formData.get('active') === 'on',
    starts_at: String(formData.get('starts_at') || '') || null,
    expires_at: String(formData.get('expires_at') || '') || null,
  };

  const parsed = couponSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid coupon details' };
  }

  const c = parsed.data;

  // Code uniqueness
  const codeCheck = await db.prepare('SELECT id FROM coupons WHERE code = ? COLLATE NOCASE AND id != ?').get(c.code, id);
  if (codeCheck) {
    return { success: false, error: `Coupon code "${c.code}" already exists.` };
  }

  if (id) {
    await db.prepare(`
      UPDATE coupons
      SET code = ?, type = ?, value = ?, min_subtotal_cents = ?, max_discount_cents = ?,
          usage_limit = ?, one_per_customer = ?, active = ?, starts_at = ?, expires_at = ?
      WHERE id = ?
    `).run(
      c.code, c.type, c.value, c.min_subtotal_cents, c.max_discount_cents,
      c.usage_limit, c.one_per_customer ? 1 : 0, c.active ? 1 : 0, c.starts_at, c.expires_at, id
    );
    await logAudit(admin.id, 'update_coupon', 'coupon', id, c);
  } else {
    const newId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO coupons (
        id, code, type, value, min_subtotal_cents, max_discount_cents,
        usage_limit, used_count, one_per_customer, active, starts_at, expires_at, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, 0, ?, ?, ?, ?, datetime('now')
      )
    `).run(
      newId, c.code, c.type, c.value, c.min_subtotal_cents, c.max_discount_cents,
      c.usage_limit, c.one_per_customer ? 1 : 0, c.active ? 1 : 0, c.starts_at, c.expires_at
    );
    await logAudit(admin.id, 'create_coupon', 'coupon', newId, c);
  }

  revalidatePath('/admin/coupons');
  return { success: true };
}

export async function adminToggleCouponAction(couponId: string): Promise<AdminActionResponse> {
  const admin = await requireAdmin();
  await db.prepare('UPDATE coupons SET active = 1 - active WHERE id = ?').run(couponId);
  await logAudit(admin.id, 'toggle_coupon', 'coupon', couponId);
  revalidatePath('/admin/coupons');
  return { success: true };
}

export async function adminDeleteCouponAction(couponId: string): Promise<AdminActionResponse> {
  const admin = await requireAdmin();
  await db.prepare('DELETE FROM coupons WHERE id = ?').run(couponId);
  await logAudit(admin.id, 'delete_coupon', 'coupon', couponId);
  revalidatePath('/admin/coupons');
  return { success: true };
}

// -------------------------------------------------------------
// Store Settings
// -------------------------------------------------------------
export async function adminSaveSettingsAction(prevState: any, formData: FormData): Promise<AdminActionResponse> {
  const admin = await requireAdmin();

  const settingsPayload = {
    store_name: String(formData.get('store_name') || '').trim(),
    contact_email: String(formData.get('contact_email') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    address_line1: String(formData.get('address_line1') || '').trim(),
    address_line2: String(formData.get('address_line2') || '').trim(),
    city: String(formData.get('city') || '').trim(),
    province: String(formData.get('province') || '').trim(),
    postal_code: String(formData.get('postal_code') || '').trim(),
    currency: 'ZAR',
    tax_enabled: formData.get('tax_enabled') === 'on',
    tax_rate_percent: parseFloat(String(formData.get('tax_rate_percent') || '0')),
    free_shipping_enabled: formData.get('free_shipping_enabled') === 'on',
    free_shipping_threshold_cents: Math.round(parseFloat(String(formData.get('free_shipping_threshold_rand') || '0')) * 100),
    standard_base_cents: Math.round(parseFloat(String(formData.get('standard_base_rand') || '0')) * 100),
    express_base_cents: Math.round(parseFloat(String(formData.get('express_base_rand') || '0')) * 100),
    weight_threshold_g: parseInt(String(formData.get('weight_threshold_g') || '5000'), 10),
    weight_surcharge_cents: Math.round(parseFloat(String(formData.get('weight_surcharge_rand') || '0')) * 100),
    express_weight_surcharge_cents: Math.round(parseFloat(String(formData.get('express_weight_surcharge_rand') || '0')) * 100),
    invoice_prefix: String(formData.get('invoice_prefix') || 'INV').trim(),
    order_prefix: String(formData.get('order_prefix') || 'ORD').trim(),
    invoice_due_days: parseInt(String(formData.get('invoice_due_days') || '14'), 10),
    bank_name: String(formData.get('bank_name') || '').trim(),
    bank_account_name: String(formData.get('bank_account_name') || '').trim(),
    bank_account_number: String(formData.get('bank_account_number') || '').trim(),
    bank_branch_code: String(formData.get('bank_branch_code') || '').trim(),
    bank_reference_note: String(formData.get('bank_reference_note') || '').trim(),
    vat_number: String(formData.get('vat_number') || '').trim(),
  };

  try {
    await updateStoreSettings(settingsPayload);
    await logAudit(admin.id, 'update_settings', 'settings', 'store', settingsPayload);
    revalidatePath('/admin/settings');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update store settings' };
  }
}

// -------------------------------------------------------------
// Customer Privacy & Access
// -------------------------------------------------------------
export async function adminProcessErasureAction(requestId: string): Promise<AdminActionResponse> {
  const admin = await requireAdmin();
  const ok = await processErasure(requestId, admin.id);
  if (!ok) return { success: false, error: 'Could not process erasure request' };

  revalidatePath('/admin/customers');
  return { success: true };
}

export const adminExecuteErasureAction = adminProcessErasureAction;

export async function adminToggleUserStatusAction(userId: string): Promise<AdminActionResponse> {
  const admin = await requireAdmin();
  await db.prepare(`
    UPDATE users
    SET status = CASE WHEN status = 'active' THEN 'disabled' ELSE 'active' END,
        updated_at = datetime('now')
    WHERE id = ? AND role != 'admin'
  `).run(userId);

  await logAudit(admin.id, 'toggle_user_status', 'user', userId);
  revalidatePath('/admin/customers');
  return { success: true };
}
