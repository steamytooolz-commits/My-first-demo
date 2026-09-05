import { describe, it, expect, afterEach } from 'vitest';
import {
  parseCsv,
  detectDelimiter,
  normalizeHeader,
  suggestMapping,
  parsePriceToCents,
  parseBool,
  slugify,
  executeProductImport,
  MAX_IMPORT_ROWS,
} from '../lib/csv-import';
import { db } from '../lib/db';

describe('csv delimiter + parser', () => {
  it('detects comma, semicolon and tab delimiters', () => {
    expect(detectDelimiter('name,price,stock')).toBe(',');
    expect(detectDelimiter('name;price;stock')).toBe(';');
    expect(detectDelimiter('name\tprice\tstock')).toBe('\t');
  });

  it('parses quoted commas and escaped quotes', () => {
    const parsed = parseCsv('name,description,price\n"Notebook, A4","192 pages",245.00\nPen,"5"" pack",115.00');
    expect(parsed.headers).toEqual(['name', 'description', 'price']);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0][0]).toBe('Notebook, A4');
    expect(parsed.rows[1][1]).toBe('5" pack');
  });

  it('handles decimal-comma locales with semicolons', () => {
    const parsed = parseCsv('naam;prys;voorraad\nNotaboek;R 245,00;10');
    expect(parsed.delimiter).toBe(';');
    expect(parsed.rows[0]).toEqual(['Notaboek', 'R 245,00', '10']);
  });

  it('strips BOM and skips blank lines', () => {
    const parsed = parseCsv('﻿name,price\n\nPen,10.00\n');
    expect(parsed.headers).toEqual(['name', 'price']);
    expect(parsed.rows).toHaveLength(1);
  });
});

describe('csv header mapping', () => {
  it('normalizes headers for lookup', () => {
    expect(normalizeHeader('  Product-Name__ ')).toBe('product name');
    expect(normalizeHeader('PRICE (R)')).toBe('price (r)');
  });

  it('maps supplier-style headers to fields', () => {
    const { mapping } = suggestMapping(['Title', 'Handle', 'Vendor', 'Qty', 'Was', 'Size']);
    expect(mapping[0]).toBe('name');
    expect(mapping[1]).toBe('slug');
    expect(mapping[2]).toBe('brand');
    expect(mapping[3]).toBe('stock');
    expect(mapping[4]).toBe('compare_at');
    expect(mapping[5]).toBe('variant');
  });

  it('ignores unknown columns with warnings', () => {
    const { mapping, warnings } = suggestMapping(['name', 'Mystery Column']);
    expect(mapping[0]).toBe('name');
    expect(mapping[1]).toBe('__ignore');
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('csv value parsing', () => {
  it('parses SA price formats to cents', () => {
    expect(parsePriceToCents('245.00')).toBe(24500);
    expect(parsePriceToCents('R 245.00')).toBe(24500);
    expect(parsePriceToCents('R1,299.00')).toBe(129900);
    expect(parsePriceToCents('245,00')).toBe(24500);
    expect(parsePriceToCents('')).toBeNull();
    expect(parsePriceToCents('free')).toBeNull();
    expect(parsePriceToCents('-5')).toBeNull();
  });

  it('parses status booleans', () => {
    expect(parseBool('yes', false)).toBe(true);
    expect(parseBool('Draft', true)).toBe(false);
    expect(parseBool('', true)).toBe(true);
    expect(parseBool('published', false)).toBe(true);
  });

  it('slugifies names safely', () => {
    expect(slugify('A4 Hardcover Notebook!')).toBe('a4-hardcover-notebook');
    expect(slugify('')).toBe('product');
  });
});

describe('csv import execution', () => {
  const slug = 'csv-probe-widget';

  afterEach(async () => {
    const product = await db.prepare('SELECT id FROM products WHERE slug = ?').get(slug) as any;
    if (product) {
      const variants = await db.prepare('SELECT id FROM product_variants WHERE product_id = ?').all(product.id) as any[];
      for (const v of variants) {
        await db.prepare('DELETE FROM stock_movements WHERE variant_id = ?').run(v.id);
      }
      await db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(product.id);
      await db.prepare('DELETE FROM product_images WHERE product_id = ?').run(product.id);
      await db.prepare('DELETE FROM products WHERE id = ?').run(product.id);
    }
  });

  it('imports grouped variants and updates on re-import', async () => {
    const headers = ['name', 'price', 'stock', 'sku'];
    const rows = [
      ['CSV Probe Widget', '100.00', '5', 'PROBE-A'],
      ['CSV Probe Widget', '120.00', '7', 'PROBE-B'],
    ];
    const mapping: Record<number, string> = { 0: 'name', 1: 'price', 2: 'stock', 3: 'sku' };

    const first = await executeProductImport(headers, rows, mapping, null);
    expect(first.success).toBe(true);
    expect(first.summary?.productsCreated).toBe(1);
    expect(first.summary?.variantsCreated).toBe(2);

    const product = await db.prepare('SELECT id FROM products WHERE slug = ?').get(slug) as any;
    expect(product).toBeTruthy();

    const second = await executeProductImport(headers, rows, mapping, null);
    expect(second.success).toBe(true);
    expect(second.summary?.productsUpdated).toBe(1);
    expect(second.summary?.variantsUpdated).toBe(2);
  });

  it('rejects imports missing name or price mappings', async () => {
    const headers = ['name', 'stock'];
    const rows = [['CSV Probe Widget', '5']];
    const res = await executeProductImport(headers, rows, { 0: 'name', 1: 'stock' }, null);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Price');
  });
});

describe('supplier format matrix (bulk-import hardening)', () => {
  it('handles tab, pipe and semicolon supplier layouts', () => {
    const tab = parseCsv('name\tprice\tstock\nPen\t10.00\t5');
    expect(tab.delimiter).toBe('\t');
    expect(tab.rows[0]).toEqual(['Pen', '10.00', '5']);

    const pipe = parseCsv('name|price|stock\nPen|10.00|5');
    expect(pipe.delimiter).toBe('|');
    expect(pipe.rows[0]).toEqual(['Pen', '10.00', '5']);

    const semi = parseCsv('name;price;stock\nPen;10,00;5');
    expect(semi.delimiter).toBe(';');
    expect(semi.rows[0]).toEqual(['Pen', '10,00', '5']);
  });

  it('handles CRLF, missing trailing newline and multiline quoted fields', () => {
    const crlf = parseCsv('name,price\r\nA,1.00\r\nB,2.00\r\n');
    expect(crlf.rows).toHaveLength(2);

    const noeol = parseCsv('name,price\nA,1.00');
    expect(noeol.rows).toHaveLength(1);
    expect(noeol.rows[0]).toEqual(['A', '1.00']);

    const multi = parseCsv('name,description,price\n"Widget","line1\nline2",10.00\nPen,Simple,5.00');
    expect(multi.rows).toHaveLength(2);
    expect(multi.rows[0][1]).toBe('line1\nline2');
  });

  it('maps Afrikaans wholesale headers', () => {
    const { mapping } = suggestMapping(['Naam', 'Beskrywing', 'Kategorie', 'Prys', 'Voorraad', 'Gewig']);
    expect(mapping[0]).toBe('name');
    expect(mapping[1]).toBe('description');
    expect(mapping[2]).toBe('category');
    expect(mapping[3]).toBe('price');
    expect(mapping[4]).toBe('stock');
    expect(mapping[5]).toBe('weight');
  });

  it('maps English supplier variants and flags duplicates', () => {
    const { mapping, warnings } = suggestMapping(['Title', 'Retail Price', 'Was', 'Mystery']);
    expect(mapping[0]).toBe('name');
    expect(mapping[1]).toBe('price');
    expect(mapping[2]).toBe('compare_at');
    expect(mapping[3]).toBe('__ignore');
    expect(warnings.length).toBeGreaterThan(0);

    const dup = suggestMapping(['Price', 'Retail Price']);
    expect(dup.mapping[0]).toBe('price');
    expect(dup.mapping[1]).toBe('__ignore');
    expect(dup.warnings.join(' ')).toContain('Price');
  });

  it('parses worldly SA price formats to cents', () => {
    expect(parsePriceToCents('R1 299,00')).toBe(129900);
    expect(parsePriceToCents('1,299.00')).toBe(129900);
    expect(parsePriceToCents('R 1,299.00')).toBe(129900);
    expect(parsePriceToCents('$12.50')).toBe(1250);
    expect(parsePriceToCents('€9,99')).toBe(999);
    expect(parsePriceToCents('ZAR 245')).toBe(24500);
    expect(parsePriceToCents('R 0.00')).toBe(0);
    expect(parsePriceToCents('   ')).toBeNull();
    expect(parsePriceToCents('(245.00)')).toBeNull();
  });

  it('truncates over-limit files at MAX_IMPORT_ROWS', () => {
    const lines = ['name,price'];
    for (let i = 0; i < MAX_IMPORT_ROWS + 5; i++) lines.push(`Item ${i},10.00`);
    const parsed = parseCsv(lines.join('\n'));
    expect(parsed.truncated).toBe(true);
    expect(parsed.rows).toHaveLength(MAX_IMPORT_ROWS);
  });

  it('rejects empty input with no headers', () => {
    expect(parseCsv('').headers).toEqual([]);
    expect(parseCsv('   \n  \n').headers).toEqual([]);
  });
});
