import { db } from './db';

export function nextSequence(kind: 'order' | 'invoice', prefix: string): string {
  const year = new Date().getUTCFullYear();

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
}
