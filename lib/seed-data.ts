// Shared catalogue seed data (pure data, zero imports).
// Single source of truth for runtime auto-seed (lib/seed-catalog.ts).
// NOTE: scripts/seed.mjs and scripts/seed-turso.mjs carry their own copies
// (plain .mjs cannot import TS) — keep slug/SKU sets in sync; test/seed-data.test.ts enforces it.

export interface SeedVariant {
  sku: string;
  name: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  cost_cents: number | null;
  stock_qty: number;
  low_stock_threshold: number;
  weight_g: number;
}

export interface SeedProduct {
  name: string;
  slug: string;
  category: string;
  brand: string;
  description: string;
  featured: 0 | 1;
  image: string;
  variants: SeedVariant[];
}

export interface SeedCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
}

export interface SeedCoupon {
  code: string;
  type: 'percent' | 'fixed' | 'free_shipping';
  value: number;
  min_subtotal_cents: number;
  max_discount_cents: number | null;
  usage_limit: number | null;
  one_per_customer: 0 | 1;
}

export const SEED_CATEGORIES: SeedCategory[] = [
  { id: '11111111-1111-4000-8000-000000000001', name: 'Pens & Writing', slug: 'pens-writing', description: 'Fine pens, gel pens, highlighters, and precision drawing instruments', sort_order: 1 },
  { id: '11111111-1111-4000-8000-000000000002', name: 'Notebooks & Pads', slug: 'notebooks-pads', description: 'Hardcover journals, dot-grid books, and premium paper refills', sort_order: 2 },
  { id: '11111111-1111-4000-8000-000000000003', name: 'Office Supplies', slug: 'office-supplies', description: 'Desk organizers, staplers, paper clips, and archival storage', sort_order: 3 },
  { id: '11111111-1111-4000-8000-000000000004', name: 'Art Supplies', slug: 'art-supplies', description: 'Watercolour markers, sketching pencils, and artist canvas pads', sort_order: 4 },
  { id: '11111111-1111-4000-8000-000000000005', name: 'School Essentials', slug: 'school-essentials', description: 'Durable pencil cases, geometric math sets, and scientific calculators', sort_order: 5 },
];

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    name: 'A4 Hardcover Executive Notebook', slug: 'a4-hardcover-notebook', category: 'notebooks-pads',
    brand: 'Kalahari Paper Co.', description: '192 numbered pages of 100gsm acid-free ivory paper. Features an expandable rear pocket and dual ribbon bookmarks.',
    featured: 1, image: '/seed/a4-notebook.svg',
    variants: [
      { sku: 'NB-A4-BLK', name: 'Matte Charcoal Black', price_cents: 24500, compare_at_price_cents: 28000, cost_cents: 12000, stock_qty: 45, low_stock_threshold: 5, weight_g: 480 },
      { sku: 'NB-A4-NAVY', name: 'Deep Midnight Navy', price_cents: 24500, compare_at_price_cents: 28000, cost_cents: 12000, stock_qty: 3, low_stock_threshold: 5, weight_g: 480 },
    ],
  },
  {
    name: 'A5 Dot Grid Journal', slug: 'a5-dot-grid-journal', category: 'notebooks-pads',
    brand: 'Kalahari Paper Co.', description: 'Designed for bullet journaling and daily planning with a subtle 5mm dot grid and lay-flat Smyth-sewn binding.',
    featured: 1, image: '/seed/a5-journal.svg',
    variants: [
      { sku: 'NB-A5-SAGE', name: 'Desert Sage Green', price_cents: 18500, compare_at_price_cents: null, cost_cents: 9000, stock_qty: 60, low_stock_threshold: 5, weight_g: 320 },
      { sku: 'NB-A5-TERRA', name: 'Terracotta Rust', price_cents: 18500, compare_at_price_cents: null, cost_cents: 9000, stock_qty: 2, low_stock_threshold: 5, weight_g: 320 },
    ],
  },
  {
    name: 'SmoothFlow Retractable Gel Pen 5-Pack', slug: 'gel-pen-5-pack', category: 'pens-writing',
    brand: 'Cape Quill Co.', description: '0.5mm archival Japanese pigment ink with rubberized contoured grip. Dries in under one second to prevent smudging.',
    featured: 1, image: '/seed/gel-pens.svg',
    variants: [
      { sku: 'PEN-GEL-BLK', name: 'Jet Black Ink (5-Pack)', price_cents: 11500, compare_at_price_cents: 13500, cost_cents: 5000, stock_qty: 120, low_stock_threshold: 10, weight_g: 75 },
      { sku: 'PEN-GEL-BLU', name: 'Ocean Royal Blue (5-Pack)', price_cents: 11500, compare_at_price_cents: 13500, cost_cents: 5000, stock_qty: 0, low_stock_threshold: 10, weight_g: 75 },
    ],
  },
  {
    name: 'Vintage Brass Fountain Pen', slug: 'vintage-brass-fountain-pen', category: 'pens-writing',
    brand: 'Cape Quill Co.', description: 'Heavyweight machined solid brass body with a fine stainless steel German nib. Includes piston converter and presentation box.',
    featured: 1, image: '/seed/fountain-pen.svg',
    variants: [
      { sku: 'PEN-FTN-F', name: 'Fine Nib (0.5mm)', price_cents: 65000, compare_at_price_cents: 75000, cost_cents: 32000, stock_qty: 18, low_stock_threshold: 3, weight_g: 110 },
      { sku: 'PEN-FTN-M', name: 'Medium Nib (0.7mm)', price_cents: 65000, compare_at_price_cents: 75000, cost_cents: 32000, stock_qty: 14, low_stock_threshold: 3, weight_g: 110 },
    ],
  },
  {
    name: 'Pastel Chisel-Tip Highlighters (Set of 6)', slug: 'pastel-highlighters-set', category: 'pens-writing',
    brand: 'Lumina Stationery', description: 'Soft pastel hues that do not bleed through thin Bible or notebook pages. Water-based non-toxic formulation.',
    featured: 0, image: '/seed/highlighters.svg',
    variants: [
      { sku: 'HL-PSTL-6', name: 'Standard 6-Color Set', price_cents: 9800, compare_at_price_cents: null, cost_cents: 4200, stock_qty: 85, low_stock_threshold: 10, weight_g: 130 },
    ],
  },
  {
    name: 'Heavy Duty Desktop Stapler', slug: 'heavy-duty-stapler', category: 'office-supplies',
    brand: 'Forge Workstation', description: 'Cast-iron core with rubberized base. Effortlessly staples up to 40 sheets of standard 80gsm copy paper with no jamming.',
    featured: 0, image: '/seed/stapler.svg',
    variants: [
      { sku: 'OFF-STP-SLV', name: 'Brushed Silver & Slate', price_cents: 22000, compare_at_price_cents: 26000, cost_cents: 10500, stock_qty: 24, low_stock_threshold: 4, weight_g: 620 },
    ],
  },
  {
    name: 'Self-Adhesive Sticky Notes Bundle (6 Pads)', slug: 'sticky-notes-bundle', category: 'office-supplies',
    brand: 'Lumina Stationery', description: '76mm x 76mm high-adhesion notes that peel off cleanly without residue. 100 sheets per pad across 6 warm pastel colors.',
    featured: 0, image: '/seed/sticky-notes.svg',
    variants: [
      { sku: 'OFF-STK-6', name: 'Warm Palette 6-Pack', price_cents: 8500, compare_at_price_cents: null, cost_cents: 3500, stock_qty: 150, low_stock_threshold: 15, weight_g: 260 },
    ],
  },
  {
    name: 'A4 Premium 80gsm Copy Paper (500 Sheets)', slug: 'a4-printer-paper-500', category: 'office-supplies',
    brand: 'Kalahari Paper Co.', description: 'Ultra-bright CIE 165 white multipurpose bond paper. Ideal for high-speed laser, inkjet, and double-sided printing.',
    featured: 0, image: '/seed/paper-ream.svg',
    variants: [
      { sku: 'PAP-A4-REAM', name: 'Single Ream (500 sheets)', price_cents: 11000, compare_at_price_cents: null, cost_cents: 7500, stock_qty: 90, low_stock_threshold: 10, weight_g: 2500 },
    ],
  },
  {
    name: 'Magnetic Dry-Erase Whiteboard Markers (4-Pack)', slug: 'whiteboard-markers-4-pack', category: 'office-supplies',
    brand: 'Cape Quill Co.', description: 'Low-odor vibrant pigment with bullet tip and integrated cap eraser plus magnet. Erases cleanly from porcelain and glass.',
    featured: 0, image: '/seed/whiteboard-markers.svg',
    variants: [
      { sku: 'WB-MRK-4', name: 'Assorted Basic Colors', price_cents: 7500, compare_at_price_cents: null, cost_cents: 3000, stock_qty: 4, low_stock_threshold: 5, weight_g: 95 },
    ],
  },
  {
    name: 'Canvas Rolled Artist Pencil Case', slug: 'canvas-rolled-pencil-case', category: 'art-supplies',
    brand: 'Artisan Workshop', description: 'Waxed 16oz cotton canvas with 36 elastic slots and protective leather flap. Keeps fineliners and pencils safe in transit.',
    featured: 1, image: '/seed/pencil-case.svg',
    variants: [
      { sku: 'ART-CS-TAN', name: 'Vintage Tan Canvas', price_cents: 19500, compare_at_price_cents: 23000, cost_cents: 9500, stock_qty: 32, low_stock_threshold: 5, weight_g: 180 },
      { sku: 'ART-CS-OLV', name: 'Army Olive Green', price_cents: 19500, compare_at_price_cents: 23000, cost_cents: 9500, stock_qty: 0, low_stock_threshold: 5, weight_g: 180 },
    ],
  },
  {
    name: 'Dual-Power Scientific School Calculator', slug: 'scientific-school-calculator', category: 'school-essentials',
    brand: 'Matrico Instruments', description: '240 computational functions with 2-line natural textbook display. Solar powered with battery backup and hard slide case.',
    featured: 1, image: '/seed/calculator.svg',
    variants: [
      { sku: 'SCH-CALC-STD', name: 'Black Case Edition', price_cents: 28500, compare_at_price_cents: 32000, cost_cents: 14000, stock_qty: 40, low_stock_threshold: 5, weight_g: 210 },
    ],
  },
  {
    name: 'Solid Wood Geometric Desk Organizer', slug: 'solid-wood-desk-organizer', category: 'office-supplies',
    brand: 'Forge Workstation', description: 'Sustainable South African pine wood with compartments for smartphones, pens, sticky notes, and paperclips.',
    featured: 1, image: '/seed/desk-organizer.svg',
    variants: [
      { sku: 'OFF-ORG-NAT', name: 'Natural Honey Pine', price_cents: 34500, compare_at_price_cents: 39500, cost_cents: 16000, stock_qty: 15, low_stock_threshold: 3, weight_g: 720 },
    ],
  },
  {
    name: 'Leather A6 Pocket Notebook', slug: 'leather-a6-pocket-notebook', category: 'notebooks-pads',
    brand: 'Kalahari Paper Co.', description: 'Full-grain bovine leather cover with 160 pages of 90gsm cream paper. Fits jacket pocket for field notes across South Africa.',
    featured: 0, image: '/seed/pocket-notebook.svg',
    variants: [
      { sku: 'NB-A6-TAN', name: 'Cognac Tan Leather', price_cents: 16500, compare_at_price_cents: 19500, cost_cents: 8000, stock_qty: 38, low_stock_threshold: 5, weight_g: 210 },
    ],
  },
  {
    name: 'Stainless Steel Ruler & Geometry Set', slug: 'steel-ruler-geometry-set', category: 'school-essentials',
    brand: 'Matrico Instruments', description: '30cm stainless ruler, 180-degree protractor, and set squares in a tin. SABS-approved for matric examinations.',
    featured: 0, image: '/seed/geometry-set.svg',
    variants: [
      { sku: 'SCH-GEO-SET', name: 'Standard 4-Piece Set', price_cents: 9500, compare_at_price_cents: null, cost_cents: 4200, stock_qty: 70, low_stock_threshold: 10, weight_g: 180 },
    ],
  },
  {
    name: 'Archival Ballpoint Pen 3-Pack', slug: 'archival-ballpoint-3-pack', category: 'pens-writing',
    brand: 'Cape Quill Co.', description: '1.0mm oil-based archival ink, 635m write-out length per pen. SARS document-safe for signing tax invoices and contracts.',
    featured: 0, image: '/seed/ballpoints.svg',
    variants: [
      { sku: 'PEN-BALL-3BLK', name: 'Black Ink (3-Pack)', price_cents: 8900, compare_at_price_cents: 10500, cost_cents: 3800, stock_qty: 110, low_stock_threshold: 15, weight_g: 60 },
    ],
  },
];

export const SEED_COUPONS: SeedCoupon[] = [
  { code: 'WELCOME10', type: 'percent', value: 10, min_subtotal_cents: 10000, max_discount_cents: 15000, usage_limit: 500, one_per_customer: 1 },
  { code: 'SAVE50', type: 'fixed', value: 5000, min_subtotal_cents: 30000, max_discount_cents: null, usage_limit: 200, one_per_customer: 0 },
  { code: 'FREESHIP', type: 'free_shipping', value: 0, min_subtotal_cents: 75000, max_discount_cents: null, usage_limit: 100, one_per_customer: 0 },
];
