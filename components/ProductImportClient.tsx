'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  analyzeProductImportAction,
  executeProductImportAction,
  type ImportAnalysisResponse,
} from '@/app/actions/admin';
import { IMPORT_FIELDS } from '@/lib/import-fields';
import { Upload, FileSpreadsheet, ArrowRight, CheckCircle2, AlertTriangle, RotateCcw, ClipboardPaste, Download } from 'lucide-react';

const TEMPLATE_CSV = [
  'name,slug,category,brand,description,variant,sku,price,compare_at,stock,active,featured,image',
  '"A4 Hardcover Executive Notebook",a4-hardcover-notebook,Notebooks & Pads,Kalahari Paper Co.,"192 pages of 100gsm ivory paper",Matte Charcoal Black,NB-A4-BLK,245.00,280.00,45,yes,no,',
  '"A4 Hardcover Executive Notebook",a4-hardcover-notebook,Notebooks & Pads,Kalahari Paper Co.,"192 pages of 100gsm ivory paper",Deep Midnight Navy,NB-A4-NAVY,245.00,,3,yes,no,',
  '"SmoothFlow Gel Pen 5-Pack",gel-pen-5-pack,Pens & Writing,Cape Quill Co.,0.5mm archival gel ink,Jet Black,PEN-GEL-BLK,115.00,135.00,120,yes,no,',
].join('\n');

const MAX_FILE_BYTES = 5 * 1024 * 1024;

type Step = 'upload' | 'map' | 'result';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function ProductImportClient() {
  const [step, setStep] = useState<Step>('upload');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [analysis, setAnalysis] = useState<ImportAnalysisResponse | null>(null);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function readFile(file: File) {
    setError(null);
    if (file.size > MAX_FILE_BYTES) {
      setError(`File is ${formatBytes(file.size)} — limit is ${formatBytes(MAX_FILE_BYTES)}. Split into smaller imports.`);
      return;
    }
    const text = await file.text();
    if (!text.trim()) {
      setError('That file looks empty.');
      return;
    }
    setCsvText(text);
    setFileName(file.name);
    setFileSize(file.size);
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    void readFile(file);
  }

  function applyPaste() {
    if (!pasteText.trim()) {
      setError('Paste CSV text first.');
      return;
    }
    setError(null);
    setCsvText(pasteText);
    setFileName('pasted.csv');
    setFileSize(new Blob([pasteText]).size);
    setShowPaste(false);
  }

  async function handleAnalyze() {
    if (!csvText.trim()) {
      setError('Choose a CSV file or paste CSV text first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set('csvText', csvText);
      const res = await analyzeProductImportAction(null, formData);
      if (!res.success) {
        setError(res.error || 'Could not analyze the file.');
        return;
      }
      setAnalysis(res);
      setMapping(res.mapping || {});
      setStep('map');
    } catch (err: any) {
      setError(err?.message || 'Analysis failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set('csvText', csvText);
      formData.set('mapping', JSON.stringify(mapping));
      const res = await executeProductImportAction(null, formData);
      if (!res.success) {
        setError(res.error || 'Import failed.');
        return;
      }
      setResult(res.summary);
      setStep('result');
    } catch (err: any) {
      setError(err?.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep('upload');
    setCsvText('');
    setFileName('');
    setFileSize(0);
    setPasteText('');
    setAnalysis(null);
    setMapping({});
    setResult(null);
    setError(null);
  }

  const mappedValues = Object.values(mapping);
  const hasName = mappedValues.includes('name');
  const hasPrice = mappedValues.includes('price');

  function downloadErrorsCsv() {
    if (!result?.errors?.length) return;
    const lines = ['row,message', ...result.errors.map((e: any) => `${e.row},"${String(e.message || '').replace(/"/g, '""')}"`)];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {step === 'upload' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h2 className="font-serif text-lg font-bold text-slate-900">1. Upload catalogue CSV</h2>
            <p className="text-xs text-slate-500 mt-1">
              Drag &amp; drop, click to browse, or paste CSV text. Delimiter auto-detected (comma, semicolon, tab).
              Max ~2,000 rows / {formatBytes(MAX_FILE_BYTES)} per import.
            </p>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void readFile(f);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${dragOver ? 'border-teal-700 bg-teal-50' : 'border-slate-300 bg-slate-50 hover:border-teal-700 hover:bg-teal-50/50'}`}
          >
            <Upload className="h-6 w-6 text-slate-400" />
            <span className="text-xs font-semibold text-slate-700">
              {fileName ? `${fileName} (${formatBytes(fileSize)})` : 'Drop a .csv here or click to browse'}
            </span>
            <span className="text-[11px] text-slate-400">Max ~2,000 rows per import</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>

          {csvText && (
            <p className="text-[11px] text-slate-500 font-mono truncate">
              Loaded {(csvText.split(/\r?\n/).length - 1).toLocaleString()} lines • {formatBytes(new Blob([csvText]).size)}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={busy || !csvText}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-xs font-semibold text-white shadow hover:bg-teal-900 disabled:opacity-50 transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>{busy ? 'Analyzing…' : 'Analyze columns'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPaste((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ClipboardPaste className="h-4 w-4" />
              <span>{showPaste ? 'Hide paste box' : 'Paste CSV instead'}</span>
            </button>
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`}
              download="product-import-template.csv"
              className="text-xs font-semibold text-teal-800 hover:underline"
            >
              Download CSV template
            </a>
            {csvText && (
              <button type="button" onClick={reset} className="text-xs font-semibold text-slate-500 hover:text-slate-900">
                Clear
              </button>
            )}
          </div>

          {showPaste && (
            <div className="space-y-2">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={6}
                placeholder="name,price,stock&#10;Notebook,245.00,10"
                className="w-full rounded-lg border border-slate-200 p-3 font-mono text-xs focus:border-teal-700 focus:outline-none"
              />
              <button type="button" onClick={applyPaste} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                Use pasted CSV
              </button>
            </div>
          )}

          <details className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold text-slate-800">Recognised columns &amp; rules</summary>
            <ul className="mt-2 space-y-1 list-disc pl-5">
              <li><strong>Required:</strong> product name + price. Everything else is optional.</li>
              <li><strong>Aliases work:</strong> “Title” → name, “Handle” → slug, “Vendor” → brand, “Qty/Inventory” → stock, “Size/Colour” → variant name, “Was/RRP” → compare-at price.</li>
              <li><strong>Prices accept:</strong> 245.00, R 245.00, R1,299.00, 245,00 (decimal comma).</li>
              <li><strong>Missing slug/SKU</strong> are auto-generated. Missing categories are created.</li>
              <li><strong>Repeated product</strong> (same slug/name) across rows = multiple variants.</li>
              <li><strong>Re-importing</strong> the same slug/SKU updates instead of duplicating.</li>
              <li>Products without any valid variant stay hidden from the store until a valid SKU is added.</li>
            </ul>
          </details>
        </div>
      )}

      {step === 'map' && analysis && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-lg font-bold text-slate-900">2. Confirm column mapping</h2>
              <p className="text-xs text-slate-500 mt-1">
                {fileName} • {analysis.rowCount} data rows • delimiter {analysis.delimiterLabel}
                {analysis.truncated ? ' • truncated to 2,000 rows' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStep('upload')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>
          </div>

          {!hasName || !hasPrice ? (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
              Map at least <strong>Product name</strong> {!hasName && '(missing)'} and <strong>Price</strong> {!hasPrice && '(missing)'} to continue.
            </div>
          ) : null}

          {analysis.warnings && analysis.warnings.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
              {analysis.warnings.slice(0, 5).map((w, i) => (
                <p key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </p>
              ))}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                  <th className="py-2 pr-3">CSV column</th>
                  <th className="py-2 pr-3">Maps to</th>
                  <th className="py-2">Sample values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analysis.headers?.map((header, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-3 font-mono font-bold text-slate-800">{header || <span className="text-slate-400">(empty)</span>}</td>
                    <td className="py-2 pr-3">
                      <select
                        value={mapping[i] || '__ignore'}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [i]: e.target.value }))}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
                      >
                        {IMPORT_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 text-slate-500 font-mono text-[11px]">
                      {(analysis.samples || []).map((s) => s[header]).filter(Boolean).slice(0, 3).join(' · ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleImport}
            disabled={busy || !hasName || !hasPrice}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-xs font-semibold text-white shadow hover:bg-teal-900 disabled:opacity-50 transition-colors"
          >
            <span>{busy ? 'Importing…' : `Import ${analysis.rowCount} rows`}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {step === 'result' && result && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            <h2 className="font-serif text-lg font-bold text-slate-900">Import complete</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
            {[
              ['Products created', result.productsCreated],
              ['Products updated', result.productsUpdated],
              ['Variants created', result.variantsCreated],
              ['Variants updated', result.variantsUpdated],
              ['Categories created', result.categoriesCreated],
              ['Rows skipped', result.rowsSkipped],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-xl font-bold text-slate-900">{value as number}</p>
                <p className="text-[11px] text-slate-500">{label as string}</p>
              </div>
            ))}
          </div>

          {result.errors && result.errors.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-bold">Rows needing attention (showing {Math.min(result.errors.length, 10)} of {result.errors.length}):</p>
                <button type="button" onClick={downloadErrorsCsv} className="inline-flex items-center gap-1 font-semibold text-amber-900 hover:underline">
                  <Download className="h-3.5 w-3.5" />
                  <span>Errors CSV</span>
                </button>
              </div>
              {result.errors.slice(0, 10).map((e: any, i: number) => (
                <p key={i} className="font-mono text-[11px]">Row {e.row}: {e.message}</p>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/products"
              className="rounded-xl bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 transition-colors"
            >
              View products
            </Link>
            <Link
              href="/catalog"
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              View storefront
            </Link>
            <button
              type="button"
              onClick={reset}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
