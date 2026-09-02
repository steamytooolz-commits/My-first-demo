'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { requestAccountErasure } from '@/lib/privacy';

export async function requestErasureAction(prevState: any, formData: FormData): Promise<{ success: boolean; scheduledFor?: string; error?: string }> {
  const user = await requireUser();
  const reason = String(formData.get('reason') || '').trim();

  const result = await requestAccountErasure(user.id, reason);
  revalidatePath('/account/privacy');
  return result;
}
