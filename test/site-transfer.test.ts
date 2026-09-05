import { describe, it, expect, afterEach } from 'vitest';
import {
  exportSiteData,
  validateSitePayload,
  importSiteData,
  SITE_EXPORT_VERSION,
  SITE_TABLES,
} from '../lib/site-transfer';
import { db } from '../lib/db';

const PROBE_ID = 'transfer-probe-cat';

function probeDoc() {
  return {
    kind: 'paper-quill-site-export',
    version: SITE_EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    tables: {
      categories: [
        { id: PROBE_ID, name: 'Transfer Probe', slug: 'transfer-probe', description: '', active: 1, sort_order: 99 },
      ],
    },
  };
}

describe('site transfer', () => {
  afterEach(async () => {
    await db.prepare('DELETE FROM categories WHERE id = ?').run(PROBE_ID);
  });

  it('exports a versioned doc covering all content tables', async () => {
    const doc = await exportSiteData();
    expect(doc.kind).toBe('paper-quill-site-export');
    expect(doc.version).toBe(SITE_EXPORT_VERSION);
    for (const t of SITE_TABLES) {
      expect(Array.isArray(doc.tables[t]), `missing table ${t}`).toBe(true);
    }
  });

  it('rejects non-export payloads', () => {
    expect(validateSitePayload(null).ok).toBe(false);
    expect(validateSitePayload({}).ok).toBe(false);
    expect(validateSitePayload({ kind: 'nope', version: 1, tables: {} }).ok).toBe(false);
    expect(validateSitePayload({ kind: 'paper-quill-site-export', version: 999, tables: {} }).ok).toBe(false);
    expect(validateSitePayload({ kind: 'paper-quill-site-export', version: SITE_EXPORT_VERSION }).ok).toBe(false);
  });

  it('merge-imports rows and tolerates re-import', async () => {
    const first = await importSiteData(probeDoc() as any, 'merge');
    expect(first.imported.categories).toBe(1);
    const row = (await db.prepare('SELECT id, slug FROM categories WHERE id = ?').get(PROBE_ID)) as any;
    expect(row?.slug).toBe('transfer-probe');

    const second = await importSiteData(probeDoc() as any, 'merge');
    expect(second.imported.categories).toBe(1);
    const count = (await db.prepare('SELECT COUNT(*) as c FROM categories WHERE id = ?').get(PROBE_ID)) as any;
    expect(count.c).toBe(1);
  });

  it('drops unknown columns instead of failing', async () => {
    const doc = probeDoc();
    (doc.tables.categories[0] as any).future_column_xyz = 'nope';
    const res = await importSiteData(doc as any, 'merge');
    expect(res.imported.categories).toBe(1);
  });
});
