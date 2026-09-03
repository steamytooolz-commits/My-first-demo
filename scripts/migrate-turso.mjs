// Turso (LibSQL) schema migration — staging persistence on Vercel.
// Applies migrations/*.sql to the Turso database (same SQLite dialect, zero schema changes).
// Usage:
//   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." node scripts/migrate-turso.mjs
// CI usage (local file, no cloud):
//   TURSO_DATABASE_URL="file:/tmp/turso-ci.db" node scripts/migrate-turso.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error('[migrate-turso] Error: TURSO_DATABASE_URL is not set.');
  console.error('  Local dev / VPS: use `node scripts/migrate.mjs` (better-sqlite3 file) instead.');
  process.exit(1);
}

const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
console.log(`[migrate-turso] Connecting to Turso database: ${url.replace(/:[^:@/]+@/, ':***@')}`);
const client = createClient({ url, authToken });

await client.execute(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const migrationsDir = path.resolve('migrations');
if (fs.existsSync(migrationsDir)) {
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const existing = (await client.execute({ sql: 'SELECT id FROM schema_migrations WHERE id = ?', args: [file] })).rows[0];
    if (!existing) {
      console.log(`[migrate-turso] Applying migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      const stmts = sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of stmts) {
        await client.execute(stmt);
      }
      await client.execute({ sql: 'INSERT INTO schema_migrations (id) VALUES (?)', args: [file] });
      console.log(`[migrate-turso] Successfully applied: ${file}`);
    } else {
      console.log(`[migrate-turso] Already applied: ${file}`);
    }
  }
} else {
  console.log('[migrate-turso] No migrations directory found.');
}

console.log('[migrate-turso] Migration process finished successfully.');
