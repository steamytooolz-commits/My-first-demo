# Paper & Quill Stationery — Online Store (Demo v1 Final)

> **A complete stationery e-commerce for South Africa** — storefront browsing, cart, checkout simulation, customer portal, VAT invoicing, POPIA compliance, B2B trade accounts, and admin dashboard. Built with **Next.js 15**, **SQLite (`better-sqlite3`) / Turso edge**, **Tailwind CSS 4**.

[![CI](https://github.com/steamytooolz-commits/My-first-demo/actions/workflows/ci.yml/badge.svg)](https://github.com/steamytooolz-commits/My-first-demo/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js-15.4-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features (v1)

- **Storefront** — live hero showcase, category explorer, catalog with search / price / stock filters, product detail with variants, demo-tour band (`/`, `/catalog`, `/products/[slug]`)
- **Cart & Checkout** — guest + authenticated carts (auto-merge on login), coupon codes, weight-based shipping (`pickup`/`standard`/`express`), live order totals, VAT-inclusive tax math, idempotent order placement
- **Payment simulation** — `sim_card` (success/declined/pending + retry), `manual_eft` (bank details + admin verification), `pay_on_delivery` (Gauteng-only, server-enforced) — no external gateway
- **Customer portal** — overview, orders & invoices, addresses (20 max), profile, security (password change revokes other sessions), trade application, POPIA privacy with export + erasure (7-day hold or immediate) (`/account/*`)
- **B2B trade (Beta)** — application with business/VAT/CIPC details, admin approve/reject queue, trade badges, business-named VAT invoices (`/account/trade`, `/admin/customers`)
- **Admin** — dashboard (KPIs, stock alerts, 3-flow pitch panel, DB persistence badge), one-page product+SKU create, variant inventory, bulk CSV import (comma/semicolon/tab/pipe, Afrikaans headers, SA price locales), categories, orders lifecycle, invoices, coupons, customers/POPIA/trade, audit trail, store settings that actually save, backups (`/admin/*`)
- **Backups & site transfer** — full-site JSON export (21 tables) + merge/replace restore, schema-tolerant across migration levels (`/admin/backups`, `/api/admin/export/site`)
- **Invoicing** — sequential `INV-YYYY-NNNNNN` / `ORD-YYYY-NNNNNN` via `sequences`, TAX INVOICE only when VAT was charged, frozen seller/buyer snapshots, bank block only while balance due, print view
- **Compliance** — POPIA acknowledgement + separate marketing opt-in, Information Officer + Regulator route, contact-form notice, ECT cooling-off disclosures, TAA 5-year retention with buyer-redacted invoices (`lib/privacy.ts`)
- **Trust kit** — WhatsApp order-help button (toggle + number in settings), POPIA-aligned badges, dynamic free-shipping threshold everywhere, store name + monogram applied site-wide from settings
- **Responsive** — all data tables scroll inside their cards, phone-width navbar/invoice, empty states instead of blank grids

---

## 🧱 Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 15 App Router, React 19, Server Actions, RSC |
| Styling | Tailwind CSS 4, `@tailwindcss/postcss`, `tw-animate-css` |
| DB | SQLite `better-sqlite3` WAL (`journal_mode=WAL`, `busy_timeout=5000`, `foreign_keys=ON`); Turso/LibSQL edge when `TURSO_DATABASE_URL` is set (same dialect, runtime auto-seed) |
| Validation | Zod throughout (server actions; no client form library) |
| Auth | `scrypt` (`N=16384, r=8, p=1`), `sha256` session rows, signed JWT cookie with opaque-token fallback (`jpf_session`: `httpOnly`, `secure`, `sameSite=lax`); JWT resume only on DB failure |
| Money | integer cents, VAT `round(total * 15 / 115)` (SA 15% inclusive), atomic stock/coupon guards, per-email login throttle, per-user checkout throttle |
| Headers | `nosniff`, `Referrer-Policy`, `SAMEORIGIN` framing, HSTS, `Permissions-Policy`, no `x-powered-by` |
| Tests | Vitest — 8 suites, 47 tests |

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
bun run db:migrate   # applies migrations/001_init.sql → 002_qol.sql → 003_trade.sql
bun run db:seed      # settings + admin/customer + catalogue + coupons + demo orders

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
SESSION_SECRET=replace-with-long-random-hex   # ≥32 chars; login works without it, cross-instance resume needs it
PUBLIC_APP_URL=http://localhost:3000
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ChangeMe123!
SEED_DEMO=true
SEED_TAX_ENABLED=false
SEED_TAX_RATE_PERCENT=0
TURSO_DATABASE_URL=                             # set on Vercel for shared persistence (Marketplace Turso injects these)
TURSO_AUTH_TOKEN=
GEMINI_API_KEY="MY_GEMINI_API_KEY"  # AI Studio injects at runtime
APP_URL="MY_APP_URL"                # Cloud Run URL, injected at runtime
```

On **Vercel** `DATABASE_FILE` is auto-redirected to `/tmp/data/app.db` (**per-instance ephemeral**: writes evaporate, sessions don't travel). For anything beyond demo-clicking, connect Turso (Dashboard → Storage → Marketplace → Turso → Redeploy); first visit auto-builds schema + seeds. See [Deployment Guide](./DEPLOYMENT.md).

---

## 📜 Scripts

| Script | Description |
|--------|-------------|
| `dev` | `next dev` |
| `build` | `next build` (standalone, `serverExternalPackages: ['better-sqlite3']`) |
| `start` | `next start` |
| `lint` | `eslint .` (flat config `eslint.config.mjs`) |
| `typecheck` | `tsc --noEmit` |
| `test` | `vitest run` (8 suites, 47 tests: money, validation, auth, csv-import incl. Afrikaans/edge formats, site-transfer round-trip, seed-data, turso driver, smoke) |
| `db:migrate` / `db:migrate:turso` | apply `migrations/*.sql` (tolerant reruns) |
| `db:seed` / `db:seed:turso` | store settings + accounts + catalogue + coupons |
| `db:reset` | delete DB + migrate |
| `verify` | typecheck && lint && test && db:migrate && build |
| `privacy:process` | anonymize due `data_subject_requests` |
| `carts:abandon` | mark stale carts `abandoned` (7d) |
| `orders:expire` | cancel `pending_payment` >7d, restore stock, void invoice |
| `db:backup` | WAL checkpoint + copy to `data/backups/` |

---

## 🏗️ Architecture

```
app/                       # App Router pages & Server Actions (all return {success, error?})
  page.tsx                 # Home: live hero, categories, featured, demo-tour (dynamic metadata)
  catalog/page.tsx         # Filtered catalog (dynamic WHERE/HAVING)
  products/[slug]/         # Variant selector (ProductDetailClient)
  cart/, checkout/         # Server-authoritative pricing, live totals, idempotency keys
  account/ (trade, privacy…) # Portal + trade applications + erasure
  admin/ (backups, …)      # Dashboard, products, CSV import, orders, coupons, customers, settings, audit
  api/*/export/            # JSON/CSV/site exports (auth, rate-limited, no-store)
components/                # ActionForm (visible errors), QuickAddButton, Admin*Form, SiteImportForm, WhatsAppButton…
lib/
  db.ts                    # Dual backend (better-sqlite3 ↔ Turso), Vercel /tmp redirect, FALLBACK_SCHEMA, seeds
  cart.ts / checkout.ts    # findActiveCart, mergeGuestCart, getCartSummary, executeCheckout (atomic guards)
  money.ts                 # allocateDiscounts, calculateAndAllocateTax, formatZar
  auth.ts                  # scrypt, sessions, sanitizeRedirectTo, JWT-gated fallback
  invoicing.ts / sequences.ts  # createInvoiceForOrder, nextSequence (no nested txns)
  privacy.ts / settings.ts # export/erasure, JSON settings row
  csv-import.ts            # delimiter detect, alias dict (EN+AF), SA price locales, image allowlist
  site-transfer.ts         # versioned full-site export/import (merge/replace, schema-tolerant)
  audit.ts / rate-limit.ts / validation.ts
migrations/                # 001_init.sql (23 tables) → 002_qol.sql (indexes, idempotency, coupon reuse) → 003_trade.sql
scripts/                   # migrate(+turso), seed(+turso), reset, backup, cron helpers
test/                      # 8 suites: money, validation, auth, csv-import, site-transfer, seed-data, turso, smoke
public/seed/               # SVG placeholders
```

**Money:** all `*_cents` integers, no floats. **VAT:** `Math.round(cents * 15 / 115)` for inclusive prices.

**Sequences:** `nextSequence('order'|'invoice', prefix)` → `ORD-2026-000001` (lock-free, retried).

---

## ☁️ Vercel Notes

- **Read-only FS:** `DATABASE_FILE` redirects to `/tmp` (`getEffectiveDbPath`); cold starts bootstrap schema + demo seed automatically; Navbar degrades instead of erroring on DB hiccups.
- **Persistence:** `/tmp` is per-instance — use the Turso Marketplace integration for shared logins/orders. Admin dashboard shows a green/amber persistence badge.
- **Zero-config login:** opaque DB sessions work with no env vars; set `SESSION_SECRET` (≥32) for cross-instance resume.

---

## ✅ CI

GitHub Actions (`.github/workflows/ci.yml` + `turso-seed.yml`):

```yaml
on: [push, pull_request] -> ubuntu-latest
  verify: typecheck -> lint -> test -> db:migrate -> db:seed -> turso file-DB migrate+seed check -> build -> HTTP smoke (boot + curl / /catalog /auth/login)
  audit: Vercel-fix grep checks
```

Badge at top reflects `main`. All checks must pass before Vercel deploy. Locally, **do not** run `bun`/`npm` on Android — CI handles it.

---

## 🧪 Testing

```bash
bun run test          # vitest — money, validation, auth, csv-import, site-transfer, seed-data, turso, smoke
bun run typecheck     # tsc --noEmit
bun run lint          # eslint . (flat config)
```

Config: `vitest.config.mjs` (alias `@` → `./`, node env). Private quote + client build prompt (`private.md`, `client-build-prompt.md`) are git-ignored working files, never pushed.

---

## 📖 Docs

- [Assumptions & Compliance](./ASSUMPTIONS.md) — stack, VAT math, payment modes, POPIA grace, seed data
- [Deployment Guide](./DEPLOYMENT.md) — local, Vercel, env checklist + symptom guide, Turso (Marketplace one-click), cron, troubleshooting
- [CI Workflow](./.github/workflows/ci.yml)

---

## 📄 License

MIT — see `package.json`. Data in `data/` is git-ignored; `public/seed/` SVGs are generated.

---

**Demo v1 final** — everything above is implemented, tested (47 green), and deployed. Next horizons (not in v1): real PayFast gateway, Resend transactional email, nonce CSP, managed MySQL/Redis/Mongo topology (see internal build prompt).

**Made for South Africa** — prices in ZAR, `en-ZA` formatting, FNB demo banking, Johannesburg dispatch, POPIA first.
