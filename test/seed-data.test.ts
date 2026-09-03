import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { SEED_PRODUCTS, SEED_CATEGORIES, SEED_COUPONS } from '../lib/seed-data';

// process.cwd() is the repo root when running `bun run test` / `vitest run`
// (more reliable than __dirname under vitest's ESM transform).
const root = process.cwd();

describe('seed catalogue data', () => {
  it('contains 15 products across 5 categories', () => {
    expect(SEED_PRODUCTS).toHaveLength(15);
    expect(SEED_CATEGORIES).toHaveLength(5);
    const slugs = new Set(SEED_PRODUCTS.map(p => p.slug));
    expect(slugs.size).toBe(15);
    for (const p of SEED_PRODUCTS) {
      expect(SEED_CATEGORIES.map(c => c.slug)).toContain(p.category);
    }
  });

  it('has unique SKUs with valid ZAR pricing', () => {
    const skus = SEED_PRODUCTS.flatMap(p => p.variants.map(v => v.sku));
    expect(skus.length).toBeGreaterThanOrEqual(15);
    expect(new Set(skus).size).toBe(skus.length);
    for (const p of SEED_PRODUCTS) {
      expect(p.variants.length).toBeGreaterThan(0);
      for (const v of p.variants) {
        expect(Number.isInteger(v.price_cents) && v.price_cents > 0).toBe(true);
        expect(Number.isInteger(v.stock_qty) && v.stock_qty >= 0).toBe(true);
      }
      expect(p.image).toMatch(/^\/seed\/.+\.svg$/);
    }
  });

  it('ships a placeholder image file for every product', () => {
    const dir = path.join(root, 'public', 'seed');
    const available = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
    for (const p of SEED_PRODUCTS) {
      const file = path.join(dir, p.image.replace(/^\/seed\//, ''));
      expect(
        fs.existsSync(file),
        `missing ${p.image} (root=${root}, have: ${available.join(',') || 'none'})`
      ).toBe(true);
    }
  });

  it('stays in sync with scripts/seed.mjs and scripts/seed-turso.mjs', () => {
    const sqlite = fs.readFileSync(path.join(root, 'scripts/seed.mjs'), 'utf-8');
    const turso = fs.readFileSync(path.join(root, 'scripts/seed-turso.mjs'), 'utf-8');
    for (const p of SEED_PRODUCTS) {
      expect(sqlite, `seed.mjs missing ${p.slug}`).toContain(`slug: '${p.slug}'`);
      expect(turso, `seed-turso.mjs missing ${p.slug}`).toContain(`slug: '${p.slug}'`);
      for (const v of p.variants) {
        expect(sqlite, `seed.mjs missing ${v.sku}`).toContain(v.sku);
        expect(turso, `seed-turso.mjs missing ${v.sku}`).toContain(v.sku);
      }
    }
    for (const c of SEED_COUPONS) {
      expect(turso, `seed-turso.mjs missing coupon ${c.code}`).toContain(c.code);
    }
  });
});
