import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Staging lock smoke tests: guard the 48h SLA invariants without booting Next.js.
// - Schema drift: migrations must define every table the app queries.
// - Dependency lock: no pg / drizzle / Prisma may creep back in (SQLite-only via
//   better-sqlite3 locally, LibSQL on Turso — same dialect).
// - Route presence: critical staging demo routes must exist.

const root = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf-8');
}

describe('staging smoke', () => {
  it('migrations define all tables the app queries', () => {
    const sql = read('migrations/001_init.sql');
    const required = [
      'users', 'sessions', 'settings', 'categories', 'products',
      'product_images', 'product_variants', 'carts', 'cart_items',
      'coupons', 'coupon_redemptions', 'addresses', 'orders',
      'order_items', 'order_events', 'payments', 'invoices',
      'sequences', 'stock_movements', 'audit_logs',
      'data_subject_requests', 'login_attempts',
    ];
    for (const table of required) {
      expect(sql, `missing table ${table}`).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
    }
  });

  it('lib/db.ts stays on the SQLite dialect (no pg/drizzle shims)', () => {
    const db = read('lib/db.ts');
    expect(db).not.toMatch(/from ['"]pg['"]/);
    expect(db).not.toMatch(/drizzle-orm/);
    expect(db).not.toMatch(/information_schema/);
    expect(db).toMatch(/better-sqlite3/);
    expect(db).toMatch(/@libsql\/client/);
  });

  it('package.json keeps the staging dependency lock', () => {
    const pkg = JSON.parse(read('package.json'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps['@libsql/client']).toBeTruthy();
    expect(deps['better-sqlite3']).toBeTruthy();
    expect(deps['pg']).toBeUndefined();
    expect(deps['@types/pg']).toBeUndefined();
    expect(deps['motion']).toBeUndefined();
    expect(deps['drizzle-orm']).toBeUndefined();
    expect(deps['drizzle-kit']).toBeUndefined();
    expect(deps['prisma']).toBeUndefined();
  });

  it('critical demo routes exist', () => {
    const routes = [
      'app/page.tsx',
      'app/catalog/page.tsx',
      'app/products/[slug]/page.tsx',
      'app/cart/page.tsx',
      'app/checkout/page.tsx',
      'app/auth/login/page.tsx',
      'app/account/privacy/page.tsx',
      'app/admin/page.tsx',
      'app/admin/products/page.tsx',
      'app/admin/products/new/page.tsx',
      'app/invoices/[invoiceNumber]/page.tsx',
      'app/api/account/export/route.ts',
    ];
    for (const route of routes) {
      expect(fs.existsSync(path.join(root, route)), `missing route ${route}`).toBe(true);
    }
  });

  it('Turso env contract is documented', () => {
    const env = read('.env.example');
    expect(env).toContain('TURSO_DATABASE_URL');
    expect(env).toContain('TURSO_AUTH_TOKEN');
  });
});
