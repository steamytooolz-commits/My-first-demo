---
name: replicate-store
description: Rebuild the Paper & Quill stationery e-commerce (Next.js storefront, cart, checkout, VAT invoicing, POPIA flows, admin) from scratch or port it to a new stack. Use ONLY when asked to replicate, rebuild, clone, or port this store.
---

# Replicate Paper & Quill Store

Target: a complete SA stationery e-commerce — storefront browsing, cart, checkout simulation,
customer portal, VAT invoicing, POPIA compliance, trade accounts, admin dashboard.

## 1. Stack (baseline)

Next.js 15 App Router (RSC + Server Actions) · React 19 · Tailwind CSS 4 · TypeScript strict ·
SQLite via `better-sqlite3` (WAL, `busy_timeout=5000`, `foreign_keys=ON`) locally with Turso/LibSQL
edge dialect on Vercel (`TURSO_DATABASE_URL` set switches backend, zero schema changes) ·
Zod validation · Vitest · `next build` standalone, `better-sqlite3` in `serverExternalPackages`.

## 2. Schema (21 content tables, `migrations/` + `FALLBACK_SCHEMA` in `lib/db.ts`)

users, sessions, settings (single `store` JSON row), categories, products, product_images,
product_variants, carts, cart_items, coupons, coupon_redemptions, addresses, orders, order_items,
order_events, payments, invoices, sequences, stock_movements, audit_logs, data_subject_requests,
trade_applications (+ runtime `rate_limits`). Order/invoice numbers via `sequences(kind,year)`
→ `ORD-YYYY-NNNNNN` / `INV-YYYY-NNNNNN`.

## 3. Non-negotiable invariants

- Money is integer cents everywhere; VAT inclusive extracted as `round(total * 15 / 115)`.
- Server-authoritative pricing: cart/checkout recompute from DB, never trust client totals.
- Passwords `scrypt:N=16384,r=8,p=1`; sessions are `sha256` token hashes in DB + signed JWT cookie
  (`jpf_session`, `httpOnly`, `SameSite=Lax`); JWT resume only when the DB lookup errored, never on missing row.
- Every mutation validates enums server-side (shipping/payment/outcome), checks ownership
  (`WHERE id=? AND user_id=?`), and returns `{success, error?}` for visible UI feedback.
- Stock decrement is atomic (`UPDATE … WHERE stock_qty >= ?`, check `changes`); coupon `used_count`
  increments under `WHERE used_count < usage_limit`.
- No nested transactions on the shared wrapper (sequence helpers must NOT open their own).
- Image URLs allowlisted to site paths + `https://`; CSV import capped (2.5MB/2000 rows);
  open redirects blocked (`sanitizeRedirectTo`); login throttled per-email; PII stripped from audit logs.
- Invoices render frozen `seller_json`/`buyer_json` snapshots; title is TAX INVOICE only when `tax_cents > 0`;
  bank block only when balance is due. Erasure de-identifies to `erased-<id>@invalid.local`, keeps
  buyer-redacted invoices 5y (TAA s29).

## 4. Module map (`lib/`)

`db` (dual backend + schema bootstrap + seeds) · `auth` · `cart` (guest/user merge, coupon+shipping math) ·
`checkout` (rate-limited, idempotent) · `money` (discount/VAT allocation) · `invoicing` · `sequences` ·
`privacy` (export/erasure) · `settings` (JSON row + zod) · `csv-import` (delimiter detect, alias dict incl.
Afrikaans, price locales) · `site-transfer` (full JSON backup/restore) · `audit` · `rate-limit` · `validation`.

## 5. Build order

1. Migrations + seed (5 categories, demo admin/customer, coupons) → 2. auth + sessions →
2. catalogue (filter/sort/pagination) + product detail → 4. cart (guest merge) → 5. checkout + payments +
3. invoicing → 7. account portal + POPIA export/erasure → 8. admin (dashboard, products+variants,
   CSV import, orders, coupons, customers, settings, audit, backups) → 9. trade applications →
4. legal pages + compliance copy → 11. tests + CI (typecheck, lint, migrate, seed, build, HTTP smoke).

## 6. Verification gates (all must pass)

`tsc --noEmit` · `eslint .` · `vitest run` (money, validation, auth, csv-import incl. Afrikaans/edge
formats, site-transfer round-trip, smoke incl. route presence) · `db:migrate` + `db:seed` (+ Turso
file-DB variant) · `next build` · boot + curl `/`, `/catalog`, `/auth/login`.
