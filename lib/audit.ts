import crypto from 'node:crypto';
import { db } from './db';

export async function logAudit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  data?: Record<string, any>
): Promise<void> {
  try {
    const id = crypto.randomUUID();
    // Ensure sensitive fields are never saved to audit logs
    let sanitizedData: Record<string, any> | null = null;
    if (data) {
      sanitizedData = { ...data };
      for (const key of [
        'password',
        'password_hash',
        'current_password',
        'new_password',
        'confirm_password',
        'token',
        'token_hash',
        'cardNumber',
        'card_number',
        'cvc',
        'cvv',
        'bank_account_number',
        'bank_branch_code',
        'bank_account_name',
      ]) {
        delete sanitizedData[key];
      }
    }

    await db.prepare(`
      INSERT INTO audit_logs (id, actor_id, action, entity, entity_id, data_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      id,
      actorId,
      action,
      entity,
      entityId ?? null,
      sanitizedData ? JSON.stringify(sanitizedData) : null
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
