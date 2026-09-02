'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import crypto from 'node:crypto';
import { db } from '@/lib/db';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  getSessionUser,
  requireUser,
} from '@/lib/auth';
import { mergeGuestCart } from '@/lib/cart';
import { checkLoginThrottle, recordLoginAttempt } from '@/lib/rate-limit';
import { registerSchema, loginSchema, profileUpdateSchema, changePasswordSchema } from '@/lib/validation';

export interface ActionResponse {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  redirectTo?: string;
}

export async function loginAction(prevState: any, formData: FormData): Promise<ActionResponse> {
  const rawEmail = String(formData.get('email') || '').trim();
  const rawPassword = String(formData.get('password') || '');
  const redirectTo = String(formData.get('redirectTo') || '/account');

  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  // 1. Validate inputs
  const parsed = loginSchema.safeParse({ email: rawEmail, password: rawPassword });
  if (!parsed.success) {
    return {
      success: false,
      error: 'Please enter a valid email and password.',
    };
  }

  const email = parsed.data.email.toLowerCase();

  // 2. Check login throttle (Section 12: 5 attempts per 15 min per email+ip)
  const throttle = await checkLoginThrottle(email, ip);
  if (!throttle.allowed) {
    return {
      success: false,
      error: 'Too many failed login attempts. For security, access is temporarily locked for 15 minutes.',
    };
  }

  // 3. Look up user
  const user = await db.prepare(`
    SELECT id, email, password_hash, status, role, deleted_at
    FROM users
    WHERE email = ? COLLATE NOCASE
  `).get(email) as any;

  if (!user || user.status !== 'active' || user.deleted_at !== null) {
    await recordLoginAttempt(email, ip, false);
    return {
      success: false,
      error: 'Invalid email or password.',
    };
  }

  // 4. Verify password
  const valid = verifyPassword(rawPassword, user.password_hash);
  if (!valid) {
    await recordLoginAttempt(email, ip, false);
    return {
      success: false,
      error: 'Invalid email or password.',
    };
  }

  // Success: record attempt & create session
  await recordLoginAttempt(email, ip, true);
  await createSession(user.id, ip, headersList.get('user-agent') || undefined);

  // Merge any active guest cart
  await mergeGuestCart(user.id);

  revalidatePath('/', 'layout');

  const destination = user.role === 'admin' && redirectTo === '/account' ? '/admin' : redirectTo;
  return {
    success: true,
    redirectTo: destination,
  };
}

export async function registerAction(prevState: any, formData: FormData): Promise<ActionResponse> {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  const raw = {
    email: String(formData.get('email') || '').trim(),
    password: String(formData.get('password') || ''),
    full_name: String(formData.get('full_name') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    poia_consent: formData.get('poia_consent') === 'on',
    marketing_consent: formData.get('marketing_consent') === 'on',
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) {
        fieldErrors[issue.path[0].toString()] = issue.message;
      }
    }
    return {
      success: false,
      error: 'Please correct the highlighted errors.',
      fieldErrors,
    };
  }

  const { email, password, full_name, phone, marketing_consent } = parsed.data;

  // Check uniqueness
  const existing = await db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (existing) {
    return {
      success: false,
      error: 'An account with this email address already exists. Please sign in.',
    };
  }

  const userId = crypto.randomUUID();
  const passwordHashed = hashPassword(password);
  const now = new Date().toISOString();

  await db.prepare(`
    INSERT INTO users (
      id, email, password_hash, full_name, phone, role, status,
      marketing_consent, poia_processing_consent_at, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, 'customer', 'active',
      ?, ?, ?, ?
    )
  `).run(
    userId,
    email.toLowerCase(),
    passwordHashed,
    full_name,
    phone || '',
    marketing_consent ? 1 : 0,
    now,
    now,
    now
  );

  await createSession(userId, ip, headersList.get('user-agent') || undefined);
  await mergeGuestCart(userId);

  revalidatePath('/', 'layout');
  return {
    success: true,
    redirectTo: '/account',
  };
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function updateProfileAction(prevState: any, formData: FormData): Promise<ActionResponse> {
  const user = await requireUser();

  const raw = {
    full_name: String(formData.get('full_name') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    marketing_consent: formData.get('marketing_consent') === 'on',
  };

  const parsed = profileUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'Invalid profile information' };
  }

  await db.prepare(`
    UPDATE users
    SET full_name = ?, phone = ?, marketing_consent = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    parsed.data.full_name,
    parsed.data.phone,
    parsed.data.marketing_consent ? 1 : 0,
    user.id
  );

  revalidatePath('/account');
  return { success: true };
}

export async function changePasswordAction(prevState: any, formData: FormData): Promise<ActionResponse> {
  const user = await requireUser();

  const raw = {
    current_password: String(formData.get('current_password') || ''),
    new_password: String(formData.get('new_password') || ''),
    confirm_password: String(formData.get('confirm_password') || ''),
  };

  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || 'Invalid password inputs' };
  }

  const currentUser = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id) as any;
  if (!currentUser || !verifyPassword(raw.current_password, currentUser.password_hash)) {
    return { success: false, error: 'Current password is incorrect' };
  }

  const newHash = hashPassword(raw.new_password);
  await db.prepare(`
    UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?
  `).run(newHash, user.id);

  revalidatePath('/account');
  return { success: true };
}
