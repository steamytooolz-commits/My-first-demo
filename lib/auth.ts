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
  account_type?: 'retail' | 'trade';
  trade_status?: 'none' | 'pending' | 'approved' | 'rejected';
  business_name?: string;
  trade_vat_number?: string;
  cipc_number?: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const TRADE_USER_DEFAULTS = {
  account_type: 'retail',
  trade_status: 'none',
  business_name: '',
  trade_vat_number: '',
  cipc_number: '',
} as const;

function withTradeDefaults<T extends object>(row: T): T {
  return { ...TRADE_USER_DEFAULTS, ...row } as T;
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
 * - Minimum 8 characters (matches lib/validation.ts, Zod, and UI)
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

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || 'dev-fallback-secret-change-me-in-prod-32chars!';
}

function base64UrlEncode(input: Buffer | string): string {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return b.toString('base64url');
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

function signJwt(payload: Record<string, any>): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(data).digest();
  return `${data}.${base64UrlEncode(sig)}`;
}

function verifyJwt(token: string): { sub: string; exp: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const data = `${headerB64}.${payloadB64}`;
    const expectedSig = base64UrlEncode(crypto.createHmac('sha256', getSessionSecret()).update(data).digest());
    if (!crypto.timingSafeEqual(Buffer.from(sigB64), Buffer.from(expectedSig))) return null;
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf-8'));
    if (!payload.sub || !payload.exp) return null;
    if (Date.now() > payload.exp * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Create a new user session and set cookie
 * Now creates both a DB session (for local persistence) and a stateless JWT fallback for Vercel ephemeral /tmp
 */
export async function createSession(userId: string, ip?: string, userAgent?: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  // Stateless JWT — survives Vercel /tmp per-instance DB loss
  const expSeconds = Math.floor(Date.now() / 1000) + SESSION_DURATION_DAYS * 24 * 60 * 60;
  const jwtPayload = { sub: userId, exp: expSeconds, iat: Math.floor(Date.now() / 1000) };
  const rawToken = signJwt(jwtPayload);
  const tokenHash = hashSessionToken(rawToken);

  const expiresAt = new Date(expSeconds * 1000).toISOString();

  try {
    await db.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, ip, user_agent)
      VALUES (?, ?, ?, ?, datetime('now'), ?, ?)
    `).run(sessionId, userId, tokenHash, expiresAt, ip ?? null, userAgent ?? null);
  } catch (e) {
    // On Vercel /tmp, DB may be fresh — JWT still works, so don't fail
    console.warn('[auth] DB session insert failed, using JWT only:', (e as Error).message);
  }

  try {
    const cookieStore = await cookies();
    const isProd = process.env.NODE_ENV === 'production';
    cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
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
      try {
        const tokenHash = hashSessionToken(token);
        await db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      } catch {}
    }

    const isProd = process.env.NODE_ENV === 'production';
    cookieStore.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
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
 * Supports both DB sessions (local) and stateless JWT fallback (Vercel /tmp ephemeral).
 */
export async function getSessionUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const tokenHash = hashSessionToken(token);
    const now = new Date().toISOString();

    // 1. Try DB session (fast path, works locally and when DB is shared)
    try {
      let row: User | undefined;
      try {
        row = await db.prepare(`
          SELECT
            u.id, u.email, u.full_name, u.phone, u.role, u.status,
            u.marketing_consent, u.poia_processing_consent_at,
            u.account_type, u.trade_status, u.business_name, u.trade_vat_number, u.cipc_number,
            u.created_at, u.updated_at, u.deleted_at
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE s.token_hash = ?
            AND s.expires_at > ?
            AND u.status = 'active'
            AND u.deleted_at IS NULL
        `).get(tokenHash, now) as User | undefined;
      } catch (colErr) {
        // Pre-003 DBs without trade columns — legacy select + defaults
        if (!/no such column/i.test(String((colErr as Error)?.message || ''))) throw colErr;
        row = await db.prepare(`
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
      }

      if (row) return withTradeDefaults(row);
    } catch (dbErr) {
      console.warn('[auth] DB session lookup failed, trying JWT fallback:', (dbErr as Error).message);
    }

    // 2. Fallback: stateless JWT verification (survives Vercel per-instance /tmp loss)
    const jwt = verifyJwt(token);
    if (jwt) {
      try {
        const user = await db.prepare(`
          SELECT id, email, full_name, phone, role, status, marketing_consent, poia_processing_consent_at,
            account_type, trade_status, business_name, trade_vat_number, cipc_number, created_at, updated_at, deleted_at
          FROM users WHERE id = ? AND status='active' AND deleted_at IS NULL
        `).get(jwt.sub) as User | undefined;
        if (user) return withTradeDefaults(user);
      } catch (colErr) {
        if (!/no such column/i.test(String((colErr as Error)?.message || ''))) throw colErr;
        const user = await db.prepare(`
          SELECT id, email, full_name, phone, role, status, marketing_consent, poia_processing_consent_at, created_at, updated_at, deleted_at
          FROM users WHERE id = ? AND status='active' AND deleted_at IS NULL
        `).get(jwt.sub) as User | undefined;
        if (user) return withTradeDefaults(user);
      }
    }

    return null;
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
