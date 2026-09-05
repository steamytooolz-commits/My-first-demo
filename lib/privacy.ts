import crypto from 'node:crypto';
import { db } from './db';
import { User } from './auth';

export interface CustomerDataExport {
  exported_at: string;
  user: Partial<User>;
  addresses: any[];
  orders: any[];
  invoices: any[];
  payments: any[];
  privacy_requests: any[];
}

/**
 * Generate full personal data export as JSON
 */
export async function generateCustomerExport(userId: string): Promise<CustomerDataExport> {
  let user: any;
  try {
    user = await db.prepare(`
      SELECT id, email, full_name, phone, role, status, marketing_consent,
             poia_processing_consent_at, account_type, trade_status, business_name,
             trade_vat_number, cipc_number, created_at, updated_at
      FROM users WHERE id = ?
    `).get(userId) as any;
  } catch {
    user = await db.prepare(`
      SELECT id, email, full_name, phone, role, status, marketing_consent,
             poia_processing_consent_at, created_at, updated_at
      FROM users WHERE id = ?
    `).get(userId) as any;
  }

  const addresses = await db.prepare(`SELECT * FROM addresses WHERE user_id = ?`).all(userId);
  const orders = await db.prepare(`SELECT * FROM orders WHERE user_id = ?`).all(userId);

  const orderIds = orders.map((o: any) => o.id);
  let invoices: any[] = [];
  let payments: any[] = [];

  if (orderIds.length > 0) {
    const placeholders = orderIds.map(() => '?').join(',');
    invoices = await db.prepare(`SELECT * FROM invoices WHERE order_id IN (${placeholders})`).all(...orderIds);
    payments = await db.prepare(`SELECT * FROM payments WHERE order_id IN (${placeholders})`).all(...orderIds);
  }

  const privacyRequests = await db.prepare(`SELECT * FROM data_subject_requests WHERE user_id = ?`).all(userId);

  return {
    exported_at: new Date().toISOString(),
    user,
    addresses,
    orders,
    invoices,
    payments,
    privacy_requests: privacyRequests,
  };
}

/**
 * Request account erasure under POPIA
 */
export async function requestAccountErasure(userId: string, reason?: string, immediate = false): Promise<{ success: boolean; scheduledFor: string; error?: string }> {
  const existing = await db.prepare(`
    SELECT id, scheduled_for FROM data_subject_requests
    WHERE user_id = ? AND type = 'erasure' AND status = 'pending'
  `).get(userId) as { id: string; scheduled_for: string } | undefined;

  if (existing) {
    return { success: true, scheduledFor: existing.scheduled_for };
  }

  const id = crypto.randomUUID();
  const scheduledFor = immediate
    ? new Date().toISOString()
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db.prepare(`
    INSERT INTO data_subject_requests (id, user_id, type, status, reason, scheduled_for, created_at)
    VALUES (?, ?, 'erasure', 'pending', ?, ?, datetime('now'))
  `).run(id, userId, reason || 'Customer requested account erasure via privacy portal', scheduledFor);

  return { success: true, scheduledFor };
}

/**
 * Process an erasure request (anonymize user profile, delete sessions and addresses, redact order records)
 */
export async function processErasure(requestId: string, actorId?: string): Promise<boolean> {
  const { isPg } = await import('./db');
  const exec = async () => {
    const request = await db.prepare(`
      SELECT * FROM data_subject_requests WHERE id = ?
    `).get(requestId) as any;

    if (!request || request.status === 'completed') return false;

    const userId = request.user_id;
    const now = new Date().toISOString();

    // 1. Delete all sessions
    await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);

    // 2. Delete all saved addresses
    await db.prepare(`DELETE FROM addresses WHERE user_id = ?`).run(userId);

    // 3. Anonymize user profile
    const anonymousEmail = `erased-${userId}@invalid.local`;
    await db.prepare(`
      UPDATE users
      SET 
        email = ?,
        full_name = 'Erased',
        phone = '',
        password_hash = '!',
        status = 'disabled',
        marketing_consent = 0,
        deleted_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(anonymousEmail, now, now, userId);

    // 4. Redact shipping/billing address on historical orders
    const redactedAddress = JSON.stringify({
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
      SET 
        email = ?,
        shipping_address_json = ?,
        billing_address_json = ?,
        customer_note = NULL,
        updated_at = ?
      WHERE user_id = ?
    `).run(anonymousEmail, redactedAddress, redactedAddress, now, userId);

    // 5. Redact buyer_json on retained invoices
    const redactedBuyer = JSON.stringify({
      name: '[REDACTED - POPIA ERASURE]',
      email: anonymousEmail,
      phone: '',
      address_line1: '[REDACTED]',
      city: '[REDACTED]',
      province: '[REDACTED]',
      postal_code: '0000',
      country: 'ZA',
    });

    await db.prepare(`
      UPDATE invoices
      SET buyer_json = ?, updated_at = ?
      WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?)
    `).run(redactedBuyer, now, userId);

    // 6. Complete request
    await db.prepare(`
      UPDATE data_subject_requests
      SET status = 'completed', completed_at = ?
      WHERE id = ?
    `).run(now, requestId);

    // 7. Audit log
    await db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, entity, entity_id, data_json, created_at)
      VALUES (?, ?, 'process_erasure', 'user', ?, ?, datetime('now'))
    `).run(crypto.randomUUID(), actorId ?? null, userId, JSON.stringify({ requestId, anonymized: true }));

    return true;
  };
  if (isPg) {
    return await (db as any).transaction(exec)();
  } else {
    return (db as any).transaction(exec)();
  }
}
