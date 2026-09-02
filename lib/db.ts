import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Postgres support (free tier via Vercel/Neon)
let pgPool: any = null;
let isPg = false;
const pgUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
if (pgUrl && pgUrl.startsWith('postgres')) {
  isPg = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: pgUrl,
      ssl: pgUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 5,
    });
    console.log('[db] Using Postgres pool (free tier) — persistence enabled');
  } catch (e) {
    console.error('[db] Failed to init pg Pool, falling back to SQLite:', e);
    isPg = false;
  }
}

function getEffectiveDbPath(): string {
  const raw = process.env.DATABASE_FILE ?? './data/app.db';
  const isVercel = !!process.env.VERCEL;
  if (isVercel) {
    if (raw.startsWith('/var/task/')) {
      return raw.replace('/var/task', '/tmp');
    }
    if (raw.startsWith('/tmp/')) return raw;
    const cleaned = raw.replace(/^\.\//, '').replace(/^\//, '');
    return path.join('/tmp', cleaned);
  }
  return raw;
}

let dbPath = getEffectiveDbPath();
let dataDir = path.dirname(path.resolve(dbPath));

try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (err) {
  const fallbackDir = path.join('/tmp', 'data');
  try {
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    const fallbackPath = path.join(fallbackDir, path.basename(dbPath));
    if (dbPath !== fallbackPath) {
      console.warn(`[db] mkdir failed for ${dataDir} (${(err as Error).message}), falling back to ${fallbackPath}`);
      dbPath = fallbackPath;
      dataDir = fallbackDir;
    }
  } catch (fallbackErr) {
    console.error('[db] Failed to create fallback data dir', fallbackErr);
  }
}

// Vercel Blob persistence for better-sqlite3 (keeps /tmp DB across instances when pg not used)
// If BLOB_READ_WRITE_TOKEN is set, we sync /tmp DB to Blob after writes.
// This is best-effort; Postgres is preferred for strong consistency.
let blobSyncEnabled = false;
let blobUrl: string | null = process.env.BLOB_DATABASE_URL || null; // e.g., https://blob.vercel-storage.com/db-xxx.db
if (!isPg && process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_BLOB_SKIP) {
  blobSyncEnabled = true;
  console.log('[db] Blob sync enabled (ephemeral /tmp -> persistent Blob)');
  // Try to restore DB from Blob at startup (non-blocking, but do sync)
  try {
    if (blobUrl) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { head } = require('@vercel/blob');
      // head check is async, we do not block startup — background restore
      (async () => {
        try {
          const res = await fetch(blobUrl!);
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length > 0) {
              fs.writeFileSync(dbPath, buf);
              console.log(`[db] Restored DB from Blob (${buf.length} bytes) to ${dbPath}`);
              // Re-open DB after restore? better-sqlite3 already opened below — we need to handle before open.
            }
          }
        } catch (e) {
          console.warn('[db] Blob restore failed (will create fresh DB):', (e as Error).message);
        }
      })();
    }
  } catch {}
}

const globalForDb = globalThis as unknown as {
  db?: Database.Database;
  pgPool?: any;
};

const FALLBACK_SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin','customer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  marketing_consent INTEGER NOT NULL DEFAULT 0 CHECK (marketing_consent IN (0,1)),
  poia_processing_consent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ip TEXT,
  user_agent TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  brand TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '{}',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  compare_at_price_cents INTEGER,
  cost_cents INTEGER,
  stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  weight_g INTEGER NOT NULL DEFAULT 0,
  barcode TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  guest_token TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','converted','abandoned')),
  coupon_code TEXT,
  shipping_method TEXT NOT NULL DEFAULT 'standard',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (user_id IS NOT NULL AND guest_token IS NULL)
    OR
    (user_id IS NULL AND guest_token IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_cart_user ON carts(user_id) WHERE status = 'active' AND user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_cart_guest ON carts(guest_token) WHERE status = 'active' AND guest_token IS NOT NULL;
CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cart_id, variant_id)
);
CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  type TEXT NOT NULL CHECK (type IN ('percent','fixed','free_shipping')),
  value INTEGER NOT NULL DEFAULT 0,
  min_subtotal_cents INTEGER NOT NULL DEFAULT 0,
  max_discount_cents INTEGER,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  one_per_customer INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id TEXT PRIMARY KEY,
  coupon_id TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(coupon_id, user_id)
);
CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  line1 TEXT NOT NULL,
  line2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'ZA',
  is_default INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (
    status IN (
      'pending_payment',
      'paid',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'refunded'
    )
  ),
  currency TEXT NOT NULL DEFAULT 'ZAR',
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  shipping_cents INTEGER NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  tax_cents INTEGER NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  shipping_method TEXT NOT NULL,
  shipping_address_json TEXT NOT NULL,
  billing_address_json TEXT,
  coupon_code TEXT,
  customer_note TEXT,
  placed_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (discount_cents <= subtotal_cents),
  CHECK (total_cents = subtotal_cents - discount_cents + shipping_cents)
);
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
  variant_snapshot_json TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  line_subtotal_cents INTEGER NOT NULL CHECK (line_subtotal_cents >= 0),
  line_discount_cents INTEGER NOT NULL DEFAULT 0 CHECK (line_discount_cents >= 0),
  line_total_cents INTEGER NOT NULL CHECK (line_total_cents >= 0),
  tax_cents INTEGER NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  CHECK (line_discount_cents <= line_subtotal_cents),
  CHECK (line_total_cents = line_subtotal_cents - line_discount_cents)
);
CREATE TABLE IF NOT EXISTS order_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('sim_card','manual_eft','pay_on_delivery')),
  status TEXT NOT NULL CHECK (status IN ('pending','success','failed','refunded')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  gateway_ref TEXT,
  simulated_result_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (
    status IN ('draft','issued','paid','void','refunded')
  ),
  issue_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  discount_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  seller_json TEXT NOT NULL,
  buyer_json TEXT NOT NULL,
  line_items_json TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (total_cents = subtotal_cents - discount_cents + shipping_cents)
);
CREATE TABLE IF NOT EXISTS sequences (
  kind TEXT NOT NULL,
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, year)
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (
    reason IN ('order','order_cancelled','admin_adjustment','seed','return')
  ),
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  data_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS data_subject_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('export','erasure')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','approved','completed','rejected')
  ),
  reason TEXT,
  scheduled_for TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  ip TEXT NOT NULL,
  success INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email_ip ON login_attempts(email, ip);
`;

function ensureSchema(database: Database.Database) {
  try {
    const hasUsers = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get() as any;
    if (hasUsers) return;

    console.log('[db] Empty database detected, bootstrapping schema...');

    const candidates = [
      path.resolve('migrations'),
      path.join(process.cwd(), 'migrations'),
    ];

    let bootstrapped = false;
    for (const migrationsDir of candidates) {
      if (fs.existsSync(migrationsDir)) {
        const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
        if (files.length > 0) {
          for (const file of files) {
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
            database.exec(sql);
            try {
              database.prepare('INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)').run(file);
            } catch {}
            console.log(`[db] Applied migration ${file} from ${migrationsDir}`);
          }
          bootstrapped = true;
          break;
        }
      }
    }

    if (!bootstrapped) {
      console.warn('[db] No migration files found, using embedded fallback schema (001_init.sql)');
      database.exec(FALLBACK_SCHEMA);
      try {
        database.prepare('INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)').run('001_init.sql');
      } catch {}
      console.log('[db] Embedded schema applied');
    }
  } catch (e) {
    console.error('[db] Schema bootstrap failed:', e);
  }
}

let pgReady: Promise<void> | null = null;

// Postgres wrapper — mimics better-sqlite3 sync API but via async pool
function createPgWrapper(pool: any) {
  const wrap = {
    prepare: (sql: string) => {
      // Translate ? placeholders to $1, $2 for pg
      let idx = 0;
      const pgSql = sql.replace(/\?/g, () => `$${++idx}`);
      // SQLite -> Postgres dialect shims — generic datetime -> NOW()
      let shimmed = pgSql
        .replace(/COLLATE NOCASE/g, '')
        .replace(/INSERT OR IGNORE INTO sequences/g, 'INSERT INTO sequences')
        .replace(/INSERT OR IGNORE/g, 'INSERT')
        .replace(/ON CONFLICT\(key\) DO UPDATE SET value_json = excluded\.value_json/g, 'ON CONFLICT (key) DO UPDATE SET value_json = EXCLUDED.value_json')
        .replace(/ON CONFLICT\(key\) DO NOTHING/g, 'ON CONFLICT (key) DO NOTHING')
        .replace(/datetime\([^)]*\)/g, 'NOW()')
        .replace(/date\('now', '\+12 days'\)/g, "CURRENT_DATE + INTERVAL '12 days'")
        .replace(/date\('now', '\+14 days'\)/g, "CURRENT_DATE + INTERVAL '14 days'")
        .replace(/date\('now', '-2 days'\)/g, "CURRENT_DATE - INTERVAL '2 days'")
        .replace(/date\('now'\)/g, 'CURRENT_DATE');
      // Handle INSERT OR IGNORE without explicit ON CONFLICT — add DO NOTHING for sequences/schema_migrations
      if (shimmed.includes('INSERT INTO sequences') && !shimmed.includes('ON CONFLICT')) {
        shimmed = shimmed.replace('INSERT INTO sequences', 'INSERT INTO sequences ON CONFLICT (kind, year) DO NOTHING');
      }
      if (shimmed.includes('INSERT INTO schema_migrations') && !shimmed.includes('ON CONFLICT')) {
        shimmed = shimmed.replace('INSERT INTO schema_migrations', 'INSERT INTO schema_migrations ON CONFLICT (id) DO NOTHING');
      }

      const withPgReady = async (fn: () => Promise<any>) => {
        if (pgReady) await pgReady;
        return fn();
      };

      return {
        get: async (...params: any[]) => withPgReady(async () => {
          const res = await pool.query(shimmed, params);
          return res.rows[0];
        }),
        all: async (...params: any[]) => withPgReady(async () => {
          const res = await pool.query(shimmed, params);
          return res.rows;
        }),
        run: async (...params: any[]) => withPgReady(async () => {
          const res = await pool.query(shimmed, params);
          return { changes: res.rowCount, lastInsertRowid: res.rows[0]?.id };
        }),
      };
    },
    exec: async (sql: string) => {
      // Split by ; for pg
      const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of stmts) {
        if (stmt) await pool.query(stmt);
      }
    },
    transaction: (fn: any) => {
      return async (...args: any[]) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn(...args);
          await client.query('COMMIT');
          return result;
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      };
    },
    pragma: () => {},
  };
  return wrap;
}

// Export db — either pg wrapper (async) or better-sqlite3 (sync)
// For pg, we export async-compatible wrapper; callers must await.
// For sqlite, we export sync instance.
let db: any;

if (isPg && pgPool) {
  const pgWrapper: any = createPgWrapper(pgPool);
  pgWrapper.pragma = () => {};
  if (process.env.NODE_ENV !== 'production') {
    globalForDb.pgPool = pgPool;
  }
  db = pgWrapper;
  console.log('[db] Postgres mode — set DATABASE_URL to use free tier (Neon/Vercel). All queries are async (await required).');
  // Ensure schema for Postgres (blocking for first queries via pgReady)
  pgReady = (async () => {
    try {
      const hasUsers = await pgWrapper.prepare("SELECT table_name FROM information_schema.tables WHERE table_name='users'").get() as any;
      if (!hasUsers) {
        console.log('[db] Postgres empty, bootstrapping schema...');
        const stmts = FALLBACK_SCHEMA.split(';').map(s => s.trim()).filter(Boolean);
        for (const stmt of stmts) {
          try { await pgWrapper.exec(stmt); } catch (e) { console.warn('[db] PG schema stmt failed:', (e as Error).message.slice(0,200)); }
        }
        console.log('[db] Postgres schema bootstrapped');
      }
      // Seed admin/customer for Postgres as well
      try {
        const countRow = await pgWrapper.prepare('SELECT COUNT(*) as c FROM users').get() as any;
        const c = parseInt(countRow?.c ?? countRow?.count ?? 0, 10);
        if (c === 0) {
          console.log('[db] Postgres no users, seeding...');
          const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
          const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
          const adminId = '00000000-0000-4000-a000-000000000001';
          const now = new Date().toISOString();
          const hash = (p: string) => {
            const salt = crypto.randomBytes(16).toString('hex');
            const dk = crypto.scryptSync(p, salt, 64, { N: 16384, r: 8, p: 1 });
            return `scrypt:16384:8:1:${salt}:${dk.toString('hex')}`;
          };
          await pgWrapper.prepare(`INSERT INTO users (id, email, password_hash, full_name, phone, role, status, marketing_consent, poia_processing_consent_at, created_at, updated_at) VALUES (?, ?, ?, 'System Administrator', '', 'admin', 'active', 0, ?, ?, ?) ON CONFLICT(id) DO NOTHING`).run(adminId, adminEmail, hash(adminPassword), now, now, now);
          await pgWrapper.prepare(`INSERT INTO users (id, email, password_hash, full_name, phone, role, status, marketing_consent, poia_processing_consent_at, created_at, updated_at) VALUES (?, ?, ?, 'Thabo Mokoena', '', 'customer', 'active', 0, ?, ?, ?) ON CONFLICT(id) DO NOTHING`).run('00000000-0000-4000-a000-000000000002', 'customer@example.com', hash('Customer123!'), now, now, now);
          await pgWrapper.prepare(`INSERT INTO settings (key, value_json) VALUES ('store', ?) ON CONFLICT(key) DO NOTHING`).run(JSON.stringify({
            store_name: 'Paper & Quill Stationery', contact_email: 'hello@paperandquill.co.za', phone: '', address_line1: '42 Bram Fischer Drive', address_line2: 'Ferndale', city: 'Johannesburg', province: 'Gauteng', postal_code: '2194', country: 'ZA', currency: 'ZAR', tax_enabled: false, tax_rate_percent: 0, prices_include_tax: true, shipping_taxable: true, free_shipping_enabled: true, free_shipping_threshold_cents: 95000, standard_base_cents: 7500, express_base_cents: 15000, weight_threshold_g: 5000, weight_surcharge_cents: 2500, express_weight_surcharge_cents: 5000, invoice_prefix: 'INV', order_prefix: 'ORD', invoice_due_days: 14, bank_name: 'First National Bank', bank_account_name: 'Paper & Quill Stationery (Pty) Ltd', bank_account_number: '62000000000', bank_branch_code: '250655', bank_reference_note: 'Please use your Order Number as payment reference', vat_number: ''
          }));
          console.log('[db] Postgres seeded admin/customer');
        }
      } catch (e) { console.warn('[db] Postgres seed check failed:', (e as Error).message); }
    } catch (e) {
      console.error('[db] Postgres bootstrap failed, falling back to SQLite for this request:', e);
      // Do not crash — will fallback to SQLite on next cold start if needed, but for now let pg errors surface as 500 so user sees issue
    }
  })();
} else {
  const sqliteDb =
    globalForDb.db ??
    new Database(dbPath);

  sqliteDb.pragma('foreign_keys = ON');
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('busy_timeout = 5000');

  ensureSchema(sqliteDb);
  ensureDefaultSeed(sqliteDb);

  if (process.env.NODE_ENV !== 'production') {
    globalForDb.db = sqliteDb;
  }

  // Wrap sqlite to also support async API for uniform `await` usage
  const sqliteWrapper: any = {
    prepare: (sql: string) => {
      const stmt: any = sqliteDb.prepare(sql);
      return {
        get: async (...params: any[]) => stmt.get(...params),
        all: async (...params: any[]) => stmt.all(...params),
        run: async (...params: any[]) => stmt.run(...params),
      };
    },
    exec: async (sql: string) => sqliteDb.exec(sql),
    transaction: (fn: any) => {
      // Support both sync and async transaction callbacks
      return async (...args: any[]) => {
        try {
          sqliteDb.exec('BEGIN');
          const result = await fn(...args);
          sqliteDb.exec('COMMIT');
          return result;
        } catch (e) {
          try { sqliteDb.exec('ROLLBACK'); } catch {}
          throw e;
        }
      };
    },
    pragma: (s: string) => sqliteDb.pragma(s),
    _raw: sqliteDb,
  };
  db = sqliteWrapper;
}

if (!isPg) {
  // Blob upload after writes (best-effort)
  if (blobSyncEnabled) {
    const originalPrepare = db.prepare.bind(db);
    db.prepare = (sql: string) => {
      const stmt: any = originalPrepare(sql);
      const origRun = stmt.run.bind(stmt);
      stmt.run = (...params: any[]) => {
        const res = origRun(...params);
        // Fire-and-forget Blob upload after mutation
        if (sql.trim().toUpperCase().startsWith('INSERT') || sql.trim().toUpperCase().startsWith('UPDATE') || sql.trim().toUpperCase().startsWith('DELETE')) {
          (async () => {
            try {
              const buf = fs.readFileSync(dbPath);
              const { put } = await import('@vercel/blob');
              const blob = await put('db/app.db', buf, { access: 'public', allowOverwrite: true, addRandomSuffix: false });
              blobUrl = blob.url;
              process.env.BLOB_DATABASE_URL = blob.url;
              console.log(`[db] Blob sync uploaded ${buf.length} bytes to ${blob.url}`);
            } catch (e) {
              console.warn('[db] Blob upload failed:', (e as Error).message);
            }
          })();
        }
        return res;
      };
      return stmt;
    };
  }
}

export { db, isPg, pgPool };

function hashPasswordForSeed(password: string): string {
  const N = 16384;
  const r = 8;
  const p = 1;
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64, { N, r, p });
  return `scrypt:${N}:${r}:${p}:${salt}:${derivedKey.toString('hex')}`;
}

function ensureDefaultSeed(database: Database.Database) {
  try {
    const hasUsersTable = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get() as any;
    if (!hasUsersTable) return;
    const countRow = database.prepare('SELECT COUNT(*) as c FROM users').get() as any;
    if (countRow && countRow.c > 0) return;

    console.log('[db] No users found, seeding default demo accounts...');

    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    // Use deterministic UUIDs so JWT sub remains valid across ephemeral /tmp resets (fixes 3-click login)
    const adminId = '00000000-0000-4000-a000-000000000001';
    const now = new Date().toISOString();

    try {
      database.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, phone, role, status, marketing_consent, poia_processing_consent_at, created_at, updated_at)
        VALUES (?, ?, ?, 'System Administrator', '', 'admin', 'active', 0, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).run(adminId, adminEmail, hashPasswordForSeed(adminPassword), now, now, now);
      // If admin already exists with different email (e.g., env change), ensure password is updated to env value
      try {
        database.prepare(`UPDATE users SET password_hash = ?, email = ?, updated_at = ? WHERE id = ?`).run(hashPasswordForSeed(adminPassword), adminEmail, now, adminId);
      } catch {}
      console.log(`[db] Seeded admin: ${adminEmail} (deterministic id)`);
    } catch (e) {
      console.warn('[db] Admin seed skipped:', (e as Error).message);
    }

    if (process.env.SEED_DEMO !== 'false') {
      const demoEmail = 'customer@example.com';
      const demoPassword = 'Customer123!';
      const demoId = '00000000-0000-4000-a000-000000000002';
      try {
        database.prepare(`
          INSERT INTO users (id, email, password_hash, full_name, phone, role, status, marketing_consent, poia_processing_consent_at, created_at, updated_at)
          VALUES (?, ?, ?, 'Thabo Mokoena', '', 'customer', 'active', 0, ?, ?, ?)
        `).run(demoId, demoEmail, hashPasswordForSeed(demoPassword), now, now, now);

        database.prepare(`
          INSERT INTO addresses (id, user_id, label, full_name, phone, line1, line2, city, province, postal_code, country, is_default)
          VALUES (?, ?, 'Home', 'Thabo Mokoena', '', '12 Protea Lane', 'Apt 4B', 'Rosebank', 'Gauteng', '2196', 'ZA', 1)
        `).run(crypto.randomUUID(), demoId);
        console.log(`[db] Seeded customer: ${demoEmail} / ${demoPassword}`);
      } catch (e) {
        console.warn('[db] Customer seed skipped:', (e as Error).message);
      }
    }

    try {
      const hasSettings = database.prepare("SELECT key FROM settings WHERE key='store'").get() as any;
      if (!hasSettings) {
        const storeSettings = {
          store_name: 'Paper & Quill Stationery',
          contact_email: 'hello@paperandquill.co.za',
          phone: '',
          address_line1: '42 Bram Fischer Drive',
          address_line2: 'Ferndale',
          city: 'Johannesburg',
          province: 'Gauteng',
          postal_code: '2194',
          country: 'ZA',
          currency: 'ZAR',
          tax_enabled: false,
          tax_rate_percent: 0,
          prices_include_tax: true,
          shipping_taxable: true,
          free_shipping_enabled: true,
          free_shipping_threshold_cents: 95000,
          standard_base_cents: 7500,
          express_base_cents: 15000,
          weight_threshold_g: 5000,
          weight_surcharge_cents: 2500,
          express_weight_surcharge_cents: 5000,
          invoice_prefix: 'INV',
          order_prefix: 'ORD',
          invoice_due_days: 14,
          bank_name: 'First National Bank',
          bank_account_name: 'Paper & Quill Stationery (Pty) Ltd',
          bank_account_number: '62000000000',
          bank_branch_code: '250655',
          bank_reference_note: 'Please use your Order Number as payment reference',
          vat_number: '',
        };
        database.prepare(`INSERT INTO settings (key, value_json) VALUES ('store', ?) ON CONFLICT(key) DO NOTHING`).run(JSON.stringify(storeSettings));
        console.log('[db] Seeded store settings');
      }
    } catch {}
  } catch (e) {
    console.error('[db] Default seed failed:', e);
  }
}
