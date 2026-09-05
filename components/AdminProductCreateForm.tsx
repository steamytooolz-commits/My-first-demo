'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { adminCreateProductWithVariantAction } from '@/app/actions/admin';

function slugify(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

interface Category {
  id: string;
  name: string;
}

export default function AdminProductCreateForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  const autoSlug = useMemo(() => slugify(name), [name]);
  const effectiveSlug = slugTouched ? slug : autoSlug;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    // Use auto slug when the slug field was never hand-edited
    if (!slugTouched) formData.set('slug', autoSlug);
    startTransition(async () => {
      const res = await adminCreateProductWithVariantAction(null, formData);
      if (!res.success) {
        setError(res.error || 'Could not create product.');
        return;
      }
      router.push(res.productId ? `/admin/products/${res.productId}` : '/admin/products');
      router.refresh();
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/admin/products" className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to products</span>
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-slate-900">Create New Product</h1>
          <p className="text-xs text-slate-500 mt-1">
            Product + first SKU in one step — new items appear in the store immediately.
            Add more variants afterwards from the product page.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Product Title *</label>
            <input
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kalahari Brass Rollerball Pen"
              className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">URL Slug *</label>
              <input
                name="slug"
                required
                value={effectiveSlug}
                onChange={(e) => { setSlug(e.target.value.toLowerCase()); setSlugTouched(true); }}
                placeholder="auto from title"
                className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 font-mono focus:border-teal-700 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-400">Storefront URL: /products/{effectiveSlug || '…'}</p>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <select name="category_id" className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none">
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
              <input name="brand" placeholder="e.g. Paper & Quill Workshop" className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Product Image URL</label>
              <input
                name="imageUrl"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="/seed/a4-notebook.svg or https://…"
                className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none"
              />
              {imageUrl ? (
                <p className="mt-1 text-[11px] text-slate-400 truncate">Preview: <span className="font-mono">{imageUrl}</span></p>
              ) : null}
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <textarea name="description" rows={3} placeholder="Materials, paper weight, binding, specs…" className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none" />
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-teal-800" />
              First SKU / Variant *
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">SKU</label>
                <input name="sku" placeholder="auto if empty" className="w-full rounded border border-slate-200 p-1.5 uppercase font-mono" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Variant name</label>
                <input name="variant_name" placeholder="Standard" defaultValue="Standard" className="w-full rounded border border-slate-200 p-1.5" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Price (Rand) *</label>
                <input name="price_rand" type="number" step="0.01" min="0" required placeholder="245.00" className="w-full rounded border border-slate-200 p-1.5 font-mono" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Stock qty</label>
                <input name="stock_qty" type="number" min="0" defaultValue="20" className="w-full rounded border border-slate-200 p-1.5 font-mono" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Weight (g)</label>
                <input name="weight_g" type="number" min="0" defaultValue="400" className="w-full rounded border border-slate-200 p-1.5 font-mono" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Low-stock at</label>
                <input name="low_stock_threshold" type="number" min="0" defaultValue="5" className="w-full rounded border border-slate-200 p-1.5 font-mono" />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" name="variant_active" defaultChecked className="h-4 w-4 rounded border-slate-300 text-teal-800" />
              <span className="font-semibold text-slate-700">Variant active (visible for sale)</span>
            </label>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="active" defaultChecked className="h-4 w-4 rounded border-slate-300 text-teal-800" />
              <span className="font-semibold text-slate-700">Active (visible in storefront)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" name="featured" className="h-4 w-4 rounded border-slate-300 text-teal-800" />
              <span className="font-semibold text-slate-700">Feature on homepage</span>
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link href="/admin/products" className="rounded-lg border border-slate-200 px-4 py-2 text-slate-600 hover:bg-slate-50">Cancel</Link>
            <button type="submit" disabled={isPending} className="rounded-lg bg-teal-800 px-5 py-2 font-semibold text-white hover:bg-teal-900 disabled:opacity-50">
              {isPending ? 'Creating…' : 'Create Product & SKU'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
