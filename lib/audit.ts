import crypto from 'node:crypto';
import { db } from './db';

export function logAudit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  data?: Record<string, any>
): void {
  try {
    const id = crypto.randomUUID();
    // Ensure sensitive fields are never saved to audit logs
    let sanitizedData: Record<string, any> | null = null;
    if (data) {
      sanitizedData = { ...data };
      delete sanitizedData.password;
      delete sanitizedData.password_hash;
      delete sanitizedData.token;
      delete sanitizedData.token_hash;
      delete sanitizedData.cardNumber;
    }

    db.prepare(`
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
