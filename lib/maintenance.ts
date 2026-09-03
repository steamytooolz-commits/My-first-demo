import crypto from 'node:crypto';
import { db } from './db';

// Deterministic maintenance for VPS/SQLite staging (JP Freelance lock).
// Mirrors scripts/carts-abandon.mjs, orders-expire.mjs, privacy-process.mjs
// but runs inline via admin action so no Vercel Cron / shell needed.

export async function abandonStaleCarts(): Promise<{ abandoned: number }> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const result = await db.prepare(`
    UPDATE carts
    SET status = 'abandoned', updated_at = datetime('now')
    WHERE status = 'active' AND updated_at < ?
  `).run(cutoff) as any;
  return { abandoned: result?.changes ?? 0 };
}

export async function expireStaleOrders(): Promise<{ expired: number }> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const expiredOrders = await db.prepare(`
    SELECT id, order_number FROM orders
    WHERE status = 'pending_payment' AND placed_at < ?
  `).all(cutoff) as any[];

  for (const order of expiredOrders) {
    await db.transaction(async () => {
      const items = await db.prepare(`
        SELECT variant_id, qty FROM order_items WHERE order_id = ?
      `).all(order.id) as any[];

      for (const item of items) {
        if (item.variant_id) {
          await db.prepare(`
            UPDATE product_variants
            SET stock_qty = stock_qty + ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(item.qty, item.variant_id);

          await db.prepare(`
            INSERT INTO stock_movements (id, variant_id, delta, reason, order_id, note, created_at)
            VALUES (?, ?, ?, 'order_cancelled', ?, 'Expired pending payment order cancelled', datetime('now'))
          `).run(crypto.randomUUID(), item.variant_id, item.qty, order.id);
        }
      }

      await db.prepare(`
        UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?
      `).run(order.id);

      await db.prepare(`
        UPDATE invoices SET status = 'void', updated_at = datetime('now') WHERE order_id = ?
      `).run(order.id);

      await db.prepare(`
        INSERT INTO order_events (id, order_id, type, note, created_at)
        VALUES (?, ?, 'order_expired', 'Order automatically expired after 7 days without payment', datetime('now'))
      `).run(crypto.randomUUID(), order.id);
    })();
  }

  return { expired: expiredOrders.length };
}

export async function processDueErasures(): Promise<{ processed: number }> {
  const now = new Date().toISOString();
  const due = await db.prepare(`
    SELECT id, user_id FROM data_subject_requests
    WHERE type = 'erasure' AND status = 'pending' AND scheduled_for <= ?
  `).all(now) as any[];

  let processed = 0;
  for (const req of due) {
    const userId = req.user_id;
    await db.transaction(async () => {
      await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
      await db.prepare('DELETE FROM addresses WHERE user_id = ?').run(userId);

      const anonymousEmail = `erased-${userId}@invalid.local`;
      await db.prepare(`
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

      await db.prepare(`
        UPDATE orders
        SET email = ?, shipping_address_json = ?, billing_address_json = ?, customer_note = NULL, updated_at = ?
        WHERE user_id = ?
      `).run(anonymousEmail, redacted, redacted, now, userId);

      await db.prepare(`
        UPDATE invoices
        SET buyer_json = ?, updated_at = ?
        WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?)
      `).run(redacted, now, userId);

      await db.prepare(`
        UPDATE data_subject_requests
        SET status = 'completed', completed_at = ?
        WHERE id = ?
      `).run(now, req.id);
    })();
    processed += 1;
  }

  return { processed };
}

export async function runAllMaintenance(): Promise<{ abandoned: number; expired: number; processed: number }> {
  const a = await abandonStaleCarts();
  const e = await expireStaleOrders();
  const p = await processDueErasures();
  return { abandoned: a.abandoned, expired: e.expired, processed: p.processed };
}
