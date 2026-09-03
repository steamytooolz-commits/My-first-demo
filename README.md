# Paper & Quill Stationery — Online Store

> **A complete, production-ready stationery e-commerce for South Africa** — storefront browsing, cart, checkout simulation, customer portal, VAT invoicing, POPIA compliance, and admin dashboard. Built with **Next.js 15**, **SQLite (`better-sqlite3`)**, **Tailwind CSS 4**.

[![CI](https://github.com/steamytooolz-commits/My-first-demo/actions/workflows/ci.yml/badge.svg)](https://github.com/steamytooolz-commits/My-first-demo/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-15.4-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

- **Storefront** — category explorer, catalog with search / price / stock filters, product detail with variants (`/`, `/catalog`, `/products/[slug]`)
- **Cart & Checkout** — guest + authenticated carts, coupon codes, weight-based shipping (`pickup`/`standard`/`express`), VAT-inclusive tax math
- **Payment simulation** — `sim_card` (success/declined/pending), `manual_eft` (bank details + admin verification), `pay_on_delivery` — no external gateway
- **Customer portal** — orders, invoices, addresses, profile, security, POPIA privacy (`/account/*`, `/api/account/export`)
- **Admin** — dashboard, products/variants, CSV catalogue import (`/admin/products/import`), categories, orders, invoices, coupons, customers/POPIA, audit logs, settings, one-click maintenance (`/admin/*`)
- **Invoicing** — sequential `INV-YYYY-NNNNNN` / `ORD-YYYY-NNNNNN` via `sequences`, SARS-compliant VAT, seller/buyer snapshots, print view
- **Compliance** — POPIA consent, 7-day erasure grace, anonymization while retaining 5-year tax invoices (`lib/privacy.ts`)

---

## 🧱 Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 App Router, React 19, Server Actions, RSC |
| Styling | Tailwind CSS 4, `@tailwindcss/postcss`, `tw-animate-css` |
| DB | SQLite `better-sqlite3` WAL (`PRAGMA journal_mode=WAL`, `busy_timeout=5000`, `foreign_keys=ON`) |
| Validation | Zod, `react-hook-form` + `@hookform/resolvers` |
| Auth | `scrypt` (`N=16384, r=8, p=1`), `sha256` session tokens, `jpf_session` cookie (`httpOnly`, `secure`, `sameSite:none`) |
| Money | integer cents, VAT `round(total * 15 / 115)` (SA 15% inclusive) |
| Tests | Vitest |

See [`ASSUMPTIONS.md`](./ASSUMPTIONS.md) for statutory & simulation details.

---

## 🚀 Quick Start (Local)

**Prereqs:** Node 22 + Bun 1.4 (or npm), no global `better-sqlite3` build needed — prebuilt via `serverExternalPackages`.

```bash
# 1. Install
bun install --frozen-lockfile
# or npm install

# 2. Env
cp .env.example .env
# edit SESSION_SECRET (openssl rand -hex 32), DATABASE_FILE, ADMIN_EMAIL/PASSWORD

# 3. DB
bun run db:migrate   # applies migrations/001_init.sql
bun run db:seed      # store settings + admin/customer + 15 products/21 variants + coupons + 2 demo orders

# 4. Dev
bun run dev          # http://localhost:3000
# 5. Verify (typecheck + lint + test + migrate + build)
bun run verify
```

**Seed accounts:**
- Admin: `admin@example.com / ChangeMe123!`
- Customer: `customer@example.com / Customer123!`
- Coupons: `WELCOME10` (10% off ≥R100, max R150, one-per-customer), `SAVE50` (R50 off ≥R300), `FREESHIP` (free shipping ≥R750)

---

## ⚙️ Environment

Copy `.env.example`:

```ini
DATABASE_FILE=./data/app.db
SESSION_SECRET=replace-with-long-random-hex
PUBLIC_APP_URL=http://localhost:3000
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ChangeMe123!
SEED_DEMO=true
SEED_TAX_ENABLED=false
SEED_TAX_RATE_PERCENT=0
GEMINI_API_KEY="MY_GEMINI_API_KEY"  # AI Studio injects at runtime
APP_URL="MY_APP_URL"                # Cloud Run URL, injected at runtime
```

On **Vercel** `DATABASE_FILE` is auto-redirected to `/tmp/data/app.db` (read-only FS fix in `lib/db.ts`). See [Deployment Guide](./DEPLOYMENT.md).

---

## 📜 Scripts

| Script | Description |
|--------|-------------|
| `dev` | `next dev` |
| `build` | `next build` (standalone, `serverExternalPackages: ['better-sqlite3']`) |
| `start` | `next start` |
| `lint` | `eslint .` (flat config `eslint.config.mjs`) |
| `typecheck` | `tsc --noEmit` |
| `test` | `vitest run` (2 suites, 7 tests) |
| `db:migrate` | `node scripts/migrate.mjs` |
| `db:seed` | `node scripts/seed.mjs` |
| `db:reset` | delete DB + migrate |
| `verify` | typecheck && lint && test && migrate && build |
| `privacy:process` | anonymize due `data_subject_requests` |
| `carts:abandon` | mark stale carts `abandoned` (7d) |
| `orders:expire` | cancel `pending_payment` >7d, restore stock, void invoice |
| `db:backup` | WAL checkpoint + copy to `data/backups/` |

---

## 🏗️ Architecture

```
app/                # App Router pages & Server Actions
  page.tsx          # Home: categories + featured (SQL aggregations)
  catalog/page.tsx  # Filtered catalog (dynamic WHERE/HAVING)
  products/[slug]/  # Variant selector (ProductDetailClient)
  cart/, checkout/  # Cart summary (server-authoritative pricing)
  account/, admin/  # Portals (requireUser/requireAdmin)
  api/*/export/     # JSON/CSV exports
components/         # Client islands (CartClient, CheckoutClient, etc.)
lib/
  db.ts             # Vercel-aware path + WAL + embedded fallback schema (see Vercel note)
  cart.ts           # findActiveCart, getOrCreateActiveCart, mergeGuestCart, getCartSummary
  checkout.ts       # executeCheckout (transaction, coupon, shipping, tax, sequences, invoice)
  money.ts          # allocateDiscounts, calculateAndAllocateTax, formatZar
  auth.ts           # scrypt, session cookies, getSessionUser
  invoicing.ts      # createInvoiceForOrder
  privacy.ts        # generateCustomerExport, requestAccountErasure
  settings.ts       # getStoreSettings (JSON in `settings`)
migrations/001_init.sql  # 15 tables + indices (users, sessions, carts, orders, invoices, sequences, audit_logs, ...)
scripts/            # migrate, seed, reset, cron helpers
test/               # money.test.ts, auth.test.ts
public/seed/        # SVG placeholders generated on seed
```

**Money:** all `*_cents` integers, no floats. **VAT:** `Math.round(cents * 15 / 115)` for inclusive prices.

**Sequences:** `nextSequence('order'|'invoice', prefix)` → `ORD-2026-000001`.

---

## ☁️ Vercel Fix (ENOENT)

**Problem:** `lib/db.ts` did `mkdir('/var/task/data')` → Vercel serverless is read-only except `/tmp` → `ENOENT` 500 on `/` and `/favicon.ico`.

**Fix (`lib/db.ts:5`):**
```ts
function getEffectiveDbPath() {
  if (process.env.VERCEL) return raw.replace('/var/task','/tmp') // ./data/app.db → /tmp/data/app.db
}
 // try mkdir, fallback to /tmp/data on ENOENT
 // ensureSchema(): if `users` missing, bootstrap from migrations/ or embedded FALLBACK_SCHEMA (001_init.sql)
```
`scripts/*.mjs` patched identically. Build still succeeds with empty DB; pages show empty catalog instead of 500. For persistence on Vercel, set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` (free tier, same SQLite dialect, zero schema changes) — see [`DEPLOYMENT.md`](./DEPLOYMENT.md) Turso setup. VPS/local keeps the `better-sqlite3` file with no cloud needed.

---

## ✅ CI

GitHub Actions (`.github/workflows/ci.yml`):

```yaml
on: [push, pull_request] -> ubuntu-latest
  verify: typecheck -> lint -> test -> db:migrate -> db:seed -> turso file-DB migrate+seed check -> build -> HTTP smoke (boot + curl / /catalog /auth/login)
  audit: grep checks for getEffectiveDbPath/FALLBACK_SCHEMA in lib/db.ts + scripts
```

Badge at top reflects `main`. All checks must pass before Vercel deploy. Locally, **do not** run `bun`/`npm` on Android — CI handles it.

---

## 🧪 Testing

```bash
bun run test          # vitest — money, auth, validation, turso driver, staging smoke
bun run typecheck     # tsc --noEmit
bun run lint          # eslint . (flat config)
```

Config: `vitest.config.mjs` (alias `@` → `./`, node env).

---

## 📖 Docs

- [Assumptions & Compliance](./ASSUMPTIONS.md) — stack, VAT math, payment modes, POPIA 7-day grace, seed data
- [Deployment Guide](./DEPLOYMENT.md) — local, Vercel, env, DB persistence, cron, troubleshooting
- [CI Workflow](./.github/workflows/ci.yml)

---

## 📄 License

MIT — see `package.json`. Data in `data/` is git-ignored; `public/seed/` SVGs are generated.

---

**Made for South Africa** — prices in ZAR, `en-ZA` formatting, FNB bank details, Gauteng address, POPIA first.

