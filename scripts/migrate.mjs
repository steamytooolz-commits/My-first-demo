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
      db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(file);
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
