import { db } from './db';

export function nextSequence(kind: 'order' | 'invoice', prefix: string): string {
  const year = new Date().getUTCFullYear();

  // Try transactional sequence, fallback to random suffix if UNIQUE collision (Vercel /tmp per-instance)
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return db.transaction(() => {
        db.prepare(`
          INSERT OR IGNORE INTO sequences (kind, year, last_number)
          VALUES (?, ?, 0)
        `).run(kind, year);

        db.prepare(`
          UPDATE sequences
          SET last_number = last_number + 1
          WHERE kind = ? AND year = ?
        `).run(kind, year);

        const row = db.prepare(`
          SELECT last_number
          FROM sequences
          WHERE kind = ? AND year = ?
        `).get(kind, year) as { last_number: number };

        return `${prefix}-${year}-${String(row.last_number).padStart(6, '0')}`;
      })();
    } catch (e: any) {
      // If UNIQUE constraint fails due to per-instance DB desync, retry with jitter
      if (attempt === maxRetries - 1) {
        // Final fallback: timestamp + random
        const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
        return `${prefix}-${year}-${Date.now().toString().slice(-6)}${rand}`;
      }
    }
  }
  // Fallback (should not reach)
  return `${prefix}-${year}-${String(Date.now()).slice(-6)}`;
}
