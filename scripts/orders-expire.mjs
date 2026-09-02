import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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
  console.warn(`[orders-expire] mkdir failed for ${dataDir} (${err.message}), falling back to ${fallbackPath}`);
  dbPath = fallbackPath;
}
const db = new Database(path.resolve(dbPath));
db.pragma('foreign_keys = ON');

console.log('[orders-expire] Expiring stale pending orders...');
const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const expiredOrders = db.prepare(`
  SELECT id, order_number FROM orders
  WHERE status = 'pending_payment' AND placed_at < ?
`).all(cutoff);

console.log(`[orders-expire] Found ${expiredOrders.length} orders to expire.`);

for (const order of expiredOrders) {
  db.transaction(() => {
    // 1. Get items to return stock
    const items = db.prepare(`
      SELECT variant_id, qty FROM order_items WHERE order_id = ?
    `).all(order.id);

    for (const item of items) {
      if (item.variant_id) {
        db.prepare(`
          UPDATE product_variants
          SET stock_qty = stock_qty + ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(item.qty, item.variant_id);

        db.prepare(`
          INSERT INTO stock_movements (id, variant_id, delta, reason, order_id, note, created_at)
          VALUES (?, ?, ?, 'order_cancelled', ?, 'Expired pending payment order cancelled', datetime('now'))
        `).run(crypto.randomUUID(), item.variant_id, item.qty, order.id);
      }
    }

    // 2. Cancel order
    db.prepare(`
      UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?
    `).run(order.id);

    // 3. Void invoice
    db.prepare(`
      UPDATE invoices SET status = 'void', updated_at = datetime('now') WHERE order_id = ?
    `).run(order.id);

    // 4. Order event
    db.prepare(`
      INSERT INTO order_events (id, order_id, type, note, created_at)
      VALUES (?, ?, 'order_expired', 'Order automatically expired after 7 days without payment', datetime('now'))
    `).run(crypto.randomUUID(), order.id);
  })();

  console.log(`[orders-expire] Expired order ${order.order_number}`);
}

db.close();
console.log('[orders-expire] Done.');
