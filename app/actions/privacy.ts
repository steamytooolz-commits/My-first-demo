'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { verifyPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { requestAccountErasure } from '@/lib/privacy';

export async function requestErasureAction(prevState: any, formData: FormData): Promise<{ success: boolean; scheduledFor?: string; error?: string }> {
  const user = await requireUser();
  const reason = String(formData.get('reason') || '').trim();
  const password = String(formData.get('password') || '');
  const immediate = formData.get('immediate') === 'on';

  // JP Freelance staging lock: secondary password confirmation before erasure (human-quality gate)
  if (!password) {
    return { success: false, error: 'Please confirm your password to request erasure.' };
  }
  const row = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as any;
  if (!row || !verifyPassword(password, row.password_hash)) {
    return { success: false, error: 'Password confirmation failed. Erasure not scheduled.' };
  }

  const result = await requestAccountErasure(user.id, reason, immediate);
  revalidatePath('/account/privacy');
  return result;
}
