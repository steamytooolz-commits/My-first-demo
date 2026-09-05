'use server';

import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { addressSchema } from '@/lib/validation';

export async function saveAddressAction(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string; addressId?: string }> {
  const user = await requireUser();

  const id = String(formData.get('id') || '');
  const raw = {
    label: String(formData.get('label') || 'Home'),
    full_name: String(formData.get('full_name') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    line1: String(formData.get('line1') || '').trim(),
    line2: String(formData.get('line2') || '').trim(),
    city: String(formData.get('city') || '').trim(),
    province: String(formData.get('province') || '').trim(),
    postal_code: String(formData.get('postal_code') || '').trim(),
    country: 'ZA',
    is_default: formData.get('is_default') === 'on',
  };

  const parsed = addressSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid address fields' };
  }

  const data = parsed.data;

  let savedId = id || '';
  try {
    await db.transaction(async () => {
      if (data.is_default) {
        await db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(user.id);
      }

      if (id) {
        const res = await db.prepare(`
          UPDATE addresses
          SET label = ?, full_name = ?, phone = ?, line1 = ?, line2 = ?,
              city = ?, province = ?, postal_code = ?, country = ?, is_default = ?
          WHERE id = ? AND user_id = ?
        `).run(
          data.label, data.full_name, data.phone, data.line1, data.line2 || '',
          data.city, data.province, data.postal_code, data.country, data.is_default ? 1 : 0,
          id, user.id
        ) as any;
        if (Number(res?.changes ?? 0) < 1) {
          throw new Error('ADDRESS_NOT_FOUND');
        }
        savedId = id;
      } else {
        const countRow = await db.prepare(`SELECT COUNT(*) as c FROM addresses WHERE user_id = ?`).get(user.id) as any;
        if (Number(countRow?.c ?? 0) >= 20) {
          throw new Error('ADDRESS_LIMIT');
        }
        const addressId = crypto.randomUUID();
        await db.prepare(`
          INSERT INTO addresses (
            id, user_id, label, full_name, phone, line1, line2,
            city, province, postal_code, country, is_default
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          addressId, user.id, data.label, data.full_name, data.phone, data.line1, data.line2 || '',
          data.city, data.province, data.postal_code, data.country, data.is_default ? 1 : 0
        );
        savedId = addressId;
      }
    })();
  } catch (e: any) {
    const msg = String(e?.message || '');
    if (msg.includes('ADDRESS_NOT_FOUND')) return { success: false, error: 'Address not found.' };
    if (msg.includes('ADDRESS_LIMIT')) return { success: false, error: 'Address book is full (20 saved addresses max). Delete one first.' };
    throw e;
  }

  revalidatePath('/account/addresses');
  revalidatePath('/checkout');
  return { success: true, addressId: savedId || undefined };
}

export async function deleteAddressAction(addressId: string): Promise<{ success: boolean }> {
  const user = await requireUser();
  await db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(addressId, user.id);
  revalidatePath('/account/addresses');
  revalidatePath('/checkout');
  return { success: true };
}

export async function setDefaultAddressAction(addressId: string): Promise<{ success: boolean }> {
  const user = await requireUser();
  await db.transaction(async () => {
    await db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(user.id);
    await db.prepare('UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?').run(addressId, user.id);
  })();
  revalidatePath('/account/addresses');
  revalidatePath('/checkout');
  return { success: true };
}
