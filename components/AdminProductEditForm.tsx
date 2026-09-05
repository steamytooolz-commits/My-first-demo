'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { adminSaveProductAction } from '@/app/actions/admin';

interface Props {
  product: any;
  categories: { id: string; name: string }[];
  primaryImage: string;
}

export default function AdminProductEditForm({ product, categories, primaryImage }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await adminSaveProductAction(null, formData);
      if (!res.success) {
        setError(res.error || 'Could not save product.');
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      <input type="hidden" name="id" value={product.id} />
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 font-medium text-rose-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {saved && <p className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 font-semibold text-emerald-800">Saved.</p>}
      <div>
        <label className="block font-semibold text-slate-700 mb-1">Product Title *</label>
        <input name="name" required defaultValue={product.name} className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">URL Slug *</label>
          <input name="slug" required defaultValue={product.slug} className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 font-mono focus:border-teal-700 focus:outline-none" />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Category</label>
          <select name="category_id" defaultValue={product.category_id || ''} className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none">
            <option value="">-- Uncategorized --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Brand Name</label>
          <input name="brand" defaultValue={product.brand || ''} className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none" />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Primary Image URL</label>
          <input name="imageUrl" defaultValue={primaryImage} placeholder="/seed/a4-notebook.svg or https://…" className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none" />
        </div>
      </div>
      <div>
        <label className="block font-semibold text-slate-700 mb-1">Description</label>
        <textarea name="description" rows={4} defaultValue={product.description || ''} className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none" />
      </div>
      <div className="flex items-center gap-6 pt-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="active" defaultChecked={product.active === 1} className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700" />
          <span className="font-semibold text-slate-700">Active in Storefront</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" name="featured" defaultChecked={product.featured === 1} className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700" />
          <span className="font-semibold text-slate-700">Feature on Homepage</span>
        </label>
      </div>
      <div className="pt-2">
        <button type="submit" disabled={isPending} className="rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white hover:bg-teal-900 disabled:opacity-50">
          {isPending ? 'Saving…' : 'Update Product Details'}
        </button>
      </div>
    </form>
  );
}
