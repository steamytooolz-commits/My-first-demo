'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import {
  validateSitePayload,
  importSiteData,
  MAX_IMPORT_BYTES,
} from '@/lib/site-transfer';

export interface SiteImportResponse {
  success: boolean;
  error?: string;
  summary?: { imported: Record<string, number>; skipped: string[] };
}

export async function importSiteAction(prevState: any, formData: FormData): Promise<SiteImportResponse> {
  const admin = await requireAdmin();
  const jsonText = String(formData.get('jsonText') || '');
  const mode = String(formData.get('mode') || 'merge');
  const confirm = String(formData.get('confirm') || '');

  if (!jsonText.trim()) {
    return { success: false, error: 'Choose an export .json file first.' };
  }
  if (jsonText.length > MAX_IMPORT_BYTES) {
    return { success: false, error: 'File is too large (8MB max).' };
  }
  if (mode !== 'merge' && mode !== 'replace') {
    return { success: false, error: 'Invalid import mode.' };
  }
  if (mode === 'replace' && confirm !== 'REPLACE') {
    return { success: false, error: 'Type REPLACE in the confirmation box to wipe and restore.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { success: false, error: 'That file is not valid JSON.' };
  }

  const checked = validateSitePayload(parsed);
  if (!checked.ok || !checked.doc) {
    return { success: false, error: checked.error || 'Invalid export file.' };
  }

  const summary = await importSiteData(checked.doc, mode);
  const total = Object.values(summary.imported).reduce((a, b) => a + b, 0);
  await logAudit(admin.id, `site_import_${mode}`, 'site', null, { rows: total } as any);

  revalidatePath('/', 'layout');
  return { success: true, summary };
}
