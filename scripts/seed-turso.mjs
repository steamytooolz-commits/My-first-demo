// Turso (LibSQL) full seed — 15 products, coupons, demo users.
// Mirrors scripts/seed.mjs productsData (keep in sync) but writes via @libsql/client.
// Usage:
//   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." node scripts/seed-turso.mjs
// CI usage (local file, no cloud):
//   TURSO_DATABASE_URL="file:/tmp/turso-ci.db" node scripts/seed-turso.mjs
// NOTE: run scripts/migrate-turso.mjs first. Demo orders are intentionally
// skipped here (created live via checkout); users/settings/catalog/coupons are seeded.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error('[seed-turso] Error: TURSO_DATABASE_URL is not set.');
  console.error('  Local dev / VPS: use `node scripts/seed.mjs` (better-sqlite3 file) instead.');
  process.exit(1);
}

const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
const client = createClient({ url, authToken });
const q = (sql, args = []) => client.execute({ sql, args });
const row0 = async (sql, args = []) => (await q(sql, args)).rows[0];

console.log(`[seed-turso] Seeding Turso database: ${url.replace(/:[^:@/]+@/, ':***@')}`);

const seedImagesDir = path.resolve('public/seed');
if (!fs.existsSync(seedImagesDir)) {
  fs.mkdirSync(seedImagesDir, { recursive: true });
}

function hashPassword(password) {
  const N = 16384;
  const r = 8;
  const p = 1;
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64, { N, r, p });
  return `scrypt:${N}:${r}:${p}:${salt}:${derivedKey.toString('hex')}`;
}

function generateSvgPlaceholder(filename, title, colorHex, iconChar) {
  const filePath = path.join(seedImagesDir, filename);
  if (fs.existsSync(filePath)) return `/seed/${filename}`;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <defs>
    <linearGradient id="grad-${filename.replace(/[^a-z0-9]/gi, '')}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colorHex}" stop-opacity="0.15" />
      <stop offset="100%" stop-color="${colorHex}" stop-opacity="0.3" />
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="#F8FAFC" />
  <rect x="40" y="40" width="520" height="520" rx="24" fill="url(#grad-${filename.replace(/[^a-z0-9]/gi, '')})" stroke="${colorHex}" stroke-width="2" stroke-dasharray="8 8" />
  <circle cx="300" cy="240" r="70" fill="${colorHex}" fill-opacity="0.2" />
  <text x="300" y="260" font-family="system-ui, sans-serif" font-size="64" font-weight="bold" fill="${colorHex}" text-anchor="middle">${iconChar}</text>
  <text x="300" y="360" font-family="system-ui, sans-serif" font-size="24" font-weight="600" fill="#1E293B" text-anchor="middle">${title}</text>
  <text x="300" y="400" font-family="system-ui, sans-serif" font-size="14" fill="#64748B" text-anchor="middle">Paper &amp; Quill Stationery • Premium Quality</text>
</svg>
`.trim();
  fs.writeFileSync(filePath, svg, 'utf-8');
  return `/seed/${filename}`;
}

// Store settings
const taxEnabled = process.env.SEED_TAX_ENABLED === 'true';
const taxRatePercent = Number(process.env.SEED_TAX_RATE_PERCENT || 0);
await q(`
  INSERT INTO settings (key, value_json)
  VALUES ('store', ?)
  ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
`, [JSON.stringify({
  store_name: 'Paper & Quill Stationery',
  contact_email: 'hello@paperandquill.co.za',
  phone: '',
  address_line1: '42 Bram Fischer Drive',
  address_line2: 'Ferndale',
  city: 'Johannesburg',
  province: 'Gauteng',
  postal_code: '2194',
  country: 'ZA',
  currency: 'ZAR',
  tax_enabled: taxEnabled,
  tax_rate_percent: taxRatePercent,
  prices_include_tax: true,
  shipping_taxable: true,
  free_shipping_enabled: true,
  free_shipping_threshold_cents: 95000,
  standard_base_cents: 7500,
  express_base_cents: 15000,
  weight_threshold_g: 5000,
  weight_surcharge_cents: 2500,
  express_weight_surcharge_cents: 5000,
  invoice_prefix: 'INV',
  order_prefix: 'ORD',
  invoice_due_days: 14,
  bank_name: 'First National Bank',
  bank_account_name: 'Paper & Quill Stationery (Pty) Ltd',
  bank_account_number: '62000000000',
  bank_branch_code: '250655',
  bank_reference_note: 'Please use your Order Number as payment reference',
  vat_number: taxEnabled ? '4010293847' : '',
})]);
console.log('[seed-turso] Store settings configured.');

// Admin + demo customer (deterministic IDs match lib/db.ts fallback seed)
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
if (!(await row0('SELECT id FROM users WHERE email = ? COLLATE NOCASE', [adminEmail]))) {
  await q(`INSERT INTO users (id, email, password_hash, full_name, phone, role, status, marketing_consent, poia_processing_consent_at, created_at, updated_at) VALUES (?, ?, ?, 'System Administrator', '', 'admin', 'active', 0, datetime('now'), datetime('now'), datetime('now'))`,
    ['00000000-0000-4000-a000-000000000001', adminEmail, hashPassword(adminPassword)]);
  console.log(`[seed-turso] Created admin account: ${adminEmail}`);
} else {
  console.log(`[seed-turso] Admin account already exists: ${adminEmail}`);
}

if (process.env.SEED_DEMO !== 'false') {
  if (!(await row0('SELECT id FROM users WHERE email = ? COLLATE NOCASE', ['customer@example.com']))) {
    const demoId = '00000000-0000-4000-a000-000000000002';
    await q(`INSERT INTO users (id, email, password_hash, full_name, phone, role, status, marketing_consent, poia_processing_consent_at, created_at, updated_at) VALUES (?, ?, ?, 'Thabo Mokoena', '', 'customer', 'active', 0, datetime('now'), datetime('now'), datetime('now'))`,
      [demoId, 'customer@example.com', hashPassword('Customer123!')]);
    await q(`INSERT INTO addresses (id, user_id, label, full_name, phone, line1, line2, city, province, postal_code, country, is_default) VALUES (?, ?, 'Home', 'Thabo Mokoena', '', '12 Protea Lane', 'Apt 4B', 'Rosebank', 'Gauteng', '2196', 'ZA', 1)`,
      [crypto.randomUUID(), demoId]);
    console.log('[seed-turso] Created demo customer: customer@example.com');
  } else {
    console.log('[seed-turso] Demo customer already exists: customer@example.com');
  }
}

// Categories (deterministic IDs match lib/db.ts fallback seed)
const categories = [
  { id: '11111111-1111-4000-8000-000000000001', name: 'Pens & Writing', slug: 'pens-writing', description: 'Fine pens, gel pens, highlighters, and precision drawing instruments', sort_order: 1 },
  { id: '11111111-1111-4000-8000-000000000002', name: 'Notebooks & Pads', slug: 'notebooks-pads', description: 'Hardcover journals, dot-grid books, and premium paper refills', sort_order: 2 },
  { id: '11111111-1111-4000-8000-000000000003', name: 'Office Supplies', slug: 'office-supplies', description: 'Desk organizers, staplers, paper clips, and archival storage', sort_order: 3 },
  { id: '11111111-1111-4000-8000-000000000004', name: 'Art Supplies', slug: 'art-supplies', description: 'Watercolour markers, sketching pencils, and artist canvas pads', sort_order: 4 },
  { id: '11111111-1111-4000-8000-000000000005', name: 'School Essentials', slug: 'school-essentials', description: 'Durable pencil cases, geometric math sets, and scientific calculators', sort_order: 5 },
];
const categoryIdMap = new Map();
for (const cat of categories) {
  const existing = await row0('SELECT id FROM categories WHERE slug = ?', [cat.slug]);
  if (!existing) {
    await q(`INSERT INTO categories (id, name, slug, description, active, sort_order) VALUES (?, ?, ?, ?, 1, ?)`,
      [cat.id, cat.name, cat.slug, cat.description, cat.sort_order]);
    categoryIdMap.set(cat.slug, cat.id);
  } else {
    categoryIdMap.set(cat.slug, existing.id);
  }
}
console.log(`[seed-turso] Categories populated (${categories.length} total).`);

// Products (keep in sync with scripts/seed.mjs — 15 products, ZAR pricing)
const productsData = [
  { name: 'A4 Hardcover Executive Notebook', slug: 'a4-hardcover-notebook', category: 'notebooks-pads', brand: 'Kalahari Paper Co.', description: '192 numbered pages of 100gsm acid-free ivory paper. Features an expandable rear pocket and dual ribbon bookmarks.', featured: 1, image: generateSvgPlaceholder('a4-notebook.svg', 'A4 Executive Notebook', '#0F766E', 'NB'), variants: [
    { sku: 'NB-A4-BLK', name: 'Matte Charcoal Black', price_cents: 24500, compare_at_price_cents: 28000, cost_cents: 12000, stock_qty: 45, low_stock_threshold: 5, weight_g: 480 },
    { sku: 'NB-A4-NAVY', name: 'Deep Midnight Navy', price_cents: 24500, compare_at_price_cents: 28000, cost_cents: 12000, stock_qty: 3, low_stock_threshold: 5, weight_g: 480 },
  ]},
  { name: 'A5 Dot Grid Journal', slug: 'a5-dot-grid-journal', category: 'notebooks-pads', brand: 'Kalahari Paper Co.', description: 'Designed for bullet journaling and daily planning with a subtle 5mm dot grid and lay-flat Smyth-sewn binding.', featured: 1, image: generateSvgPlaceholder('a5-journal.svg', 'A5 Dot Grid Journal', '#0284C7', 'NB'), variants: [
    { sku: 'NB-A5-SAGE', name: 'Desert Sage Green', price_cents: 18500, compare_at_price_cents: null, cost_cents: 9000, stock_qty: 60, low_stock_threshold: 5, weight_g: 320 },
    { sku: 'NB-A5-TERRA', name: 'Terracotta Rust', price_cents: 18500, compare_at_price_cents: null, cost_cents: 9000, stock_qty: 2, low_stock_threshold: 5, weight_g: 320 },
  ]},
  { name: 'SmoothFlow Retractable Gel Pen 5-Pack', slug: 'gel-pen-5-pack', category: 'pens-writing', brand: 'Cape Quill Co.', description: '0.5mm archival Japanese pigment ink with rubberized contoured grip. Dries in under one second to prevent smudging.', featured: 1, image: generateSvgPlaceholder('gel-pens.svg', 'Gel Pen 5-Pack', '#4F46E5', 'PN'), variants: [
    { sku: 'PEN-GEL-BLK', name: 'Jet Black Ink (5-Pack)', price_cents: 11500, compare_at_price_cents: 13500, cost_cents: 5000, stock_qty: 120, low_stock_threshold: 10, weight_g: 75 },
    { sku: 'PEN-GEL-BLU', name: 'Ocean Royal Blue (5-Pack)', price_cents: 11500, compare_at_price_cents: 13500, cost_cents: 5000, stock_qty: 0, low_stock_threshold: 10, weight_g: 75 },
  ]},
  { name: 'Vintage Brass Fountain Pen', slug: 'vintage-brass-fountain-pen', category: 'pens-writing', brand: 'Cape Quill Co.', description: 'Heavyweight machined solid brass body with a fine stainless steel German nib. Includes piston converter and presentation box.', featured: 1, image: generateSvgPlaceholder('fountain-pen.svg', 'Brass Fountain Pen', '#D97706', 'FP'), variants: [
    { sku: 'PEN-FTN-F', name: 'Fine Nib (0.5mm)', price_cents: 65000, compare_at_price_cents: 75000, cost_cents: 32000, stock_qty: 18, low_stock_threshold: 3, weight_g: 110 },
    { sku: 'PEN-FTN-M', name: 'Medium Nib (0.7mm)', price_cents: 65000, compare_at_price_cents: 75000, cost_cents: 32000, stock_qty: 14, low_stock_threshold: 3, weight_g: 110 },
  ]},
  { name: 'Pastel Chisel-Tip Highlighters (Set of 6)', slug: 'pastel-highlighters-set', category: 'pens-writing', brand: 'Lumina Stationery', description: 'Soft pastel hues that do not bleed through thin Bible or notebook pages. Water-based non-toxic formulation.', featured: 0, image: generateSvgPlaceholder('highlighters.svg', 'Pastel Highlighters', '#EC4899', 'HL'), variants: [
    { sku: 'HL-PSTL-6', name: 'Standard 6-Color Set', price_cents: 9800, compare_at_price_cents: null, cost_cents: 4200, stock_qty: 85, low_stock_threshold: 10, weight_g: 130 },
  ]},
  { name: 'Heavy Duty Desktop Stapler', slug: 'heavy-duty-stapler', category: 'office-supplies', brand: 'Forge Workstation', description: 'Cast-iron core with rubberized base. Effortlessly staples up to 40 sheets of standard 80gsm copy paper with no jamming.', featured: 0, image: generateSvgPlaceholder('stapler.svg', 'Desktop Stapler', '#475569', 'ST'), variants: [
    { sku: 'OFF-STP-SLV', name: 'Brushed Silver & Slate', price_cents: 22000, compare_at_price_cents: 26000, cost_cents: 10500, stock_qty: 24, low_stock_threshold: 4, weight_g: 620 },
  ]},
  { name: 'Self-Adhesive Sticky Notes Bundle (6 Pads)', slug: 'sticky-notes-bundle', category: 'office-supplies', brand: 'Lumina Stationery', description: '76mm x 76mm high-adhesion notes that peel off cleanly without residue. 100 sheets per pad across 6 warm pastel colors.', featured: 0, image: generateSvgPlaceholder('sticky-notes.svg', 'Sticky Notes Bundle', '#EAB308', 'SN'), variants: [
    { sku: 'OFF-STK-6', name: 'Warm Palette 6-Pack', price_cents: 8500, compare_at_price_cents: null, cost_cents: 3500, stock_qty: 150, low_stock_threshold: 15, weight_g: 260 },
  ]},
  { name: 'A4 Premium 80gsm Copy Paper (500 Sheets)', slug: 'a4-printer-paper-500', category: 'office-supplies', brand: 'Kalahari Paper Co.', description: 'Ultra-bright CIE 165 white multipurpose bond paper. Ideal for high-speed laser, inkjet, and double-sided printing.', featured: 0, image: generateSvgPlaceholder('paper-ream.svg', 'A4 Copy Paper Ream', '#64748B', 'PP'), variants: [
    { sku: 'PAP-A4-REAM', name: 'Single Ream (500 sheets)', price_cents: 11000, compare_at_price_cents: null, cost_cents: 7500, stock_qty: 90, low_stock_threshold: 10, weight_g: 2500 },
  ]},
  { name: 'Magnetic Dry-Erase Whiteboard Markers (4-Pack)', slug: 'whiteboard-markers-4-pack', category: 'office-supplies', brand: 'Cape Quill Co.', description: 'Low-odor vibrant pigment with bullet tip and integrated cap eraser plus magnet. Erases cleanly from porcelain and glass.', featured: 0, image: generateSvgPlaceholder('whiteboard-markers.svg', 'Whiteboard Markers', '#2563EB', 'WM'), variants: [
    { sku: 'WB-MRK-4', name: 'Assorted Basic Colors', price_cents: 7500, compare_at_price_cents: null, cost_cents: 3000, stock_qty: 4, low_stock_threshold: 5, weight_g: 95 },
  ]},
  { name: 'Canvas Rolled Artist Pencil Case', slug: 'canvas-rolled-pencil-case', category: 'art-supplies', brand: 'Artisan Workshop', description: 'Waxed 16oz cotton canvas with 36 elastic slots and protective leather flap. Keeps fineliners and pencils safe in transit.', featured: 1, image: generateSvgPlaceholder('pencil-case.svg', 'Canvas Pencil Case', '#B45309', 'PC'), variants: [
    { sku: 'ART-CS-TAN', name: 'Vintage Tan Canvas', price_cents: 19500, compare_at_price_cents: 23000, cost_cents: 9500, stock_qty: 32, low_stock_threshold: 5, weight_g: 180 },
    { sku: 'ART-CS-OLV', name: 'Army Olive Green', price_cents: 19500, compare_at_price_cents: 23000, cost_cents: 9500, stock_qty: 0, low_stock_threshold: 5, weight_g: 180 },
  ]},
  { name: 'Dual-Power Scientific School Calculator', slug: 'scientific-school-calculator', category: 'school-essentials', brand: 'Matrico Instruments', description: '240 computational functions with 2-line natural textbook display. Solar powered with battery backup and hard slide case.', featured: 1, image: generateSvgPlaceholder('calculator.svg', 'Scientific Calculator', '#1E293B', 'SC'), variants: [
    { sku: 'SCH-CALC-STD', name: 'Black Case Edition', price_cents: 28500, compare_at_price_cents: 32000, cost_cents: 14000, stock_qty: 40, low_stock_threshold: 5, weight_g: 210 },
  ]},
  { name: 'Solid Wood Geometric Desk Organizer', slug: 'solid-wood-desk-organizer', category: 'office-supplies', brand: 'Forge Workstation', description: 'Sustainable South African pine wood with compartments for smartphones, pens, sticky notes, and paperclips.', featured: 1, image: generateSvgPlaceholder('desk-organizer.svg', 'Wood Desk Organizer', '#78350F', 'DO'), variants: [
    { sku: 'OFF-ORG-NAT', name: 'Natural Honey Pine', price_cents: 34500, compare_at_price_cents: 39500, cost_cents: 16000, stock_qty: 15, low_stock_threshold: 3, weight_g: 720 },
  ]},
  { name: 'Leather A6 Pocket Notebook', slug: 'leather-a6-pocket-notebook', category: 'notebooks-pads', brand: 'Kalahari Paper Co.', description: 'Full-grain bovine leather cover with 160 pages of 90gsm cream paper. Fits jacket pocket for field notes across South Africa.', featured: 0, image: generateSvgPlaceholder('pocket-notebook.svg', 'Leather Pocket Notebook', '#7C2D12', 'PN'), variants: [
    { sku: 'NB-A6-TAN', name: 'Cognac Tan Leather', price_cents: 16500, compare_at_price_cents: 19500, cost_cents: 8000, stock_qty: 38, low_stock_threshold: 5, weight_g: 210 },
  ]},
  { name: 'Stainless Steel Ruler & Geometry Set', slug: 'steel-ruler-geometry-set', category: 'school-essentials', brand: 'Matrico Instruments', description: '30cm stainless ruler, 180-degree protractor, and set squares in a tin. SABS-approved for matric examinations.', featured: 0, image: generateSvgPlaceholder('geometry-set.svg', 'Geometry Set', '#0E7490', 'GS'), variants: [
    { sku: 'SCH-GEO-SET', name: 'Standard 4-Piece Set', price_cents: 9500, compare_at_price_cents: null, cost_cents: 4200, stock_qty: 70, low_stock_threshold: 10, weight_g: 180 },
  ]},
  { name: 'Archival Ballpoint Pen 3-Pack', slug: 'archival-ballpoint-3-pack', category: 'pens-writing', brand: 'Cape Quill Co.', description: '1.0mm oil-based archival ink, 635m write-out length per pen. SARS document-safe for signing tax invoices and contracts.', featured: 0, image: generateSvgPlaceholder('ballpoints.svg', 'Ballpoint 3-Pack', '#1D4ED8', 'BP'), variants: [
    { sku: 'PEN-BALL-3BLK', name: 'Black Ink (3-Pack)', price_cents: 8900, compare_at_price_cents: 10500, cost_cents: 3800, stock_qty: 110, low_stock_threshold: 15, weight_g: 60 },
  ]},
];

for (const p of productsData) {
  const categoryId = categoryIdMap.get(p.category);
  const existingProduct = await row0('SELECT id FROM products WHERE slug = ?', [p.slug]);
  let productId = existingProduct?.id;
  if (!existingProduct) {
    productId = crypto.randomUUID();
    await q(`INSERT INTO products (id, category_id, name, slug, description, brand, active, featured, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))`,
      [productId, categoryId, p.name, p.slug, p.description, p.brand, p.featured]);
    await q(`INSERT INTO product_images (id, product_id, url, alt, position) VALUES (?, ?, ?, ?, 0)`,
      [crypto.randomUUID(), productId, p.image, p.name]);
  }
  for (const v of p.variants) {
    if (!(await row0('SELECT id FROM product_variants WHERE sku = ?', [v.sku]))) {
      const variantId = crypto.randomUUID();
      await q(`INSERT INTO product_variants (id, product_id, sku, name, options_json, price_cents, compare_at_price_cents, cost_cents, stock_qty, low_stock_threshold, weight_g, barcode, active, created_at, updated_at) VALUES (?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?, NULL, 1, datetime('now'), datetime('now'))`,
        [variantId, productId, v.sku, v.name, v.price_cents, v.compare_at_price_cents, v.cost_cents, v.stock_qty, v.low_stock_threshold, v.weight_g]);
      await q(`INSERT INTO stock_movements (id, variant_id, delta, reason, note, created_at) VALUES (?, ?, ?, 'seed', 'Initial database seed', datetime('now'))`,
        [crypto.randomUUID(), variantId, v.stock_qty]);
    }
  }
}
console.log(`[seed-turso] Products and variants seeded (${productsData.length} products).`);

// Coupons
const coupons = [
  { code: 'WELCOME10', type: 'percent', value: 10, min_subtotal_cents: 10000, max_discount_cents: 15000, usage_limit: 500, one_per_customer: 1 },
  { code: 'SAVE50', type: 'fixed', value: 5000, min_subtotal_cents: 30000, max_discount_cents: null, usage_limit: 200, one_per_customer: 0 },
  { code: 'FREESHIP', type: 'free_shipping', value: 0, min_subtotal_cents: 75000, max_discount_cents: null, usage_limit: 100, one_per_customer: 0 },
];
for (const c of coupons) {
  if (!(await row0('SELECT id FROM coupons WHERE code = ? COLLATE NOCASE', [c.code]))) {
    await q(`INSERT INTO coupons (id, code, type, value, min_subtotal_cents, max_discount_cents, usage_limit, used_count, one_per_customer, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 1, datetime('now'))`,
      [crypto.randomUUID(), c.code, c.type, c.value, c.min_subtotal_cents, c.max_discount_cents, c.usage_limit, c.one_per_customer]);
  }
}
console.log('[seed-turso] Promotional coupons seeded (WELCOME10, SAVE50, FREESHIP).');
console.log('[seed-turso] Database seed completed successfully!');
