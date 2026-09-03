import crypto from 'node:crypto';
import { SEED_CATEGORIES, SEED_PRODUCTS, SEED_COUPONS } from './seed-data';

// Runtime catalogue auto-seed. Backend-agnostic: works against any db object
// exposing async get/run (better-sqlite3 wrapper and LibSQL wrapper both qualify).
// Idempotent (slug/SKU/code existence checks) and independent per entity, so it
// safely fills an empty catalogue on first boot without touching existing rows.

export interface SeedDb {
  get(sql: string, ...params: any[]): Promise<any>;
  run(sql: string, ...params: any[]): Promise<any>;
}

export async function seedCatalogIfEmpty(db: SeedDb): Promise<{ seeded: boolean; products: number }> {
  const prodCount = await db.get('SELECT COUNT(*) as c FROM products') as any;
  if (prodCount && Number(prodCount.c ?? 0) > 0) {
    return { seeded: false, products: Number(prodCount.c) };
  }
  if (process.env.SEED_DEMO === 'false') {
    return { seeded: false, products: 0 };
  }

  console.log('[seed] Catalogue empty, auto-seeding demo catalogue...');

  const categoryIdMap = new Map<string, string>();
  for (const cat of SEED_CATEGORIES) {
    const existing = await db.get('SELECT id FROM categories WHERE slug = ?', cat.slug) as any;
    if (!existing) {
      await db.run(
        'INSERT INTO categories (id, name, slug, description, active, sort_order) VALUES (?, ?, ?, ?, 1, ?)',
        cat.id, cat.name, cat.slug, cat.description, cat.sort_order
      );
    }
    categoryIdMap.set(cat.slug, existing?.id ?? cat.id);
  }

  for (const p of SEED_PRODUCTS) {
    const categoryId = categoryIdMap.get(p.category) ?? null;
    const existingProduct = await db.get('SELECT id FROM products WHERE slug = ?', p.slug) as any;
    let productId = existingProduct?.id;
    if (!existingProduct) {
      productId = crypto.randomUUID();
      await db.run(
        `INSERT INTO products (id, category_id, name, slug, description, brand, active, featured, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`,
        productId, categoryId, p.name, p.slug, p.description, p.brand, p.featured
      );
      await db.run(
        'INSERT INTO product_images (id, product_id, url, alt, position) VALUES (?, ?, ?, ?, 0)',
        crypto.randomUUID(), productId, p.image, p.name
      );
    }
    for (const v of p.variants) {
      const existingVariant = await db.get('SELECT id FROM product_variants WHERE sku = ?', v.sku) as any;
      if (!existingVariant) {
        const variantId = crypto.randomUUID();
        await db.run(
          `INSERT INTO product_variants (
             id, product_id, sku, name, options_json, price_cents, compare_at_price_cents,
             cost_cents, stock_qty, low_stock_threshold, weight_g, barcode, active, created_at, updated_at
           ) VALUES (?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?, NULL, 1, datetime('now'), datetime('now'))`,
          variantId, productId, v.sku, v.name, v.price_cents, v.compare_at_price_cents,
          v.cost_cents, v.stock_qty, v.low_stock_threshold, v.weight_g
        );
        await db.run(
          `INSERT INTO stock_movements (id, variant_id, delta, reason, note, created_at)
           VALUES (?, ?, ?, 'seed', 'Runtime catalogue auto-seed', datetime('now'))`,
          crypto.randomUUID(), variantId, v.stock_qty
        );
      }
    }
  }

  for (const c of SEED_COUPONS) {
    const existing = await db.get('SELECT id FROM coupons WHERE code = ? COLLATE NOCASE', c.code) as any;
    if (!existing) {
      await db.run(
        `INSERT INTO coupons (
           id, code, type, value, min_subtotal_cents, max_discount_cents,
           usage_limit, used_count, one_per_customer, active, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 1, datetime('now'))`,
        crypto.randomUUID(), c.code, c.type, c.value, c.min_subtotal_cents,
        c.max_discount_cents, c.usage_limit, c.one_per_customer
      );
    }
  }

  console.log(`[seed] Catalogue auto-seeded (${SEED_PRODUCTS.length} products).`);
  return { seeded: true, products: SEED_PRODUCTS.length };
}
