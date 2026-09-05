import { db } from './db';

export const SITE_EXPORT_VERSION = 1;
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

// Content tables in dependency-safe INSERT order (parents before children).
// Deliberately excluded: sessions + login_attempts (ephemeral security rows),
// rate_limits (ephemeral counters), schema_migrations (environment-specific).
export const SITE_TABLES = [
  'users',
  'settings',
  'categories',
  'products',
  'product_images',
  'product_variants',
  'coupons',
  'carts',
  'cart_items',
  'coupon_redemptions',
  'addresses',
  'orders',
  'order_items',
  'order_events',
  'payments',
  'invoices',
  'sequences',
  'stock_movements',
  'audit_logs',
  'data_subject_requests',
  'trade_applications',
];

export interface SiteExportDoc {
  kind: 'paper-quill-site-export';
  version: number;
  exported_at: string;
  tables: Record<string, any[]>;
}

export async function exportSiteData(): Promise<SiteExportDoc> {
  const tables: Record<string, any[]> = {};
  for (const t of SITE_TABLES) {
    try {
      tables[t] = (await db.prepare(`SELECT * FROM ${t}`).all()) as any[];
    } catch {
      tables[t] = []; // table missing on older DBs (e.g. trade_applications pre-003)
    }
  }
  return {
    kind: 'paper-quill-site-export',
    version: SITE_EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    tables,
  };
}

export function validateSitePayload(raw: unknown): { ok: boolean; error?: string; doc?: SiteExportDoc } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Not a site export file.' };
  const d = raw as any;
  if (d.kind !== 'paper-quill-site-export') return { ok: false, error: 'Not a Paper & Quill site export (bad file).' };
  if (d.version !== SITE_EXPORT_VERSION) return { ok: false, error: `Unsupported export version ${String(d.version)}. Re-export from the current admin.` };
  if (!d.tables || typeof d.tables !== 'object') return { ok: false, error: 'Export file has no tables.' };
  return { ok: true, doc: d as SiteExportDoc };
}

async function targetColumns(table: string): Promise<string[]> {
  const info = (await db.prepare(`PRAGMA table_info(${table})`).all()) as any[];
  return info
    .map((c: any) => String(c?.name ?? Object.values(c ?? {})[1] ?? ''))
    .filter(Boolean);
}

function toStorable(v: any): any {
  return v === undefined ? null : v;
}

export interface SiteImportResult {
  imported: Record<string, number>;
  skipped: string[];
}

/**
 * Restore a site export.
 * - merge: INSERT OR IGNORE — existing rows (same id) are kept, missing rows added. Safe default.
 * - replace: wipes content tables first, then INSERT OR REPLACE. Requires typed confirmation in the action.
 * Column lists are intersected with the live schema, so exports restore cleanly
 * across migration levels (unknown columns dropped, missing columns defaulted).
 */
export async function importSiteData(doc: SiteExportDoc, mode: 'merge' | 'replace'): Promise<SiteImportResult> {
  const imported: Record<string, number> = {};
  const skipped: string[] = [];

  await db.transaction(async () => {
    if (mode === 'replace') {
      for (const t of [...SITE_TABLES].reverse()) {
        try {
          await db.prepare(`DELETE FROM ${t}`).run();
        } catch {
          skipped.push(t);
        }
      }
    }

    const verb = mode === 'replace' ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE';
    for (const t of SITE_TABLES) {
      const rows = Array.isArray(doc.tables[t]) ? doc.tables[t] : null;
      if (!rows) continue;
      let cols: string[];
      try {
        cols = await targetColumns(t);
      } catch {
        skipped.push(t);
        continue;
      }
      if (cols.length === 0) {
        skipped.push(t);
        continue;
      }
      let n = 0;
      for (const row of rows) {
        if (!row || typeof row !== 'object') continue;
        const keys = Object.keys(row).filter((k) => cols.includes(k));
        if (keys.length === 0) continue;
        const placeholders = keys.map(() => '?').join(',');
        try {
          await db.prepare(`${verb} INTO ${t} (${keys.join(',')}) VALUES (${placeholders})`).run(
            ...keys.map((k) => toStorable((row as any)[k]))
          );
          n++;
        } catch {
          // per-row tolerance: one bad row never aborts the restore
        }
      }
      imported[t] = n;
    }
  })();

  return { imported, skipped };
}
