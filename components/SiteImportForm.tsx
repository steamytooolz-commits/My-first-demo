'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { importSiteAction } from '@/app/actions/site-transfer';

const MAX_BYTES = 8 * 1024 * 1024;

export default function SiteImportForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fileName, setFileName] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ imported: Record<string, number>; skipped: string[] } | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setSummary(null);
    if (file.size > MAX_BYTES) {
      setError('File is too large (8MB max).');
      return;
    }
    const text = await file.text();
    setJsonText(text);
    setFileName(file.name);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSummary(null);
    if (!jsonText.trim()) {
      setError('Choose an export .json file first.');
      return;
    }
    if (mode === 'replace' && confirm !== 'REPLACE') {
      setError('Type REPLACE to confirm a full wipe-and-restore.');
      return;
    }
    if (mode === 'replace' && !window.confirm('Replace ALL site data with this file? This cannot be undone. Export first if unsure.')) {
      return;
    }
    const formData = new FormData();
    formData.set('jsonText', jsonText);
    formData.set('mode', mode);
    formData.set('confirm', confirm);
    startTransition(async () => {
      const res = await importSiteAction(null, formData);
      if (!res.success) {
        setError(res.error || 'Import failed.');
        return;
      }
      setSummary(res.summary || null);
      router.refresh();
    });
  }

  const totalRows = summary ? Object.values(summary.imported).reduce((a, b) => a + b, 0) : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {summary && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
          <p className="flex items-center gap-2 text-xs font-bold text-emerald-900">
            <CheckCircle2 className="h-4 w-4" />
            <span>Restore complete — {totalRows.toLocaleString()} rows processed</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] font-mono text-emerald-900">
            {Object.entries(summary.imported).filter(([, n]) => n > 0).map(([t, n]) => (
              <span key={t} className="rounded bg-white/70 px-2 py-1">{t}: {n}</span>
            ))}
          </div>
          {summary.skipped.length > 0 && (
            <p className="text-[11px] text-amber-800">Skipped tables: {summary.skipped.join(', ')}</p>
          )}
        </div>
      )}

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center hover:border-teal-700 hover:bg-teal-50/50 transition-colors">
        <Upload className="h-6 w-6 text-slate-400" />
        <span className="text-xs font-semibold text-slate-700">{fileName || 'Click to choose a site-export .json file'}</span>
        <span className="text-[11px] text-slate-400">Max 8MB</span>
        <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <button
          type="button"
          aria-pressed={mode === 'merge'}
          onClick={() => setMode('merge')}
          className={`rounded-xl border p-3 text-left transition-all ${mode === 'merge' ? 'border-teal-700 bg-teal-50/50 ring-1 ring-teal-700' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <span className="font-bold text-slate-900 block">Merge (safe)</span>
          <span className="text-[11px] text-slate-500">Add missing rows, keep everything already here.</span>
        </button>
        <button
          type="button"
          aria-pressed={mode === 'replace'}
          onClick={() => setMode('replace')}
          className={`rounded-xl border p-3 text-left transition-all ${mode === 'replace' ? 'border-rose-600 bg-rose-50/50 ring-1 ring-rose-600' : 'border-slate-200 hover:border-slate-300'}`}
        >
          <span className="font-bold text-slate-900 block">Replace (wipe first)</span>
          <span className="text-[11px] text-slate-500">Delete all site data, then restore the file exactly.</span>
        </button>
      </div>

      {mode === 'replace' && (
        <div>
          <label className="block font-semibold text-slate-700 mb-1 text-xs">Type REPLACE to confirm</label>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="REPLACE"
            className="w-full rounded-lg border border-rose-300 p-2 font-mono text-xs focus:border-rose-600 focus:outline-none"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !jsonText}
        className="rounded-xl bg-teal-800 px-5 py-2.5 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Restoring…' : 'Restore Site Data'}
      </button>
    </form>
  );
}
