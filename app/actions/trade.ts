'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import { tradeApplicationSchema } from '@/lib/validation';

export interface TradeActionResponse {
  success: boolean;
  error?: string;
}

async function ensureTradeSchema(): Promise<void> {
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS trade_applications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        business_name TEXT NOT NULL,
        trade_vat_number TEXT NOT NULL DEFAULT '',
        cipc_number TEXT NOT NULL DEFAULT '',
        contact_person TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        trade_references TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
        reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } catch {}
  for (const col of [
    "ALTER TABLE users ADD COLUMN account_type TEXT NOT NULL DEFAULT 'retail'",
    "ALTER TABLE users ADD COLUMN trade_status TEXT NOT NULL DEFAULT 'none'",
    "ALTER TABLE users ADD COLUMN business_name TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE users ADD COLUMN trade_vat_number TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE users ADD COLUMN cipc_number TEXT NOT NULL DEFAULT ''",
  ]) {
    try {
      await db.exec(col);
    } catch (e) {
      if (!/duplicate column|already exists/i.test(String((e as Error)?.message || ''))) throw e;
    }
  }
}

export async function submitTradeApplicationAction(prevState: any, formData: FormData): Promise<TradeActionResponse> {
  const user = await requireUser();
  const tradeLimit = await checkRateLimit(`trade:${user.id}`, 3, 24 * 60 * 60 * 1000);
  if (!tradeLimit.allowed) {
    return { success: false, error: 'Too many trade applications. Please contact support.' };
  }
  await ensureTradeSchema();

  const raw = {
    business_name: String(formData.get('business_name') || '').trim(),
    trade_vat_number: String(formData.get('trade_vat_number') || '').trim(),
    cipc_number: String(formData.get('cipc_number') || '').trim(),
    contact_person: String(formData.get('contact_person') || '').trim() || user.full_name,
    phone: String(formData.get('phone') || '').trim() || user.phone,
    trade_references: String(formData.get('trade_references') || '').trim().slice(0, 1000),
  };
  const parsed = tradeApplicationSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid trade application' };
  }
  const d = parsed.data;

  const me = await db.prepare(`SELECT trade_status FROM users WHERE id = ?`).get(user.id) as any;
  if (me?.trade_status === 'approved') return { success: false, error: 'This account is already approved for trade.' };
  if (me?.trade_status === 'pending') return { success: false, error: 'A trade application is already under review.' };

  await db.transaction(async () => {
    await db.prepare(`INSERT INTO trade_applications (id, user_id, business_name, trade_vat_number, cipc_number, contact_person, phone, trade_references, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`)
      .run(crypto.randomUUID(), user.id, d.business_name, d.trade_vat_number, d.cipc_number, d.contact_person, d.phone, d.trade_references);
    try {
      await db.prepare(`UPDATE users SET trade_status = 'pending', business_name = ?, trade_vat_number = ?, cipc_number = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(d.business_name, d.trade_vat_number, d.cipc_number, user.id);
    } catch (e) {
      if (/no such column/i.test(String((e as Error)?.message || ''))) {
        await ensureTradeSchema();
        await db.prepare(`UPDATE users SET trade_status = 'pending', business_name = ?, trade_vat_number = ?, cipc_number = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(d.business_name, d.trade_vat_number, d.cipc_number, user.id);
      } else throw e;
    }
    await logAudit(user.id, 'submit_trade_application', 'trade', user.id, { business: d.business_name });
  })();

  revalidatePath('/account/trade');
  revalidatePath('/admin/customers');
  return { success: true };
}
