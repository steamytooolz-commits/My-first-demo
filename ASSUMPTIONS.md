# Paper & Quill Stationery Online Store — Build Assumptions

This document outlines the architectural assumptions, statutory compliance interpretations, and deterministic simulation behaviors implemented in the Paper & Quill stationery e-commerce application.

---

## 1. Stack & Architecture

- **Engine:** Next.js 15 App Router using React Server Components, Server Actions, and client components strictly for interactive state (cart drawer, variant selection, checkout simulation).
- **Persistence:** Local SQLite database using `better-sqlite3` configured with Write-Ahead Logging (`PRAGMA journal_mode = WAL`), immediate busy timeouts (`busy_timeout = 5000`), foreign key constraints (`PRAGMA foreign_keys = ON`), and full schema bootstrapping at startup.
- **Zero External SaaS:** No external payment gateways (PayFast, Stripe, Ozow, etc.) or transactional email services (SendGrid, Mailgun) are required. All payment authorization, card capture, and manual EFT workflows are executed through deterministic local state machines.

---

## 2. Currency, Money & South African VAT Math

- **Integer Cents Representation:** All monetary values (`subtotal_cents`, `shipping_cents`, `tax_cents`, `total_cents`, `discount_cents`) are strictly stored and computed as 64-bit integer cents. No floating-point multiplication is used for ledger totals.
- **South African Standard VAT Rate:** Set to 15% in accordance with the South African Value-Added Tax Act, 1991.
- **VAT Calculation Formula:** Because consumer retail prices in South Africa are VAT-inclusive by default:
  $$\text{VAT} = \text{round}\left(\text{Total Cents} \times \frac{15}{115}\right)$$
  This guarantees exact SARS tax invoice consistency without off-by-one penny rounding artifacts.

---

## 3. Order & Payment Simulation Modes

- **Simulated Card (Mock Sandbox):**
  - **Success:** Approves immediately, transitions order to `paid`, generates a sequential VAT Tax Invoice (`INV-YYYY-NNNNNN`), decrements inventory, and logs audit events.
  - **Declined:** Leaves order in `pending_payment` state and allows the customer to retry simulated payment authorization from the order confirmation screen.
- **Manual EFT (Electronic Funds Transfer):**
  - Order is placed with `status = 'pending_payment'`.
  - Banking details (Standard Bank, Account, Branch Code `051001`, Reference) are prominently shown to the buyer and included on the downloadable Tax Invoice.
  - An Administrator can verify funds and transition order to `paid` from the Admin Order Management portal (`/admin/orders/[id]`).

---

## 4. POPIA (Protection of Personal Information Act) & SARS Compliance

- **Mandatory Consent:** Customer registration requires affirmative consent to the processing of personal data for order fulfilment.
- **Data Portability (Access):** Customers can download their complete profile, address, order, and consent records in standard JSON format (`/api/account/export`).
- **Erasure vs Statutory Retention (The 5-Year SARS Rule):**
  - Section 29 of the South African Tax Administration Act (TAA), 2011, mandates that issued tax invoices and financial ledgers be preserved for a minimum of 5 years.
  - Under POPIA Section 14(1)(b), personal information may be retained where required or authorized by law.
  - Therefore, during customer account erasure, user identity is irreversibly de-identified (hashed to `deleted-user-[id]@anonymized.invalid`, passwords scrambled, names and telephone numbers purged) while preserving the integrity of historic tax invoices and financial audits.
- **7-Day Safety Grace Period:** Customer erasure requests are queued for 7 days before execution, during which customer support can review pending disputes. Administrators can also trigger immediate de-identification if requested.

---

## 5. Seed Data & Test Accounts

- **Admin Account:**
  - Email: `admin@example.com`
  - Password: `ChangeMe123!`
  - Role: `admin`
- **Customer Account:**
  - Email: `customer@example.com`
  - Password: `Customer123!`
  - Role: `customer`
- **Promotional Coupon:**
  - Code: `WELCOME15` (15% off orders with min spend R200.00)
