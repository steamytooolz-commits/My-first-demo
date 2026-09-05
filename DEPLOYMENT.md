# Deployment Guide — Paper & Quill Stationery

> Covers **local**, **Vercel (production)**, **GitHub CI**, **DB persistence**, **cron**, and **troubleshooting** for the `ENOENT /var/task/data` fix.

---

## 1. Environments

| Env | Node | Package Manager | DATABASE_FILE | Notes |
|-----|------|-----------------|---------------|-------|
| Local (Android note: use GitHub, not local `bun`) | 22 | Bun 1.4 (`bun.lock`) or npm 10 | `./data/app.db` | Writable FS, WAL, full seed |
| CI (GitHub Actions) | 22 | `bun install --frozen-lockfile` | `./data/app.db` | Ephemeral, migrated + seeded per run |
| Vercel Production | 22 | `bun` (Build Command) | `/tmp/data/app.db` (auto-redirect) | **Read-only** except `/tmp` — see §3 |

---

## 2. Quick Deploy

### A. Vercel via GitHub (Recommended)

1. **Connect repo:** Vercel → Add New Project → Import `steamytooolz-commits/My-first-demo` → Framework Preset `Next.js`.
2. **Build Settings:**
   - Install Command: `bun install --frozen-lockfile` (or `npm install`)
   - Build Command: `bun run db:migrate && bun run db:seed && bun run build`  
     *Ensures `/tmp/data/app.db` exists before `next build` collects page data (otherwise catalog queries get empty schema but not 500 thanks to `ensureSchema`).*
   - Output: `.next` (standalone is auto, `next.config.ts:34` `output:'standalone'` + `serverExternalPackages:['better-sqlite3']`)
3. **Env Vars (Vercel → Settings → Environment Variables):**
   ```ini
   DATABASE_FILE=/tmp/data/app.db
   SESSION_SECRET=openssl rand -hex 32   # ≥32 chars, strongly recommended (cross-instance login resume)
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=ChangeMe123!
   SEED_DEMO=true
   SEED_TAX_ENABLED=false
   GEMINI_API_KEY=...        # AI Studio secret
   APP_URL=https://<vercel-url>  # auto-injected if not set
   # Persistence (required if logins/orders must survive — /tmp is per-instance ephemeral):
   TURSO_DATABASE_URL=libsql://...   # Turso dashboard → database → URL
   TURSO_AUTH_TOKEN=...               # turso db tokens create <db-name>
   ```
   Mark `SESSION_SECRET`, `GEMINI_API_KEY`, `TURSO_AUTH_TOKEN` as **Encrypted**.
   Notes:
   - Login works even with zero env vars (opaque DB sessions), but logins only stick on one instance until `SESSION_SECRET` is set, and all writes evaporate on cold start until Turso is set.
   - With `TURSO_*` set, no manual seeding is needed: first request auto-creates schema + admin/customer + catalogue.
4. **Deploy:** Push to `main` → Vercel auto-deploys + GitHub CI runs. Check Vercel Logs → no `ENOENT mkdir '/var/task/data'` (fixed `lib/db.ts:5`).
   **Symptom guide:** can't log in with an error digest → set `SESSION_SECRET`; logins drop + writes vanish → set `TURSO_*`; 10–20s first loads → cold start + remote-DB bootstrap (normal on hobby, then warm).

### B. Vercel via CLI (if GitHub not linked)

```bash
npm i -g vercel
vercel login
vercel --prod --cwd ./My-first-demo-main
# Set env via `vercel env add DATABASE_FILE` etc.
```

### C. Local (for non-Android devs)

```bash
cp .env.example .env   # set SESSION_SECRET, etc.
bun install
bun run db:migrate && bun run db:seed
bun run dev            # http://localhost:3000
bun run verify         # full check (typecheck+lint+test+migrate+build)
```

> **Android:** Do not run `bun`/`npm`/`python` locally (sdcard FS breaks `better-sqlite3` builds). Push to `main` — GitHub Actions handles install/test/build.

---

## 3. Vercel Read-Only FS — The Fix

**Root cause:** `lib/db.ts:5` used `DATABASE_FILE=./data/app.db` → `path.resolve('./data')` = `/var/task/data` on Vercel. `fs.mkdirSync('/var/task/data')` throws `ENOENT` (read-only). Every request (`/`, `/favicon.ico`) 500s. See Vercel logs: `Error: ENOENT: no such file or directory, mkdir '/var/task/data' at 27143 (.next/server/chunks/3009.js:77:1717)`.

**Code fix (`lib/db.ts`):**

```ts
function getEffectiveDbPath() {
  if (process.env.VERCEL) {
    if (raw.startsWith('/var/task/')) return raw.replace('/var/task','/tmp');
    return path.join('/tmp', raw.replace(/^\.\//,''));
  }
  return raw;
}
let dbPath = getEffectiveDbPath();
try { fs.mkdirSync(dataDir) } catch {
  // fallback to /tmp/data + console.warn
}
const FALLBACK_SCHEMA = `CREATE TABLE ...`; // full 001_init.sql
function ensureSchema(db) {
  if (!db.prepare("SELECT name FROM sqlite_master...").get()) {
    // try migrations/ folder, else exec FALLBACK_SCHEMA
  }
}
```

**Behavior on Vercel:**
- First cold start: `/tmp/data/app.db` missing → created, `ensureSchema` bootstraps 15 tables from `migrations/001_init.sql` or embedded fallback → **no 500**, but catalog empty.
- With Build Command `migrate && seed && build`: DB is seeded before build, so static generation sees products.
- Subsequent requests in same lambda reuse `/tmp` DB until eviction (~15 min). **Not persistent** — see §4.

**Scripts patched:** `migrate.mjs`, `seed.mjs`, `reset.mjs`, `db-backup.mjs`, `privacy-process.mjs`, `carts-abandon.mjs`, `orders-expire.mjs` all use same `getEffectiveDbPath` + fallback.

---

## 4. DB Persistence

| Option | When to Use | How |
|--------|-------------|-----|
| **Turso (LibSQL edge SQLite)** | Vercel staging / production (recommended) | Same SQLite dialect, zero schema changes. Free tier at turso.tech. Set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` in Vercel env, then run `bun run db:migrate:turso && bun run db:seed:turso` once (see Turso setup below). `lib/db.ts` switches automatically. |
| **SQLite file (`better-sqlite3`)** | VPS / local single-instance | Deterministic, no cloud needed. Keep `DATABASE_FILE=./data/app.db` (or `/data/app.db` volume mount on Fly.io/Render). Run `bun run db:migrate && bun run db:seed`. |
| **Ephemeral `/tmp` (fallback)** | Emergency only | No config. Data lost on cold start. Only used on Vercel when `TURSO_DATABASE_URL` is unset. |

### Turso setup (free tier, ~5 minutes)

```bash
# 1. Install CLI + sign up (browser login, free, no card)
curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup

# 2. Create staging database + token
turso db create staging-paper-quill
turso db show staging-paper-quill --url
# -> libsql://staging-paper-quill-[org].turso.io
turso db tokens create staging-paper-quill

# 3. Bootstrap schema + catalog (same 15 products as local seed)
TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." bun run db:migrate:turso
TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." bun run db:seed:turso

# 4. Vercel → Project Settings → Environment Variables (Production):
#      TURSO_DATABASE_URL="libsql://..."
#      TURSO_AUTH_TOKEN="..."
#    Redeploy. First request bootstraps + seeds admin/customer automatically;
#    `POST /admin/products/new` then persists across all instances.
```

Local Turso check without cloud (same commands CI runs):

```bash
rm -f /tmp/turso-ci.db
TURSO_DATABASE_URL="file:/tmp/turso-ci.db" bun run db:migrate:turso
TURSO_DATABASE_URL="file:/tmp/turso-ci.db" bun run db:seed:turso
```

**Backup (`scripts/db-backup.mjs`):** WAL checkpoint → copy to `data/backups/backup-<iso>.db`. On Vercel, backup goes to `/tmp/data/backups` (also ephemeral).

---

## 5. Cron & Background Jobs

Add to `vercel.json` (create if missing) or Vercel → Settings → Cron:

```json
{
  "crons": [
    { "path": "/api/cron/privacy-process", "schedule": "0 2 * * *" },
    { "path": "/api/cron/carts-abandon", "schedule": "0 3 * * *" },
    { "path": "/api/cron/orders-expire", "schedule": "0 4 * * *" }
  ]
}
```

Alternatively, run manually:

```bash
bun run privacy:process  # anonymizes due erasures
bun run carts:abandon    # 7d stale carts
bun run orders:expire    # 7d pending_payment → cancelled + stock restore
```

On Vercel, these must hit `/tmp` DB, so schedule after seed.

---

## 6. GitHub CI

**File:** `.github/workflows/ci.yml`

```yaml
on: [push, pull_request] (main/master)
jobs:
  verify: typecheck -> lint -> test -> db:migrate -> db:seed -> build
  audit: grep checks for Vercel fix in lib/db.ts + scripts
```

**Status:** [![CI](https://github.com/steamytooolz-commits/My-first-demo/actions/workflows/ci.yml/badge.svg)](https://github.com/steamytooolz-commits/My-first-demo/actions)

Last run `5ad88d5` — `1m37s` — `7 passed` (5 money + 2 auth), `Compiled successfully in 7.0s`.

**Local check without running `bun`:** Push to `main` → Actions tab → green check.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ENOENT mkdir '/var/task/data'` 500 | Old `lib/db.ts` without `VERCEL` redirect | Pull `main` (contains `getEffectiveDbPath` + fallback). Redeploy Vercel. Ensure `DATABASE_FILE` not set to `/var/task/...` |
| `no such table: categories` on Vercel | DB empty, `migrations/` not included in standalone | Update to latest `lib/db.ts` (embedded `FALLBACK_SCHEMA`), add Build Command `migrate && seed` |
| `Cannot find module 'better-sqlite3'` in CI | `serverExternalPackages` missing | Check `next.config.ts:5` has `serverExternalPackages:['better-sqlite3']` |
| `ESLint: No configuration file found` | Deleted `.eslintrc.json` without `eslint.config.mjs` | Keep `eslint.config.mjs` (flat config), CI uses `eslint .` |
| `vitest: Cannot resolve @/lib/...` | Missing `vitest.config.mjs` alias | Ensure `vitest.config.mjs` exists (added `resolve.alias.@`) |
| `SESSION_SECRET` error | Missing env | Set `SESSION_SECRET` ≥32 chars in Vercel/CI/local `.env` |
| `Invariant: cookies() async` warning | Next 15 requires `await cookies()` | Already fixed: `lib/auth.ts:101`, `lib/cart.ts:54`, `app/catalog/page.tsx:21` use `await` |
| `data/app.db` committed | `.gitignore` missing `data/` | Pull latest `.gitignore` (now ignores `data/`, `.vercel/`, `.turbo/`) |

**Check Vercel logs:** Vercel → Project → Logs → filter `ENOENT` or `level:error` → should be empty after fix.

**Check CI logs:** GitHub → Actions → latest run → `verify` → `Build` → `✓ Compiled successfully`.

---

## 8. Rollback

If new build fails:

```bash
git log --oneline   # find last good SHA (e.g., 44cbd79)
git push --force origin <good-SHA>:main
# or Vercel → Deployments → Latest → Redeploy → Select previous
```

DB is ephemeral, so rollback does not affect `/tmp` data.

---

## 9. Reference

- Repo: `https://github.com/steamytooolz-commits/My-first-demo`
- Vercel Project: `my-first-demo-main` (`prj_bRlZYQh5lFbUhl19jgOiKyeX1ej4`, team `jordan-ad2c`)
- Seed: `scripts/seed.mjs` (15 products, 21 variants, `WELCOME10` etc.)
- Compliance: `ASSUMPTIONS.md`
- Vercel Logs doc: `https://vercel.com/docs/logs/runtime`

---

**For South Africa:** Ensure `SEED_TAX_ENABLED` matches `tax_rate_percent` (15% VAT) before `seed` if you need tax-inclusive pricing in prod.
