'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { adminSaveVariantAction, adminAdjustStockAction } from '@/app/actions/admin';

export function AdminVariantCreateForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await adminSaveVariantAction(null, formData);
      if (!res.success) {
        setError(res.error || 'Could not add variant.');
        return;
      }
      (e.target as HTMLFormElement).reset();
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3 text-xs">
      <h3 className="font-bold text-slate-900">Add Another Variant / SKU</h3>
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 font-medium text-rose-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <input type="hidden" name="productId" value={productId} />
        <div>
          <label className="block font-semibold text-slate-700 mb-1">SKU *</label>
          <input name="sku" required placeholder="e.g. NOTE-A4-LIN" className="w-full rounded border border-slate-200 p-1.5 uppercase font-mono text-xs" />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Variant Name *</label>
          <input name="name" required placeholder="e.g. Lined / Matte Black" className="w-full rounded border border-slate-200 p-1.5 text-xs" />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Price (Rand) *</label>
          <input name="price_rand" type="number" step="0.01" min="0" required placeholder="245.00" className="w-full rounded border border-slate-200 p-1.5 text-xs font-mono" />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Compare-at (Rand)</label>
          <input name="compare_at_rand" type="number" step="0.01" min="0" placeholder="280.00" className="w-full rounded border border-slate-200 p-1.5 text-xs font-mono" />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Initial Stock Qty</label>
          <input name="stock_qty" type="number" min="0" defaultValue="20" className="w-full rounded border border-slate-200 p-1.5 text-xs font-mono" />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Weight (Grams)</label>
          <input name="weight_g" type="number" min="0" defaultValue="400" className="w-full rounded border border-slate-200 p-1.5 text-xs font-mono" />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Low Stock Warning At</label>
          <input name="low_stock_threshold" type="number" min="0" defaultValue="5" className="w-full rounded border border-slate-200 p-1.5 text-xs font-mono" />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Barcode</label>
          <input name="barcode" placeholder="optional" className="w-full rounded border border-slate-200 p-1.5 text-xs font-mono" />
        </div>
        <label className="flex items-center gap-2 cursor-pointer sm:col-span-2">
          <input type="checkbox" name="active" defaultChecked className="h-4 w-4 rounded border-slate-300 text-teal-800" />
          <span className="font-semibold text-slate-700">Active (available for sale)</span>
        </label>
        <div className="sm:col-span-2 flex items-end">
          <button type="submit" disabled={isPending} className="w-full rounded-lg bg-teal-800 py-2 font-semibold text-white hover:bg-teal-900 transition-colors disabled:opacity-50">
            {isPending ? 'Adding…' : '+ Add Variant SKU'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function AdminStockAdjustForm({ variantId }: { variantId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await adminAdjustStockAction(null, formData);
      if (!res.success) {
        setError(res.error || 'Adjustment failed.');
        return;
      }
      (e.target as HTMLFormElement).reset();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="inline-flex items-center gap-1.5">
      <input type="hidden" name="variantId" value={variantId} />
      <input type="number" name="delta" placeholder="±Qty" required className="w-16 rounded border border-slate-200 p-1 text-[11px] font-mono text-center" />
      <input type="text" name="note" placeholder="Reason" className="w-24 rounded border border-slate-200 p-1 text-[10px]" />
      <button type="submit" disabled={isPending} className="rounded bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
        {isPending ? '…' : 'Adjust'}
      </button>
      {error && <span className="text-[10px] text-rose-600">{error}</span>}
    </form>
  );
}
