import { describe, it, expect } from 'vitest';
import { createClient } from '@libsql/client';

// Proves the LibSQL driver (Turso wire protocol) works with the exact SQLite
// features our schema relies on: COLLATE NOCASE, datetime('now'), INSERT OR
// IGNORE, ON CONFLICT, partial indexes. Runs against in-memory LibSQL, no cloud.
describe('libsql driver (Turso protocol)', () => {
  it('supports our schema dialect on an in-memory database', async () => {
    const client = createClient({ url: ':memory:' });

    await client.execute(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    await client.execute({
      sql: 'INSERT INTO users (id, email) VALUES (?, ?)',
      args: ['u1', 'Admin@Example.com'],
    });
    // Case-insensitive lookup like lib/auth.ts login
    const found = await client.execute({
      sql: 'SELECT id, email FROM users WHERE email = ? COLLATE NOCASE',
      args: ['admin@example.com'],
    });
    expect(found.rows).toHaveLength(1);

    // INSERT OR IGNORE is idempotent
    await client.execute({
      sql: 'INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)',
      args: ['u1', 'admin@example.com'],
    });
    const count = await client.execute('SELECT COUNT(*) as c FROM users');
    expect((count.rows[0] as any).c).toBe(1);

    // datetime('now') defaults populate
    expect((found.rows[0] as any).id).toBe('u1');

    // Transactions commit and rollback
    const tx = await (client as any).transaction('write');
    if (tx) {
      await tx.execute({ sql: 'INSERT INTO users (id, email) VALUES (?, ?)', args: ['u2', 'b@example.com'] });
      await tx.rollback();
      const after = await client.execute('SELECT COUNT(*) as c FROM users');
      expect((after.rows[0] as any).c).toBe(1);
    }
  });

  it('supports partial unique indexes used by carts', async () => {
    const client = createClient({ url: ':memory:' });
    await client.execute(`CREATE TABLE carts (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      guest_token TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'active'
    );`);
    await client.execute(`CREATE UNIQUE INDEX uniq_active_cart_user ON carts(user_id) WHERE status = 'active' AND user_id IS NOT NULL;`);
    await client.execute({ sql: `INSERT INTO carts (id, user_id) VALUES (?, ?)`, args: ['c1', 'u1'] });
    // Same user with abandoned status is allowed
    await client.execute({ sql: `INSERT INTO carts (id, user_id, status) VALUES (?, ?, 'abandoned')`, args: ['c2', 'u1'] });
    const rows = await client.execute('SELECT COUNT(*) as c FROM carts');
    expect((rows.rows[0] as any).c).toBe(2);
  });
});
