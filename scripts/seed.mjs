import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

function getEffectiveDbPathSeed() {
  const raw = process.env.DATABASE_FILE || './data/app.db';
  const isVercel = !!process.env.VERCEL;
  if (isVercel) {
    if (raw.startsWith('/var/task/')) return raw.replace('/var/task', '/tmp');
    if (raw.startsWith('/tmp/')) return raw;
    const cleaned = raw.replace(/^\.\//, '').replace(/^\//, '');
    return path.join('/tmp', cleaned);
  }
  return raw;
}

let dbPath = getEffectiveDbPathSeed();
let dataDir = path.dirname(path.resolve(dbPath));
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (err) {
  const fallbackDir = path.join('/tmp', 'data');
  if (!fs.existsSync(fallbackDir)) fs.mkdirSync(fallbackDir, { recursive: true });
  const fallbackPath = path.join(fallbackDir, path.basename(dbPath));
  console.warn(`[seed] mkdir failed for ${dataDir} (${err.message}), falling back to ${fallbackPath}`);
  dbPath = fallbackPath;
  dataDir = fallbackDir;
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

console.log(`[seed] Seeding database at ${dbPath}...`);

// Ensure seed image directory exists
const seedImagesDir = path.resolve('public/seed');
if (!fs.existsSync(seedImagesDir)) {
  fs.mkdirSync(seedImagesDir, { recursive: true });
}

// Helper to hash password using scrypt (same as lib/auth.ts)
function hashPassword(password) {
  const N = 16384;
  const r = 8;
  const p = 1;
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64, { N, r, p });
  return `scrypt:${N}:${r}:${p}:${salt}:${derivedKey.toString('hex')}`;
}

// Generate an SVG placeholder file locally
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

// Seed Store Settings
const taxEnabled = process.env.SEED_TAX_ENABLED === 'true';
const taxRatePercent = Number(process.env.SEED_TAX_RATE_PERCENT || 0);

const storeSettings = {
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
};

db.prepare(`
  INSERT INTO settings (key, value_json)
  VALUES ('store', ?)
  ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json
`).run(JSON.stringify(storeSettings));

console.log('[seed] Store settings configured.');

// Seed Admin User
const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

if (!adminEmail || !adminPassword) {
  console.error('[seed] Error: ADMIN_EMAIL or ADMIN_PASSWORD missing.');
  process.exit(1);
}

const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(adminEmail);
let adminUserId = existingAdmin?.id;

if (!existingAdmin) {
  adminUserId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO users (
      id, email, password_hash, full_name, phone, role, status,
      marketing_consent, poia_processing_consent_at, created_at, updated_at
    ) VALUES (
      ?, ?, ?, 'System Administrator', '', 'admin', 'active',
      0, datetime('now'), datetime('now'), datetime('now')
    )
  `).run(adminUserId, adminEmail.toLowerCase(), hashPassword(adminPassword));
  console.log(`[seed] Created admin account: ${adminEmail}`);
} else {
  console.log(`[seed] Admin account already exists: ${adminEmail}`);
}

// Seed Demo Customer
const seedDemo = process.env.SEED_DEMO !== 'false';
let demoCustomerId = null;

if (seedDemo) {
  const demoEmail = 'customer@example.com';
  const demoPassword = 'Customer123!';

  const existingDemo = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(demoEmail);
  if (!existingDemo) {
    demoCustomerId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO users (
        id, email, password_hash, full_name, phone, role, status,
        marketing_consent, poia_processing_consent_at, created_at, updated_at
      ) VALUES (
        ?, ?, ?, 'Thabo Mokoena', '', 'customer', 'active',
        0, datetime('now'), datetime('now'), datetime('now')
      )
    `).run(demoCustomerId, demoEmail, hashPassword(demoPassword));

    // Demo customer default address
    db.prepare(`
      INSERT INTO addresses (
        id, user_id, label, full_name, phone, line1, line2, city, province, postal_code, country, is_default
      ) VALUES (
        ?, ?, 'Home', 'Thabo Mokoena', '', '12 Protea Lane', 'Apt 4B', 'Rosebank', 'Gauteng', '2196', 'ZA', 1
      )
    `).run(crypto.randomUUID(), demoCustomerId);

    console.log(`[seed] Created demo customer: ${demoEmail}`);
  } else {
    demoCustomerId = existingDemo.id;
    console.log(`[seed] Demo customer already exists: ${demoEmail}`);
  }
}

// Seed Categories
const categories = [
  { name: 'Pens & Writing', slug: 'pens-writing', description: 'Fine pens, gel pens, highlighters, and precision drawing instruments', sort_order: 1 },
  { name: 'Notebooks & Pads', slug: 'notebooks-pads', description: 'Hardcover journals, dot-grid books, and premium paper refills', sort_order: 2 },
  { name: 'Office Supplies', slug: 'office-supplies', description: 'Desk organizers, staplers, paper clips, and archival storage', sort_order: 3 },
  { name: 'Art Supplies', slug: 'art-supplies', description: 'Watercolour markers, sketching pencils, and artist canvas pads', sort_order: 4 },
  { name: 'School Essentials', slug: 'school-essentials', description: 'Durable pencil cases, geometric math sets, and scientific calculators', sort_order: 5 },
];

const categoryIdMap = new Map();

for (const cat of categories) {
  let existing = db.prepare('SELECT id FROM categories WHERE slug = ?').get(cat.slug);
  if (!existing) {
    const catId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO categories (id, name, slug, description, active, sort_order)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(catId, cat.name, cat.slug, cat.description, cat.sort_order);
    categoryIdMap.set(cat.slug, catId);
  } else {
    categoryIdMap.set(cat.slug, existing.id);
  }
}
console.log(`[seed] Categories populated (${categories.length} total).`);

// Seed Products and Variants (15 products, 21 variants total, including low stock & out-of-stock)
const productsData = [
  {
    name: 'A4 Hardcover Executive Notebook',
    slug: 'a4-hardcover-notebook',
    category: 'notebooks-pads',
    brand: 'Kalahari Paper Co.',
    description: '192 numbered pages of 100gsm acid-free ivory paper. Features an expandable rear pocket and dual ribbon bookmarks.',
    featured: 1,
    image: generateSvgPlaceholder('a4-notebook.svg', 'A4 Executive Notebook', '#0F766E', '📓'),
    variants: [
      { sku: 'NB-A4-BLK', name: 'Matte Charcoal Black', price_cents: 24500, compare_at_price_cents: 28000, cost_cents: 12000, stock_qty: 45, low_stock_threshold: 5, weight_g: 480 },
      { sku: 'NB-A4-NAVY', name: 'Deep Midnight Navy', price_cents: 24500, compare_at_price_cents: 28000, cost_cents: 12000, stock_qty: 3, low_stock_threshold: 5, weight_g: 480 }, // LOW STOCK
    ]
  },
  {
    name: 'A5 Dot Grid Journal',
    slug: 'a5-dot-grid-journal',
    category: 'notebooks-pads',
    brand: 'Kalahari Paper Co.',
    description: 'Designed for bullet journaling and daily planning with a subtle 5mm dot grid and lay-flat Smyth-sewn binding.',
    featured: 1,
    image: generateSvgPlaceholder('a5-journal.svg', 'A5 Dot Grid Journal', '#0284C7', '📖'),
    variants: [
      { sku: 'NB-A5-SAGE', name: 'Desert Sage Green', price_cents: 18500, compare_at_price_cents: null, cost_cents: 9000, stock_qty: 60, low_stock_threshold: 5, weight_g: 320 },
      { sku: 'NB-A5-TERRA', name: 'Terracotta Rust', price_cents: 18500, compare_at_price_cents: null, cost_cents: 9000, stock_qty: 2, low_stock_threshold: 5, weight_g: 320 }, // LOW STOCK
    ]
  },
  {
    name: 'SmoothFlow Retractable Gel Pen 5-Pack',
    slug: 'gel-pen-5-pack',
    category: 'pens-writing',
    brand: 'Cape Quill Co.',
    description: '0.5mm archival Japanese pigment ink with rubberized contoured grip. Dries in under one second to prevent smudging.',
    featured: 1,
    image: generateSvgPlaceholder('gel-pens.svg', 'Gel Pen 5-Pack', '#4F46E5', '🖋️'),
    variants: [
      { sku: 'PEN-GEL-BLK', name: 'Jet Black Ink (5-Pack)', price_cents: 11500, compare_at_price_cents: 13500, cost_cents: 5000, stock_qty: 120, low_stock_threshold: 10, weight_g: 75 },
      { sku: 'PEN-GEL-BLU', name: 'Ocean Royal Blue (5-Pack)', price_cents: 11500, compare_at_price_cents: 13500, cost_cents: 5000, stock_qty: 0, low_stock_threshold: 10, weight_g: 75 }, // OUT OF STOCK
    ]
  },
  {
    name: 'Vintage Brass Fountain Pen',
    slug: 'vintage-brass-fountain-pen',
    category: 'pens-writing',
    brand: 'Cape Quill Co.',
    description: 'Heavyweight machined solid brass body with a fine stainless steel German nib. Includes piston converter and presentation box.',
    featured: 1,
    image: generateSvgPlaceholder('fountain-pen.svg', 'Brass Fountain Pen', '#D97706', '✒️'),
    variants: [
      { sku: 'PEN-FTN-F', name: 'Fine Nib (0.5mm)', price_cents: 65000, compare_at_price_cents: 75000, cost_cents: 32000, stock_qty: 18, low_stock_threshold: 3, weight_g: 110 },
      { sku: 'PEN-FTN-M', name: 'Medium Nib (0.7mm)', price_cents: 65000, compare_at_price_cents: 75000, cost_cents: 32000, stock_qty: 14, low_stock_threshold: 3, weight_g: 110 },
    ]
  },
  {
    name: 'Pastel Chisel-Tip Highlighters (Set of 6)',
    slug: 'pastel-highlighters-set',
    category: 'pens-writing',
    brand: 'Lumina Stationery',
    description: 'Soft pastel hues that do not bleed through thin Bible or notebook pages. Water-based non-toxic formulation.',
    featured: 0,
    image: generateSvgPlaceholder('highlighters.svg', 'Pastel Highlighters', '#EC4899', '🖍️'),
    variants: [
      { sku: 'HL-PSTL-6', name: 'Standard 6-Color Set', price_cents: 9800, compare_at_price_cents: null, cost_cents: 4200, stock_qty: 85, low_stock_threshold: 10, weight_g: 130 },
    ]
  },
  {
    name: 'Heavy Duty Desktop Stapler',
    slug: 'heavy-duty-stapler',
    category: 'office-supplies',
    brand: 'Forge Workstation',
    description: 'Cast-iron core with rubberized base. Effortlessly staples up to 40 sheets of standard 80gsm copy paper with no jamming.',
    featured: 0,
    image: generateSvgPlaceholder('stapler.svg', 'Desktop Stapler', '#475569', '📎'),
    variants: [
      { sku: 'OFF-STP-SLV', name: 'Brushed Silver & Slate', price_cents: 22000, compare_at_price_cents: 26000, cost_cents: 10500, stock_qty: 24, low_stock_threshold: 4, weight_g: 620 },
    ]
  },
  {
    name: 'Self-Adhesive Sticky Notes Bundle (6 Pads)',
    slug: 'sticky-notes-bundle',
    category: 'office-supplies',
    brand: 'Lumina Stationery',
    description: '76mm x 76mm high-adhesion notes that peel off cleanly without residue. 100 sheets per pad across 6 warm pastel colors.',
    featured: 0,
    image: generateSvgPlaceholder('sticky-notes.svg', 'Sticky Notes Bundle', '#EAB308', '📝'),
    variants: [
      { sku: 'OFF-STK-6', name: 'Warm Palette 6-Pack', price_cents: 8500, compare_at_price_cents: null, cost_cents: 3500, stock_qty: 150, low_stock_threshold: 15, weight_g: 260 },
    ]
  },
  {
    name: 'A4 Premium 80gsm Copy Paper (500 Sheets)',
    slug: 'a4-printer-paper-500',
    category: 'office-supplies',
    brand: 'Kalahari Paper Co.',
    description: 'Ultra-bright CIE 165 white multipurpose bond paper. Ideal for high-speed laser, inkjet, and double-sided printing.',
    featured: 0,
    image: generateSvgPlaceholder('paper-ream.svg', 'A4 Copy Paper Ream', '#64748B', '📄'),
    variants: [
      { sku: 'PAP-A4-REAM', name: 'Single Ream (500 sheets)', price_cents: 11000, compare_at_price_cents: null, cost_cents: 7500, stock_qty: 90, low_stock_threshold: 10, weight_g: 2500 }, // Heavy item: 2.5kg!
    ]
  },
  {
    name: 'Magnetic Dry-Erase Whiteboard Markers (4-Pack)',
    slug: 'whiteboard-markers-4-pack',
    category: 'office-supplies',
    brand: 'Cape Quill Co.',
    description: 'Low-odor vibrant pigment with bullet tip and integrated cap eraser plus magnet. Erases cleanly from porcelain and glass.',
    featured: 0,
    image: generateSvgPlaceholder('whiteboard-markers.svg', 'Whiteboard Markers', '#2563EB', '🖊️'),
    variants: [
      { sku: 'WB-MRK-4', name: 'Assorted Basic Colors', price_cents: 7500, compare_at_price_cents: null, cost_cents: 3000, stock_qty: 4, low_stock_threshold: 5, weight_g: 95 }, // LOW STOCK
    ]
  },
  {
    name: 'Canvas Rolled Artist Pencil Case',
    slug: 'canvas-rolled-pencil-case',
    category: 'art-supplies',
    brand: 'Artisan Workshop',
    description: 'Waxed 16oz cotton canvas with 36 elastic slots and protective leather flap. Keeps fineliners and pencils safe in transit.',
    featured: 1,
    image: generateSvgPlaceholder('pencil-case.svg', 'Canvas Pencil Case', '#B45309', '🎒'),
    variants: [
      { sku: 'ART-CS-TAN', name: 'Vintage Tan Canvas', price_cents: 19500, compare_at_price_cents: 23000, cost_cents: 9500, stock_qty: 32, low_stock_threshold: 5, weight_g: 180 },
      { sku: 'ART-CS-OLV', name: 'Army Olive Green', price_cents: 19500, compare_at_price_cents: 23000, cost_cents: 9500, stock_qty: 0, low_stock_threshold: 5, weight_g: 180 }, // OUT OF STOCK
    ]
  },
  {
    name: 'Dual-Power Scientific School Calculator',
    slug: 'scientific-school-calculator',
    category: 'school-essentials',
    brand: 'Matrico Instruments',
    description: '240 computational functions with 2-line natural textbook display. Solar powered with battery backup and hard slide case.',
    featured: 1,
    image: generateSvgPlaceholder('calculator.svg', 'Scientific Calculator', '#1E293B', '🔢'),
    variants: [
      { sku: 'SCH-CALC-STD', name: 'Black Case Edition', price_cents: 28500, compare_at_price_cents: 32000, cost_cents: 14000, stock_qty: 40, low_stock_threshold: 5, weight_g: 210 },
    ]
  },
  {
    name: 'Solid Wood Geometric Desk Organizer',
    slug: 'solid-wood-desk-organizer',
    category: 'office-supplies',
    brand: 'Forge Workstation',
    description: 'Sustainable South African pine wood with compartments for smartphones, pens, sticky notes, and paperclips.',
    featured: 1,
    image: generateSvgPlaceholder('desk-organizer.svg', 'Wood Desk Organizer', '#78350F', '📐'),
    variants: [
      { sku: 'OFF-ORG-NAT', name: 'Natural Honey Pine', price_cents: 34500, compare_at_price_cents: 39500, cost_cents: 16000, stock_qty: 15, low_stock_threshold: 3, weight_g: 720 },
    ]
  },
  {
    name: 'Leather A6 Pocket Notebook',
    slug: 'leather-a6-pocket-notebook',
    category: 'notebooks-pads',
    brand: 'Kalahari Paper Co.',
    description: 'Full-grain bovine leather cover with 160 pages of 90gsm cream paper. Fits jacket pocket for field notes across South Africa.',
    featured: 0,
    image: generateSvgPlaceholder('pocket-notebook.svg', 'Leather Pocket Notebook', '#7C2D12', '📔'),
    variants: [
      { sku: 'NB-A6-TAN', name: 'Cognac Tan Leather', price_cents: 16500, compare_at_price_cents: 19500, cost_cents: 8000, stock_qty: 38, low_stock_threshold: 5, weight_g: 210 },
    ]
  },
  {
    name: 'Stainless Steel Ruler & Geometry Set',
    slug: 'steel-ruler-geometry-set',
    category: 'school-essentials',
    brand: 'Matrico Instruments',
    description: '30cm stainless ruler, 180-degree protractor, and set squares in a tin. SABS-approved for matric examinations.',
    featured: 0,
    image: generateSvgPlaceholder('geometry-set.svg', 'Geometry Set', '#0E7490', '📏'),
    variants: [
      { sku: 'SCH-GEO-SET', name: 'Standard 4-Piece Set', price_cents: 9500, compare_at_price_cents: null, cost_cents: 4200, stock_qty: 70, low_stock_threshold: 10, weight_g: 180 },
    ]
  },
  {
    name: 'Archival Ballpoint Pen 3-Pack',
    slug: 'archival-ballpoint-3-pack',
    category: 'pens-writing',
    brand: 'Cape Quill Co.',
    description: '1.0mm oil-based archival ink,635m write-out length per pen. SARS document-safe for signing tax invoices and contracts.',
    featured: 0,
    image: generateSvgPlaceholder('ballpoints.svg', 'Ballpoint 3-Pack', '#1D4ED8', '🖊️'),
    variants: [
      { sku: 'PEN-BALL-3BLK', name: 'Black Ink (3-Pack)', price_cents: 8900, compare_at_price_cents: 10500, cost_cents: 3800, stock_qty: 110, low_stock_threshold: 15, weight_g: 60 },
    ]
  },
];

let seededVariantIds = [];

for (const p of productsData) {
  const categoryId = categoryIdMap.get(p.category);
  let existingProduct = db.prepare('SELECT id FROM products WHERE slug = ?').get(p.slug);
  let productId = existingProduct?.id;

  if (!existingProduct) {
    productId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO products (id, category_id, name, slug, description, brand, active, featured, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'))
    `).run(productId, categoryId, p.name, p.slug, p.description, p.brand, p.featured);

    // Image
    db.prepare(`
      INSERT INTO product_images (id, product_id, url, alt, position)
      VALUES (?, ?, ?, ?, 0)
    `).run(crypto.randomUUID(), productId, p.image, p.name);
  }

  // Variants
  for (const v of p.variants) {
    let existingVariant = db.prepare('SELECT id FROM product_variants WHERE sku = ?').get(v.sku);
    if (!existingVariant) {
      const variantId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO product_variants (
          id, product_id, sku, name, options_json, price_cents, compare_at_price_cents,
          cost_cents, stock_qty, low_stock_threshold, weight_g, barcode, active, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, '{}', ?, ?, ?, ?, ?, ?, NULL, 1, datetime('now'), datetime('now')
        )
      `).run(
        variantId,
        productId,
        v.sku,
        v.name,
        v.price_cents,
        v.compare_at_price_cents,
        v.cost_cents,
        v.stock_qty,
        v.low_stock_threshold,
        v.weight_g
      );

      // Seed initial stock movement
      db.prepare(`
        INSERT INTO stock_movements (id, variant_id, delta, reason, note, created_at)
        VALUES (?, ?, ?, 'seed', 'Initial database seed', datetime('now'))
      `).run(crypto.randomUUID(), variantId, v.stock_qty);

      seededVariantIds.push({ id: variantId, sku: v.sku, price_cents: v.price_cents, name: `${p.name} - ${v.name}` });
    } else {
      seededVariantIds.push({ id: existingVariant.id, sku: v.sku, price_cents: v.price_cents, name: `${p.name} - ${v.name}` });
    }
  }
}
console.log(`[seed] Products and variants seeded (${productsData.length} products).`);

// Seed Coupons
const coupons = [
  {
    code: 'WELCOME10',
    type: 'percent',
    value: 10,
    min_subtotal_cents: 10000,
    max_discount_cents: 15000,
    usage_limit: 500,
    one_per_customer: 1,
  },
  {
    code: 'SAVE50',
    type: 'fixed',
    value: 5000,
    min_subtotal_cents: 30000,
    max_discount_cents: null,
    usage_limit: 200,
    one_per_customer: 0,
  },
  {
    code: 'FREESHIP',
    type: 'free_shipping',
    value: 0,
    min_subtotal_cents: 75000,
    max_discount_cents: null,
    usage_limit: 100,
    one_per_customer: 0,
  },
];

for (const c of coupons) {
  const existing = db.prepare('SELECT id FROM coupons WHERE code = ? COLLATE NOCASE').get(c.code);
  if (!existing) {
    db.prepare(`
      INSERT INTO coupons (
        id, code, type, value, min_subtotal_cents, max_discount_cents,
        usage_limit, used_count, one_per_customer, active, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, 0, ?, 1, datetime('now')
      )
    `).run(
      crypto.randomUUID(),
      c.code,
      c.type,
      c.value,
      c.min_subtotal_cents,
      c.max_discount_cents,
      c.usage_limit,
      c.one_per_customer
    );
  }
}
console.log('[seed] Promotional coupons seeded (WELCOME10, SAVE50, FREESHIP).');

// Seed Demo Orders (One paid order, one pending manual EFT order for demo customer)
if (seedDemo && demoCustomerId) {
  const existingOrders = db.prepare('SELECT COUNT(*) as count FROM orders WHERE user_id = ?').get(demoCustomerId);

  if (existingOrders.count === 0 && seededVariantIds.length >= 2) {
    console.log('[seed] Seeding demo orders for demo customer...');

    const year = new Date().getUTCFullYear();

    // Order 1: Paid order (Notebook + Gel Pens)
    const order1Id = crypto.randomUUID();
    const order1Num = `ORD-${year}-000001`;
    const inv1Num = `INV-${year}-000001`;

    const v1 = seededVariantIds[0]; // Notebook
    const v2 = seededVariantIds[2]; // Gel pens
    const item1Qty = 1;
    const item2Qty = 2;

    const subtotal1 = (v1.price_cents * item1Qty) + (v2.price_cents * item2Qty);
    const shipping1 = 7500;
    const discount1 = 0;
    const total1 = subtotal1 - discount1 + shipping1;

    // Sequence updates
    db.prepare(`INSERT OR IGNORE INTO sequences (kind, year, last_number) VALUES ('order', ?, 0)`).run(year);
    db.prepare(`UPDATE sequences SET last_number = MAX(last_number, 1) WHERE kind = 'order' AND year = ?`).run(year);
    db.prepare(`INSERT OR IGNORE INTO sequences (kind, year, last_number) VALUES ('invoice', ?, 0)`).run(year);
    db.prepare(`UPDATE sequences SET last_number = MAX(last_number, 1) WHERE kind = 'invoice' AND year = ?`).run(year);

    const demoAddressJson = JSON.stringify({
      label: 'Home',
      full_name: 'Thabo Mokoena',
      phone: '',
      line1: '12 Protea Lane',
      line2: 'Apt 4B',
      city: 'Rosebank',
      province: 'Gauteng',
      postal_code: '2196',
      country: 'ZA',
    });

    db.prepare(`
      INSERT INTO orders (
        id, order_number, user_id, email, status, currency,
        subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
        shipping_method, shipping_address_json, billing_address_json, placed_at, updated_at
      ) VALUES (
        ?, ?, ?, 'customer@example.com', 'paid', 'ZAR',
        ?, ?, ?, 0, ?,
        'standard', ?, ?, datetime('now', '-2 days'), datetime('now', '-2 days')
      )
    `).run(order1Id, order1Num, demoCustomerId, subtotal1, discount1, shipping1, total1, demoAddressJson, demoAddressJson);

    // Items for Order 1
    db.prepare(`
      INSERT INTO order_items (
        id, order_id, variant_id, variant_snapshot_json, qty, unit_price_cents,
        line_subtotal_cents, line_discount_cents, line_total_cents, tax_cents
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0)
    `).run(
      crypto.randomUUID(), order1Id, v1.id,
      JSON.stringify({ sku: v1.sku, name: v1.name, unit_price_cents: v1.price_cents }),
      item1Qty, v1.price_cents, v1.price_cents * item1Qty, v1.price_cents * item1Qty
    );

    db.prepare(`
      INSERT INTO order_items (
        id, order_id, variant_id, variant_snapshot_json, qty, unit_price_cents,
        line_subtotal_cents, line_discount_cents, line_total_cents, tax_cents
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0)
    `).run(
      crypto.randomUUID(), order1Id, v2.id,
      JSON.stringify({ sku: v2.sku, name: v2.name, unit_price_cents: v2.price_cents }),
      item2Qty, v2.price_cents, v2.price_cents * item2Qty, v2.price_cents * item2Qty
    );

    // Order 1 events & payment
    db.prepare(`
      INSERT INTO order_events (id, order_id, actor_id, type, note, created_at)
      VALUES (?, ?, ?, 'order_placed', 'Simulated order placed', datetime('now', '-2 days'))
    `).run(crypto.randomUUID(), order1Id, demoCustomerId);

    db.prepare(`
      INSERT INTO payments (id, order_id, method, status, amount_cents, gateway_ref, created_at)
      VALUES (?, ?, 'sim_card', 'success', ?, 'sim_demo_001', datetime('now', '-2 days'))
    `).run(crypto.randomUUID(), order1Id, total1);

    // Invoice 1
    db.prepare(`
      INSERT INTO invoices (
        id, invoice_number, order_id, status, issue_date, due_date, currency,
        subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
        amount_paid_cents, seller_json, buyer_json, line_items_json, notes, created_at, updated_at
      ) VALUES (
        ?, ?, ?, 'paid', date('now', '-2 days'), date('now', '+12 days'), 'ZAR',
        ?, ?, ?, 0, ?,
        ?, ?, ?, ?, 'Thank you for your business.', datetime('now', '-2 days'), datetime('now', '-2 days')
      )
    `).run(
      crypto.randomUUID(),
      inv1Num,
      order1Id,
      subtotal1,
      discount1,
      shipping1,
      total1,
      total1,
      JSON.stringify(storeSettings),
      demoAddressJson,
      JSON.stringify([
        { sku: v1.sku, name: v1.name, qty: item1Qty, unit_price_cents: v1.price_cents, line_subtotal_cents: v1.price_cents * item1Qty, line_discount_cents: 0, line_total_cents: v1.price_cents * item1Qty, tax_cents: 0 },
        { sku: v2.sku, name: v2.name, qty: item2Qty, unit_price_cents: v2.price_cents, line_subtotal_cents: v2.price_cents * item2Qty, line_discount_cents: 0, line_total_cents: v2.price_cents * item2Qty, tax_cents: 0 },
      ])
    );

    // Order 2: Pending manual EFT order (Brass Fountain Pen)
    const order2Id = crypto.randomUUID();
    const order2Num = `ORD-${year}-000002`;
    const inv2Num = `INV-${year}-000002`;

    const v3 = seededVariantIds[3]; // Fountain pen
    const item3Qty = 1;
    const subtotal2 = v3.price_cents * item3Qty;
    const shipping2 = 7500;
    const total2 = subtotal2 + shipping2;

    db.prepare(`UPDATE sequences SET last_number = MAX(last_number, 2) WHERE kind = 'order' AND year = ?`).run(year);
    db.prepare(`UPDATE sequences SET last_number = MAX(last_number, 2) WHERE kind = 'invoice' AND year = ?`).run(year);

    db.prepare(`
      INSERT INTO orders (
        id, order_number, user_id, email, status, currency,
        subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
        shipping_method, shipping_address_json, billing_address_json, customer_note, placed_at, updated_at
      ) VALUES (
        ?, ?, ?, 'customer@example.com', 'pending_payment', 'ZAR',
        ?, 0, ?, 0, ?,
        'standard', ?, ?, 'Please dispatch as soon as EFT clears', datetime('now', '-4 hours'), datetime('now', '-4 hours')
      )
    `).run(order2Id, order2Num, demoCustomerId, subtotal2, shipping2, total2, demoAddressJson, demoAddressJson);

    db.prepare(`
      INSERT INTO order_items (
        id, order_id, variant_id, variant_snapshot_json, qty, unit_price_cents,
        line_subtotal_cents, line_discount_cents, line_total_cents, tax_cents
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0)
    `).run(
      crypto.randomUUID(), order2Id, v3.id,
      JSON.stringify({ sku: v3.sku, name: v3.name, unit_price_cents: v3.price_cents }),
      item3Qty, v3.price_cents, subtotal2, subtotal2
    );

    db.prepare(`
      INSERT INTO order_events (id, order_id, actor_id, type, note, created_at)
      VALUES (?, ?, ?, 'order_placed', 'Awaiting manual EFT payment from customer', datetime('now', '-4 hours'))
    `).run(crypto.randomUUID(), order2Id, demoCustomerId);

    db.prepare(`
      INSERT INTO payments (id, order_id, method, status, amount_cents, created_at)
      VALUES (?, ?, 'manual_eft', 'pending', ?, datetime('now', '-4 hours'))
    `).run(crypto.randomUUID(), order2Id, total2);

    db.prepare(`
      INSERT INTO invoices (
        id, invoice_number, order_id, status, issue_date, due_date, currency,
        subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
        amount_paid_cents, seller_json, buyer_json, line_items_json, notes, created_at, updated_at
      ) VALUES (
        ?, ?, ?, 'issued', date('now'), date('now', '+14 days'), 'ZAR',
        ?, 0, ?, 0, ?,
        0, ?, ?, ?, 'EFT Payment Pending. Reference: ORD-${year}-000002', datetime('now', '-4 hours'), datetime('now', '-4 hours')
      )
    `).run(
      crypto.randomUUID(),
      inv2Num,
      order2Id,
      subtotal2,
      shipping2,
      total2,
      JSON.stringify(storeSettings),
      demoAddressJson,
      JSON.stringify([
        { sku: v3.sku, name: v3.name, qty: item3Qty, unit_price_cents: v3.price_cents, line_subtotal_cents: subtotal2, line_discount_cents: 0, line_total_cents: subtotal2, tax_cents: 0 },
      ])
    );

    console.log('[seed] Demo orders seeded successfully.');
  }
}

db.close();
console.log('[seed] Database seed completed successfully!');
