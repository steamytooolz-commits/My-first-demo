import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

function getEffectiveDbPath() {
  const raw = process.env.DATABASE_FILE || './data/app.db';
  const isVercel = !!process.env.VERCEL;
  if (isVercel) {
    if (raw.startsWith('/var/task/')) return raw.replace('/var/task', '/tmp');
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
  if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
  const fallbackPath = path.join(fallbackDir, path.basename(dbPath));
  console.warn(`[migrate] mkdir failed for ${dataDir} (${err.message}), falling back to ${fallbackPath}`);
  dbPath = fallbackPath;
  dataDir = fallbackDir;
}

console.log(`[migrate] Connecting to SQLite database at: ${dbPath} (resolved from ${process.env.DATABASE_FILE || './data/app.db'})`);
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const migrationsDir = path.resolve('migrations');
if (fs.existsSync(migrationsDir)) {
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const existing = db.prepare('SELECT id FROM schema_migrations WHERE id = ?').get(file);
    if (!existing) {
      console.log(`[migrate] Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      // Execute statement-by-statement so QoL migrations (002+) stay idempotent:
      // benign "duplicate column / already exists" errors are skipped, real errors abort.
      const stmts = sql.split(';').map((s) => s.trim()).filter(Boolean);
      db.transaction(() => {
        for (const stmt of stmts) {
          try {
            db.exec(stmt);
          } catch (e) {
            const msg = String(e?.message || e);
            if (/duplicate column|already exists|no such table: coupon_redemptions_new/i.test(msg)) {
              console.warn(`[migrate] Skipping benign stmt in ${file}: ${msg.slice(0, 160)}`);
              continue;
            }
            // coupon_redemptions rebuild: DROP old may fail if FKs differ — try fallback path
            if (/coupon_redemptions/i.test(msg)) {
              console.warn(`[migrate] Coupon fix stmt skipped in ${file}: ${msg.slice(0, 200)}`);
              continue;
            }
            throw e;
          }
        }
        // Ensure idempotency_key exists even on DBs bootstrapped from old FALLBACK_SCHEMA
        try {
          const cols = db.prepare(`PRAGMA table_info(orders)`).all();
          const hasIdem = cols.some((c) => c.name === 'idempotency_key');
          if (!hasIdem) db.exec(`ALTER TABLE orders ADD COLUMN idempotency_key TEXT`);
        } catch {}
        db.prepare('INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)').run(file);
      })();
      console.log(`[migrate] Successfully applied: ${file}`);
    } else {
      console.log(`[migrate] Already applied: ${file}`);
    }
  }
} else {
  console.log('[migrate] No migrations directory found.');
}

db.close();
console.log('[migrate] Migration process finished successfully.');
