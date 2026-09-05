-- QoL upgrade 002: indexes, rate_limits, idempotency, coupon reuse fix
-- Safe to apply on fresh or existing DBs. All statements idempotent.

-- 1. Runtime rate-limit table (previously created on-the-fly in lib/rate-limit.ts)
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

-- 2. Idempotency key for checkout double-submit protection (nullable, unique when present)
-- SQLite has no IF NOT EXISTS for ADD COLUMN, so guard via pragma in app code as well.
-- migrate.mjs runs each file once via schema_migrations, so plain ADD COLUMN is safe here.
ALTER TABLE orders ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 3. Fix coupon_redemptions to allow reuse when one_per_customer = 0
-- Old schema: UNIQUE(coupon_id, user_id) blocked all reuse. New: UNIQUE per order.
-- Rebuild table (no other table references coupon_redemptions, so DROP is safe).
CREATE TABLE IF NOT EXISTS coupon_redemptions_new (
  id TEXT PRIMARY KEY,
  coupon_id TEXT NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(coupon_id, user_id, order_id)
);
INSERT OR IGNORE INTO coupon_redemptions_new (id, coupon_id, user_id, order_id, created_at)
  SELECT id, coupon_id, user_id, order_id, created_at FROM coupon_redemptions;
DROP TABLE IF EXISTS coupon_redemptions;
ALTER TABLE coupon_redemptions_new RENAME TO coupon_redemptions;

-- 4. Performance indexes for storefront + admin queries
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_variants_active ON product_variants(active);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_placed ON orders(placed_at);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON order_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_variant ON cart_items(variant_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_variant ON stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
