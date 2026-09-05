-- B2B trade accounts (003): account type on users + application queue
-- Idempotent: migrate scripts skip benign duplicate-column / already-exists errors.

ALTER TABLE users ADD COLUMN account_type TEXT NOT NULL DEFAULT 'retail';
ALTER TABLE users ADD COLUMN trade_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN business_name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN trade_vat_number TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN cipc_number TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS trade_applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  trade_vat_number TEXT NOT NULL DEFAULT '',
  cipc_number TEXT NOT NULL DEFAULT '',
  contact_person TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  trade_references TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_trade_apps_user ON trade_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_apps_status ON trade_applications(status);
CREATE INDEX IF NOT EXISTS idx_users_trade_status ON users(trade_status);
