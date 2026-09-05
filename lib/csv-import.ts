import crypto from 'node:crypto';
import { db } from './db';
import { productSchema, variantSchema, isSafeImageUrl } from './validation';
import { logAudit } from './audit';

// Batch CSV catalogue import — tolerant of different supplier spreadsheet layouts.
// Delimiter auto-detected (, ; tab |), headers matched via alias dictionary,
// prices accept "R 1,299.00" / "245,00" / 245.00, missing slugs/SKUs auto-generated.

export const MAX_IMPORT_ROWS = 2000;

export type { ImportField } from './import-fields';
export { IMPORT_FIELDS } from './import-fields';

const HEADER_ALIASES: Record<string, string> = {
  name: 'name', 'product name': 'name', title: 'name', 'product title': 'name',
  item: 'name', 'item name': 'name', product: 'name',
  slug: 'slug', handle: 'slug', 'url slug': 'slug', 'url handle': 'slug', 'product slug': 'slug',
  category: 'category', 'category name': 'category', collection: 'category',
  department: 'category', 'category slug': 'category',
  brand: 'brand', vendor: 'brand', manufacturer: 'brand', supplier: 'brand', make: 'brand',
  description: 'description', desc: 'description', details: 'description',
  'long description': 'description', 'product description': 'description',
  variant: 'variant', 'variant name': 'variant', option: 'variant', 'option name': 'variant',
  size: 'variant', colour: 'variant', color: 'variant', flavour: 'variant', flavor: 'variant',
  sku: 'sku', 'variant sku': 'sku', 'product code': 'sku', 'item code': 'sku', code: 'sku',
  price: 'price', 'price zar': 'price', 'price r': 'price', 'price (r)': 'price',
  retail: 'price', 'retail price': 'price', 'unit price': 'price',
  'selling price': 'price', amount: 'price',
  'compare at': 'compare_at', 'compare at price': 'compare_at', 'compare price': 'compare_at',
  was: 'compare_at', 'was price': 'compare_at', 'list price': 'compare_at',
  rrp: 'compare_at', 'original price': 'compare_at',
  cost: 'cost', 'cost price': 'cost', 'unit cost': 'cost', cogs: 'cost',
  stock: 'stock', 'stock qty': 'stock', qty: 'stock', quantity: 'stock',
  inventory: 'stock', 'on hand': 'stock', available: 'stock',
  'stock on hand': 'stock', 'inventory qty': 'stock',
  'low stock': 'low_stock_threshold', 'low stock threshold': 'low_stock_threshold',
  reorder: 'low_stock_threshold', 'reorder level': 'low_stock_threshold',
  'reorder point': 'low_stock_threshold', threshold: 'low_stock_threshold',
  weight: 'weight', 'weight g': 'weight', 'weight (g)': 'weight',
  grams: 'weight', mass: 'weight',
  barcode: 'barcode', ean: 'barcode', upc: 'barcode', gtin: 'barcode', isbn: 'barcode',
  active: 'active', status: 'active', published: 'active', visible: 'active', enabled: 'active',
  featured: 'featured', feature: 'featured', highlight: 'featured', showcase: 'featured',
  image: 'image', 'image url': 'image', picture: 'image', photo: 'image',
  'image link': 'image', img: 'image',
  // Afrikaans supplier sheets (common in SA wholesale)
  naam: 'name', 'produk naam': 'name', titel: 'name',
  beskrywing: 'description', kategorie: 'category', afdeling: 'category',
  handelsmerk: 'brand', verskaffer: 'brand', vervaardiger: 'brand',
  prys: 'price', 'prys zar': 'price', kleinhandel: 'price',
  hoeveelheid: 'stock', voorraad: 'stock', 'voorraad op hande': 'stock',
  gewig: 'weight', 'gewig g': 'weight',
  strepieskode: 'barcode', artikelkode: 'sku', kode: 'sku',
  opsie: 'variant', grootte: 'variant', kleur: 'variant',
  aktief: 'active', geaktiveer: 'active', sigbaar: 'active',
  uitgelig: 'featured',
};

export function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectDelimiter(line: string): string {
  // Count candidates outside quoted sections
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && ch in counts) {
      counts[ch]++;
    }
  }
  let best = ',';
  let bestCount = 0;
  for (const [delim, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = delim;
      bestCount = count;
    }
  }
  return best;
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: string;
  truncated: boolean;
}

export function parseCsv(text: string): ParsedCsv {
  const clean = String(text ?? '').replace(/^\uFEFF/, '');
  if (!clean.trim()) {
    return { headers: [], rows: [], delimiter: ',', truncated: false };
  }
  const firstLine = clean.split(/\r?\n/).find(l => l.trim().length > 0) ?? '';
  const delimiter = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    current.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    if (current.some(cell => cell.trim() !== '')) {
      rows.push(current);
    }
    current = [];
  };

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      pushField();
    } else if (ch === '\r') {
      // handled with \n
    } else if (ch === '\n') {
      pushRow();
    } else {
      field += ch;
    }
  }
  pushRow();

  if (rows.length === 0) {
    return { headers: [], rows: [], delimiter, truncated: false };
  }
  const headers = rows[0].map(h => h.trim());
  let dataRows = rows.slice(1);
  let truncated = false;
  if (dataRows.length > MAX_IMPORT_ROWS) {
    dataRows = dataRows.slice(0, MAX_IMPORT_ROWS);
    truncated = true;
  }
  return { headers, rows: dataRows, delimiter, truncated };
}

export function suggestMapping(headers: string[]): { mapping: Record<number, string>; warnings: string[] } {
  const mapping: Record<number, string> = {};
  const warnings: string[] = [];
  const claimed = new Set<string>();

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    const field = HEADER_ALIASES[normalized];
    if (field && !claimed.has(field)) {
      mapping[index] = field;
      claimed.add(field);
    } else if (field && claimed.has(field)) {
      mapping[index] = '__ignore';
      warnings.push(`Column "${header}" also looks like "${field}" — ignored to avoid duplicates. Change its mapping if needed.`);
    } else {
      mapping[index] = '__ignore';
      if (normalized) {
        warnings.push(`Column "${header}" was not recognised — set its mapping manually or leave ignored.`);
      }
    }
  });

  return { mapping, warnings };
}

export function slugify(value: string): string {
  const slug = String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return slug || 'product';
}

export function parsePriceToCents(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/R\s?/gi, '').replace(/ZAR/gi, '').replace(/[$€£]/g, '').replace(/\s/g, '');
  if (!s || s === '-') return null;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    s = s.replace(/,/g, '');
  } else if (hasComma) {
    const decimalMatch = s.match(/,(\d{2})$/);
    if (decimalMatch) {
      s = `${s.slice(0, s.length - 3).replace(/,/g, '')}.${decimalMatch[1]}`;
    } else {
      s = s.replace(/,/g, '');
    }
  }
  const value = parseFloat(s);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

const TRUE_VALUES = new Set(['true', '1', 'yes', 'y', 'active', 'published', 'live', 'on']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'n', 'draft', 'archived', 'hidden', 'off']);

export function parseBool(raw: string | null | undefined, fallback: boolean): boolean {
  if (raw == null) return fallback;
  const s = String(raw).trim().toLowerCase();
  if (!s) return fallback;
  if (TRUE_VALUES.has(s)) return true;
  if (FALSE_VALUES.has(s)) return false;
  return fallback;
}

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportSummary {
  productsCreated: number;
  productsUpdated: number;
  variantsCreated: number;
  variantsUpdated: number;
  categoriesCreated: number;
  rowsSkipped: number;
  errors: ImportRowError[];
  truncated: boolean;
}

function fieldOf(mapping: Record<string | number, string>, index: number): string {
  return mapping[index] ?? mapping[String(index)] ?? '__ignore';
}

export async function executeProductImport(
  headers: string[],
  rows: string[][],
  mapping: Record<string | number, string>,
  actorId: string | null
): Promise<{ success: boolean; summary?: ImportSummary; error?: string }> {
  const mappedFields = new Set(
    headers.map((_, i) => fieldOf(mapping, i)).filter(f => f !== '__ignore')
  );
  if (!mappedFields.has('name')) {
    return { success: false, error: 'No column is mapped to Product name — map at least the name column.' };
  }
  if (!mappedFields.has('price')) {
    return { success: false, error: 'No column is mapped to Price — map at least the price column.' };
  }

  const summary: ImportSummary = {
    productsCreated: 0,
    productsUpdated: 0,
    variantsCreated: 0,
    variantsUpdated: 0,
    categoriesCreated: 0,
    rowsSkipped: 0,
    errors: [],
    truncated: rows.length >= MAX_IMPORT_ROWS,
  };
  const pushError = (row: number, message: string) => {
    summary.rowsSkipped += 1;
    if (summary.errors.length < 50) {
      summary.errors.push({ row, message });
    }
  };

  // Group rows into products: explicit slug wins, else slugified name
  const groups = new Map<string, { indexes: number[]; fields: Array<Record<string, string>> }>();
  rows.forEach((cells, rowIdx) => {
    const byField: Record<string, string> = {};
    headers.forEach((_, colIdx) => {
      const f = fieldOf(mapping, colIdx);
      if (f === '__ignore') return;
      const val = (cells[colIdx] ?? '').trim();
      if (val && !(f in byField)) {
        byField[f] = val;
      }
    });
    const key = (byField.slug || '').toLowerCase() || slugify(byField.name || `row-${rowIdx + 1}`);
    if (!groups.has(key)) {
      groups.set(key, { indexes: [], fields: [] });
    }
    const group = groups.get(key)!;
    group.indexes.push(rowIdx + 2); // +2 for 1-based + header row
    group.fields.push(byField);
  });

  const resolveCategoryId = async (value: string): Promise<string | null> => {
    const trimmed = (value || '').trim();
    if (!trimmed) return null;
    const slug = slugify(trimmed);
    const existing = await db.prepare(
      'SELECT id FROM categories WHERE slug = ? OR LOWER(name) = LOWER(?)'
    ).get(slug, trimmed) as any;
    if (existing) return existing.id;
    const newId = crypto.randomUUID();
    const maxSort = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM categories').get() as any;
    await db.prepare(
      'INSERT INTO categories (id, name, slug, description, active, sort_order) VALUES (?, ?, ?, ?, 1, ?)'
    ).run(newId, trimmed, slug, '', (maxSort?.m ?? 0) + 1);
    summary.categoriesCreated += 1;
    return newId;
  };

  await db.transaction(async () => {
    let variantAutoCounter = 1;
    for (const group of groups.values()) {
      // Merge product-level fields: first non-empty value across group rows
      const merged: Record<string, string> = {};
      for (const fieldMap of group.fields) {
        for (const [field, val] of Object.entries(fieldMap)) {
          if (val && !merged[field]) {
            merged[field] = val;
          }
        }
      }
      const firstRow = group.indexes[0];

      // Drop unsafe image URLs (javascript:/data:/protocol-relative) — never store them
      if (merged.image && !isSafeImageUrl(merged.image)) {
        pushError(firstRow, `Unsafe image URL "${merged.image.slice(0, 80)}" removed — use a site path or https:// link.`);
        delete merged.image;
      }

      if (!merged.name) {
        pushError(firstRow, 'Missing product name — row skipped.');
        continue;
      }

      const slug = merged.slug || slugify(merged.name);
      let categoryId: string | null = null;
      try {
        categoryId = merged.category ? await resolveCategoryId(merged.category) : null;
      } catch (e: any) {
        pushError(firstRow, `Category "${merged.category}" failed: ${e.message}`);
        continue;
      }

      const parsedProduct = productSchema.safeParse({
        name: merged.name,
        slug,
        category_id: categoryId,
        brand: merged.brand || '',
        description: merged.description || '',
        active: 'active' in merged ? parseBool(merged.active, true) : true,
        featured: 'featured' in merged ? parseBool(merged.featured, false) : false,
      });
      if (!parsedProduct.success) {
        pushError(firstRow, `Invalid product "${merged.name}": ${parsedProduct.error.issues[0]?.message || 'validation failed'}`);
        continue;
      }
      const p = parsedProduct.data;

      const existingProduct = await db.prepare('SELECT id FROM products WHERE slug = ?').get(p.slug) as any;
      let productId: string;
      if (existingProduct) {
        productId = existingProduct.id;
        // Only touch columns present in the CSV so re-imports never wipe data
        const sets: string[] = [];
        const vals: any[] = [];
        const maybe = (field: string, column: string, value: any) => {
          if (mappedFields.has(field)) {
            sets.push(`${column} = ?`);
            vals.push(value);
          }
        };
        maybe('name', 'name', p.name);
        maybe('category', 'category_id', p.category_id);
        maybe('brand', 'brand', p.brand);
        maybe('description', 'description', p.description);
        maybe('active', 'active', p.active ? 1 : 0);
        maybe('featured', 'featured', p.featured ? 1 : 0);
        if (sets.length > 0) {
          sets.push(`updated_at = datetime('now')`);
          await db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).run(...vals, productId);
        }
        if (mappedFields.has('image') && merged.image) {
          await db.prepare('DELETE FROM product_images WHERE product_id = ?').run(productId);
          await db.prepare(
            'INSERT INTO product_images (id, product_id, url, alt, position) VALUES (?, ?, ?, ?, 0)'
          ).run(crypto.randomUUID(), productId, merged.image, p.name);
        }
        summary.productsUpdated += 1;
      } else {
        productId = crypto.randomUUID();
        await db.prepare(`
          INSERT INTO products (
            id, category_id, name, slug, description, brand, active, featured, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `).run(productId, p.category_id, p.name, p.slug, p.description, p.brand, p.active ? 1 : 0, p.featured ? 1 : 0);
        if (merged.image) {
          await db.prepare(
            'INSERT INTO product_images (id, product_id, url, alt, position) VALUES (?, ?, ?, ?, 0)'
          ).run(crypto.randomUUID(), productId, merged.image, p.name);
        }
        summary.productsCreated += 1;
      }

      // One variant per row in the group
      let optionCounter = 1;
      for (let g = 0; g < group.fields.length; g++) {
        const fieldMap = group.fields[g];
        const rowNumber = group.indexes[g];

        let sku = (fieldMap.sku || '').toUpperCase();
        if (!sku) {
          sku = `${slugify(p.name).toUpperCase().slice(0, 20)}-V${variantAutoCounter++}`;
        }

        const variantName = fieldMap.variant
          || (group.fields.length > 1 ? `Option ${optionCounter++}` : 'Standard');

        const priceCents = parsePriceToCents(fieldMap.price);
        if (priceCents == null) {
          pushError(rowNumber, `Invalid price "${fieldMap.price || ''}" for SKU "${sku}" — row skipped.`);
          continue;
        }
        const compareCents = fieldMap.compare_at ? parsePriceToCents(fieldMap.compare_at) : null;
        const costCents = fieldMap.cost ? parsePriceToCents(fieldMap.cost) : null;
        if (fieldMap.compare_at && compareCents == null) {
          pushError(rowNumber, `Invalid compare-at price "${fieldMap.compare_at}" for SKU "${sku}" — row skipped.`);
          continue;
        }
        if (fieldMap.cost && costCents == null) {
          pushError(rowNumber, `Invalid cost "${fieldMap.cost}" for SKU "${sku}" — row skipped.`);
          continue;
        }

        const stockQty = fieldMap.stock ? Math.max(0, parseInt(fieldMap.stock.replace(/[^\d-]/g, ''), 10) || 0) : 0;

        const parsedVariant = variantSchema.safeParse({
          sku,
          name: variantName,
          options_json: '{}',
          price_cents: priceCents,
          compare_at_price_cents: compareCents,
          cost_cents: costCents,
          stock_qty: stockQty,
          low_stock_threshold: fieldMap.low_stock_threshold ? Math.max(0, parseInt(fieldMap.low_stock_threshold.replace(/[^\d-]/g, ''), 10) || 0) : 5,
          weight_g: fieldMap.weight ? Math.max(0, parseInt(fieldMap.weight.replace(/[^\d-]/g, ''), 10) || 0) : 0,
          barcode: fieldMap.barcode || null,
          active: 'active' in fieldMap ? parseBool(fieldMap.active, true) : true,
        });
        if (!parsedVariant.success) {
          pushError(rowNumber, `Invalid variant "${sku}": ${parsedVariant.error.issues[0]?.message || 'validation failed'}`);
          continue;
        }
        const v = parsedVariant.data;

        const existingVariant = await db.prepare('SELECT id, stock_qty FROM product_variants WHERE sku = ?').get(v.sku) as any;
        if (existingVariant) {
          const stockDiff = v.stock_qty - (existingVariant.stock_qty ?? 0);
          await db.prepare(`
            UPDATE product_variants
            SET sku = ?, name = ?, options_json = ?, price_cents = ?,
                compare_at_price_cents = ?, cost_cents = ?, stock_qty = ?,
                low_stock_threshold = ?, weight_g = ?, barcode = ?, active = ?, updated_at = datetime('now')
            WHERE id = ?
          `).run(
            v.sku, v.name, v.options_json, v.price_cents,
            v.compare_at_price_cents, v.cost_cents, v.stock_qty,
            v.low_stock_threshold, v.weight_g, v.barcode, v.active ? 1 : 0, existingVariant.id
          );
          if (stockDiff !== 0) {
            await db.prepare(`
              INSERT INTO stock_movements (id, variant_id, delta, reason, note, created_at)
              VALUES (?, ?, ?, 'admin_adjustment', 'CSV import stock update', datetime('now'))
            `).run(crypto.randomUUID(), existingVariant.id, stockDiff);
          }
          summary.variantsUpdated += 1;
        } else {
          const newVariantId = crypto.randomUUID();
          await db.prepare(`
            INSERT INTO product_variants (
              id, product_id, sku, name, options_json, price_cents, compare_at_price_cents,
              cost_cents, stock_qty, low_stock_threshold, weight_g, barcode, active, created_at, updated_at
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now')
            )
          `).run(
            newVariantId, productId, v.sku, v.name, v.options_json, v.price_cents,
            v.compare_at_price_cents, v.cost_cents, v.stock_qty,
            v.low_stock_threshold, v.weight_g, v.barcode, v.active ? 1 : 0
          );
          await db.prepare(`
            INSERT INTO stock_movements (id, variant_id, delta, reason, note, created_at)
            VALUES (?, ?, ?, 'admin_adjustment', 'CSV import new variant', datetime('now'))
          `).run(crypto.randomUUID(), newVariantId, v.stock_qty);
          summary.variantsCreated += 1;
        }
      }
    }
  })();

  try {
    await logAudit(actorId, 'csv_import', 'product', null, {
      productsCreated: summary.productsCreated,
      variantsCreated: summary.variantsCreated,
      rowsSkipped: summary.rowsSkipped,
    });
  } catch {
    // Audit failure must not fail the import
  }

  return { success: true, summary };
}
