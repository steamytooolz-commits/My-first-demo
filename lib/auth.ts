import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './db';

export const SESSION_COOKIE_NAME = 'jpf_session';
const SESSION_DURATION_DAYS = 30;

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: 'admin' | 'customer';
  status: 'active' | 'disabled';
  marketing_consent: number;
  poia_processing_consent_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Hash password with scrypt
 * Format: scrypt:N:r:p:salt:hash
 */
export function hashPassword(password: string): string {
  const N = 16384;
  const r = 8;
  const p = 1;
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64, { N, r, p });
  return `scrypt:${N}:${r}:${p}:${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify password against stored hash with timingSafeEqual
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      return false;
    }
    const N = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    const salt = parts[4];
    const originalHash = Buffer.from(parts[5], 'hex');

    const testHash = crypto.scryptSync(password, salt, 64, { N, r, p });

    if (testHash.length !== originalHash.length) {
      return false;
    }
    return crypto.timingSafeEqual(testHash, originalHash);
  } catch {
    return false;
  }
}

/**
 * Validate password requirements:
 * - Minimum 10 characters
 * - At least one letter
 * - At least one number
 */
export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  return { valid: true };
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new user session and set cookie
 */
export async function createSession(userId: string, ip?: string, userAgent?: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(rawToken);

  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, ip, user_agent)
    VALUES (?, ?, ?, ?, datetime('now'), ?, ?)
  `).run(sessionId, userId, tokenHash, expiresAt, ip ?? null, userAgent ?? null);

  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    });
  } catch {
    // Handled in server action context
  }

  return rawToken;
}

/**
 * Destroy current session and clear cookie
 */
export async function destroySession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (token) {
      const tokenHash = hashSessionToken(token);
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    }

    cookieStore.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 0,
    });
  } catch {
    // Handled in server action context
  }
}

/**
 * Get the currently authenticated user from session cookie.
 * Returns null if not authenticated, disabled, or deleted.
 */
export async function getSessionUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const tokenHash = hashSessionToken(token);
    const now = new Date().toISOString();

    const row = db.prepare(`
      SELECT 
        u.id, u.email, u.full_name, u.phone, u.role, u.status,
        u.marketing_consent, u.poia_processing_consent_at,
        u.created_at, u.updated_at, u.deleted_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = ?
        AND s.expires_at > ?
        AND u.status = 'active'
        AND u.deleted_at IS NULL
    `).get(tokenHash, now) as User | undefined;

    if (!row) {
      return null;
    }

    return row;
  } catch (err) {
    console.error('Error in getSessionUser:', err);
    return null;
  }
}

/**
 * Require active authenticated user or redirect to login
 */
export async function requireUser(redirectTo: string = '/auth/login?redirectTo=/account'): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    redirect(redirectTo);
  }
  return user;
}

/**
 * Require active admin user or redirect to admin login
 */
export async function requireAdmin(redirectTo: string = '/auth/login?redirectTo=/admin'): Promise<User> {
  const user = await getSessionUser();
  if (!user) {
    redirect(redirectTo);
  }
  if (user.role !== 'admin') {
    redirect('/');
  }
  return user;
}
