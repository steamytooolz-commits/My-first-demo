import { db, isPg } from './db';

export async function nextSequence(kind: 'order' | 'invoice', prefix: string): Promise<string> {
  const year = new Date().getUTCFullYear();

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (isPg) {
        // Postgres: use explicit transaction via pool
        const { pgPool } = await import('./db');
        const client = await pgPool.connect();
        try {
          await client.query('BEGIN');
          await client.query('INSERT INTO sequences (kind, year, last_number) VALUES ($1, $2, 0) ON CONFLICT (kind, year) DO NOTHING', [kind, year]);
          await client.query('UPDATE sequences SET last_number = last_number + 1 WHERE kind = $1 AND year = $2', [kind, year]);
          const res = await client.query('SELECT last_number FROM sequences WHERE kind = $1 AND year = $2', [kind, year]);
          await client.query('COMMIT');
          const row = res.rows[0] as { last_number: number };
          return `${prefix}-${year}-${String(row.last_number).padStart(6, '0')}`;
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      } else {
        // SQLite: async-capable transaction (via BEGIN/COMMIT wrapper in lib/db.ts)
        return await (db as any).transaction(async () => {
          await db.prepare(`
            INSERT OR IGNORE INTO sequences (kind, year, last_number)
            VALUES (?, ?, 0)
          `).run(kind, year);

          await db.prepare(`
            UPDATE sequences
            SET last_number = last_number + 1
            WHERE kind = ? AND year = ?
          `).run(kind, year);

          const row = await db.prepare(`
            SELECT last_number
            FROM sequences
            WHERE kind = ? AND year = ?
          `).get(kind, year) as { last_number: number };

          return `${prefix}-${year}-${String(row.last_number).padStart(6, '0')}`;
        })();
      }
    } catch (e: any) {
      if (attempt === maxRetries - 1) {
        const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
        return `${prefix}-${year}-${Date.now().toString().slice(-6)}${rand}`;
      }
    }
  }
  return `${prefix}-${year}-${String(Date.now()).slice(-6)}`;
}
