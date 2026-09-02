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
  console.warn(`[privacy-process] mkdir failed for ${dataDir} (${err.message}), falling back to ${fallbackPath}`);
  dbPath = fallbackPath;
}
const db = new Database(path.resolve(dbPath));
db.pragma('foreign_keys = ON');

console.log('[privacy-process] Processing due POPIA erasure requests...');

const now = new Date().toISOString();
const dueRequests = db.prepare(`
  SELECT id, user_id FROM data_subject_requests
  WHERE type = 'erasure' AND status = 'pending' AND scheduled_for <= ?
`).all(now);

console.log(`[privacy-process] Found ${dueRequests.length} requests ready to process.`);

for (const req of dueRequests) {
  const userId = req.user_id;
  console.log(`[privacy-process] Anonymizing user ${userId}...`);

  db.transaction(() => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM addresses WHERE user_id = ?').run(userId);

    const anonymousEmail = `erased-${userId}@invalid.local`;
    db.prepare(`
      UPDATE users
      SET email = ?, full_name = 'Erased', phone = '', password_hash = '!',
          status = 'disabled', marketing_consent = 0, deleted_at = ?, updated_at = ?
      WHERE id = ?
    `).run(anonymousEmail, now, now, userId);

    const redacted = JSON.stringify({
      full_name: '[REDACTED - POPIA ERASURE]',
      phone: '',
      line1: '[REDACTED]',
      line2: '',
      city: '[REDACTED]',
      province: '[REDACTED]',
      postal_code: '0000',
      country: 'ZA',
    });

    db.prepare(`
      UPDATE orders
      SET email = ?, shipping_address_json = ?, billing_address_json = ?, customer_note = NULL, updated_at = ?
      WHERE user_id = ?
    `).run(anonymousEmail, redacted, redacted, now, userId);

    db.prepare(`
      UPDATE invoices
      SET buyer_json = ?, updated_at = ?
      WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?)
    `).run(redacted, now, userId);

    db.prepare(`
      UPDATE data_subject_requests
      SET status = 'completed', completed_at = ?
      WHERE id = ?
    `).run(now, req.id);
  })();

  console.log(`[privacy-process] Completed erasure for ${userId}`);
}

db.close();
console.log('[privacy-process] Done.');
