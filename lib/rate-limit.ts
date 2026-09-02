import { db } from './db';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || now > record.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (record.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  record.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Check login attempts from SQLite login_attempts table as specified in Section 12:
 * "If 5 failed attempts for the same email and IP within 15 minutes, block login for 15 minutes"
 */
export function checkLoginThrottle(
  email: string,
  ip: string
): { allowed: boolean; remainingAttempts: number } {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const row = db.prepare(`
    SELECT COUNT(*) as failed_count
    FROM login_attempts
    WHERE email = ? COLLATE NOCASE
      AND ip = ?
      AND success = 0
      AND created_at >= ?
  `).get(email.trim().toLowerCase(), ip, fifteenMinutesAgo) as { failed_count: number };

  const failedCount = row?.failed_count ?? 0;
  const maxAttempts = 5;

  return {
    allowed: failedCount < maxAttempts,
    remainingAttempts: Math.max(0, maxAttempts - failedCount),
  };
}

export function recordLoginAttempt(email: string, ip: string, success: boolean): void {
  const id = crypto.randomUUID();
  const normalizedEmail = email.trim().toLowerCase();

  if (success) {
    db.prepare(`
      DELETE FROM login_attempts WHERE email = ? COLLATE NOCASE AND ip = ? AND success = 0
    `).run(normalizedEmail, ip);
  }

  db.prepare(`
    INSERT INTO login_attempts (id, email, ip, success, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(id, normalizedEmail, ip, success ? 1 : 0);
}
