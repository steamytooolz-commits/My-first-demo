import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

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
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
} catch (err) {
  const fallbackDir = path.join('/tmp', 'data');
  if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
  const fallbackPath = path.join(fallbackDir, path.basename(dbPath));
  console.warn(`[carts-abandon] mkdir failed for ${dataDir} (${err.message}), falling back to ${fallbackPath}`);
  dbPath = fallbackPath;
}
const db = new Database(path.resolve(dbPath));

console.log('[carts-abandon] Marking stale carts as abandoned...');
const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const result = db.prepare(`
  UPDATE carts
  SET status = 'abandoned', updated_at = datetime('now')
  WHERE status = 'active' AND updated_at < ?
`).run(cutoff);

console.log(`[carts-abandon] Marked ${result.changes} carts as abandoned.`);
db.close();
