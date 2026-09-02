# Paper & Quill Stationery Online Store — Build Assumptions

> **Disclaimer:** This document describes a **demonstration / simulation** e-commerce build. It is not legal advice. Statutory references are provided for transparency and have been verified against the official Acts, but the implementation is simplified for demo purposes.

This document outlines the architectural assumptions, statutory compliance interpretations, and deterministic simulation behaviors implemented in the Paper & Quill stationery e-commerce application.

---

## 1. Stack & Architecture

- **Engine:** Next.js 15 App Router using React Server Components, Server Actions, and client components strictly for interactive state (cart drawer, variant selection, checkout simulation).
- **Persistence:** Local SQLite database using `better-sqlite3` configured with Write-Ahead Logging (`PRAGMA journal_mode = WAL`), immediate busy timeouts (`busy_timeout = 5000`), foreign key constraints (`PRAGMA foreign_keys = ON`), and full schema bootstrapping at startup. **On Vercel**, `DATABASE_FILE` is redirected to `/tmp/data/app.db` (ephemeral, per-lambda) with embedded fallback schema — see `DEPLOYMENT.md`.
- **Zero External SaaS (Simulation):** No external payment gateways (PayFast, Stripe, Ozow, etc.) or transactional email services (SendGrid, Mailgun) are required. All payment authorization, card capture, and manual EFT workflows are executed through deterministic local state machines. **Not a real payment system.**

---

## 2. Currency, Money & South African VAT Math

- **Integer Cents Representation:** All monetary values (`subtotal_cents`, `shipping_cents`, `tax_cents`, `total_cents`, `discount_cents`) are strictly stored and computed as 64-bit integer cents. No floating-point multiplication is used for ledger totals.
- **South African Standard VAT Rate:** **15%** standard rate per **Value-Added Tax Act 89 of 1991, Section 7(1)** (“levied at the standard rate ... currently 15%” — SARS). The rate was 14% until 1 April 2018; the 2025 proposal to increase to 15.5%/16% was withdrawn (SARS 2025 FAQs). All prices are VAT-inclusive per **Section 64 (prices deemed to include tax)** and **Section 65 (prices advertised to include tax)**.
- **VAT Calculation Formula (Tax Fraction):** Per **Section 10(2)** read with **Section 64**, where consideration is VAT-inclusive and not separately stated, the tax portion is the **tax fraction** `rate / (100 + rate)`:
  $$\text{VAT} = \text{round}\left(\text{Total Cents} \times \frac{15}{115}\right)$$
  This matches SARS guidance (e.g., `15/115` for 15%, `15.5/115.5` for 15.5% in 2025 FAQs) and guarantees exact SARS tax invoice consistency without off-by-one rounding artifacts.

---

## 3. Order & Payment Simulation Modes

- **Simulated Card (Mock Sandbox):**
  - **Success:** Approves immediately, transitions order to `paid`, generates a sequential VAT Tax Invoice (`INV-YYYY-NNNNNN`), decrements inventory, and logs audit events.
  - **Declined:** Leaves order in `pending_payment` state and allows the customer to retry simulated payment authorization from the order confirmation screen.
- **Manual EFT (Electronic Funds Transfer):**
  - Order is placed with `status = 'pending_payment'`.
  - Banking details (Standard Bank, Account, Branch Code `051001`, Reference) are prominently shown to the buyer and included on the downloadable Tax Invoice. **This is a simulation; no real bank account is verified.**
  - An Administrator can verify funds and transition order to `paid` from the Admin Order Management portal (`/admin/orders/[id]`).
- **Pay on Delivery:** Simulated `processing` status, no payment captured — demo only.

---

## 4. POPIA, Tax & Consumer Law — Verified References

> **Verification note (2026-09-02):** References checked against SAFLII/Gov.za PDFs. No hallucinations.

- **POPIA (Protection of Personal Information Act 4 of 2013):**
  - **Lawful basis:** Registration collects `email`, `full_name`, `phone` for **order fulfilment (contract)** per **Section 11(1)(b)** (“necessary for contract”), plus explicit consent for **order fulfilment** (`poia_processing_consent_at`) and optional `marketing_consent` per **Section 11(1)(a)** and **Section 69** (direct marketing requires consent). The “mandatory consent” label in UI is simplified for demo; contract is the primary basis.
  - **Purpose specification & Minimality:** Per **Section 13** (collection for specific purpose) and **Section 10** (minimality) — only fulfilment, tax, communication, and consented marketing are collected.
  - **Retention — POPIA Section 14:** Records must not be retained longer than necessary **unless** retention is **required or authorised by law** — **Section 14(1)(a)** (not (b); prior doc incorrectly cited (b)). Section 14(1)(c) (contract) and 14(2) (statistical/research with safeguards) also apply.
  - **Data Subject Rights — Sections 23 & 24:** Right to **access** (export JSON via `/api/account/export`) and **correction/deletion** (profile edit, address edit, erasure). Section 24(1)(b) requires destruction/deletion or **de-identification** as soon as reasonably practicable after no longer authorised.
  - **De-identification — Section 14(4)-(5):** Must destroy/delete or **de-identify** in manner preventing reconstruction. Our erasure hashes email to `erased-<id>@invalid.local`, scrubs `full_name`/`phone`, sets `password_hash='!'`, `status='disabled'`, redacts `shipping_address_json`/`buyer_json` — preserves invoice ledger while removing identifiers.
- **Tax Administration Act 28 of 2011 — Section 29 & 32:**
  - **Section 29(1)-(2):** Persons who have submitted a return must keep records enabling SARS to verify compliance.
  - **Section 29(3)(a):** Records **need not be retained after 5 years from the date of submission of the return**; **Section 29(3)(b):** If no return required but income received, 5 years from end of tax period. **Section 32:** If audit/objection/appeal notified, retain until concluded. Simplified in prior doc as “5 years for tax invoices” — **accurate for VAT vendors filing returns**, which applies here. Records must be kept **original form, orderly, safe place, open for inspection** — **Section 30**.
  - **Consequence:** Under **POPIA 14(1)(a)** + **TAA 29**, historic invoices/ledgers are lawfully retained 5 years; erasure therefore **de-identifies** rather than deletes invoices (preserves `seller_json`, `buyer_json` redacted, `line_items_json` retained).
- **7-Day Safety Grace Period (Simulation, Not Statutory):** POPIA does **not** prescribe a 7-day delay. Our queue (`data_subject_requests.scheduled_for = now + 7 days`) is a **demo safeguard** for support to review disputes before `processErasure` anonymizes. Administrators can trigger immediate `processErasure` if required by data subject.
- **Consumer Law — ECT Act 25 of 2002 vs CPA 68 of 2008:**
  - **ECT Section 43 (Information to be provided):** Supplier must provide on website: (a) full name/legal status, (b) physical address/phone, (c) website/email, (d) accreditation, (e) code of conduct, (f) registration number, (g) office bearers, (h) description of goods, (i) **full price including transport/taxes/fees**, (j) payment manner, (k) terms/guarantees, (l) delivery time, (m) record access, (n) return/refund policy, (o) ADR code, (p) security/privacy policy, (q) duration of agreement, (r) Section 44 rights — plus **opportunity to review/correct/withdraw before ordering** (43(2)). If supplier fails 43(1)/(2), consumer may **cancel within 14 days** (43(3)).
  - **ECT Section 44 (Cooling-off):** Consumer may **cancel without reason/penalty** any electronic transaction for **goods within 7 days after receipt** or **services within 7 days after conclusion**; only direct cost of return may be charged (44(2)); refund within **30 days** (44(3)). Does **not** apply to financial services, auctions, perishable/personalised goods (44(2)(a)-(f)).
  - **CPA Section 16 (Direct marketing cooling-off):** **5 business days** after later of conclusion/delivery **if** transaction resulted from direct marketing — **but Section 16(1) expressly states it does NOT apply if ECT Section 44 applies**. For this store (electronic transactions), **ECT 7 days trumps CPA 5 days**. Our `shipping/page.tsx` offers a **voluntary 30-day** guarantee — **more generous than the statutory 7 days**, so compliant.
  - **CPA Section 19(5) & 20/56:** Right to examine goods before delivery and return unsafe/defective goods — not simulated but disclosed in terms.

---

## 5. Seed Data & Test Accounts (Demo Only)

- **Admin Account:**
  - Email: `admin@example.com`
  - Password: `ChangeMe123!`
  - Role: `admin`
- **Customer Account:**
  - Email: `customer@example.com`
  - Password: `Customer123!`
  - Role: `customer`
- **Promotional Coupons (as seeded in `scripts/seed.mjs`):**
  - `WELCOME10` — 10% off ≥R100, max R150, one-per-customer, 500 uses
  - `SAVE50` — R50 off ≥R300, 200 uses
  - `FREESHIP` — free shipping ≥R750, 100 uses
  - *Note: Prior doc listed `WELCOME15` (15% off ≥R200) — that code does not exist in seed; actual codes are above.*

---

## 6. Operational Notes

- **Vercel Ephemeral DB:** `lib/db.ts` redirects `DATABASE_FILE` to `/tmp/data/app.db` on Vercel, bootstraps `FALLBACK_SCHEMA` if empty, and auto-seeds admin/customer via `ensureDefaultSeed`. Sessions are **JWT-stateful fallback** to survive per-lambda `/tmp` loss. Full catalog seed requires Build Command `bun run db:migrate && bun run db:seed && bun run build`.
- **Security:** `SESSION_COOKIE_NAME=jpf_session` (`httpOnly`, `secure=isProd`, `sameSite=isProd?'none':'lax'`), `scrypt:N=16384,r=8,p=1` passwords, `sha256` token hash, 30-day expiry, rate-limit `checkRateLimit` (DB-backed on Vercel) + `login_attempts` (5/15min per email+IP).
- **Not Legal Advice:** This is a portfolio/demo store. For production use, consult a South African attorney and SARS practitioner.


