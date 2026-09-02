import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { adminSaveProductAction } from '@/app/actions/admin';
import { ArrowLeft } from 'lucide-react';

export default async function AdminNewProductPage() {
  const categories = db.prepare('SELECT id, name FROM categories WHERE active = 1 ORDER BY name ASC').all() as any[];

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
          <p className="text-xs text-slate-500 mt-1">Add general product information. You can add SKUs and variants right after creation.</p>
        </div>

        <form action={async (formData: FormData) => {
          'use server';
          const res = await adminSaveProductAction(null, formData);
          if (res?.success) {
            redirect('/admin/products');
          }
        }} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Product Title *</label>
            <input
              name="name"
              required
              placeholder="e.g. Kalahari Brass Rollerball Pen"
              className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">URL Slug *</label>
              <input
                name="slug"
                required
                placeholder="e.g. kalahari-brass-rollerball"
                className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 font-mono focus:border-teal-700 focus:outline-none text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <select
                name="category_id"
                className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none text-xs"
              >
                <option value="">-- Uncategorized --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Brand Name</label>
              <input
                name="brand"
                placeholder="e.g. Paper & Quill Workshop"
                className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Product Image URL</label>
              <input
                name="imageUrl"
                defaultValue="/seed/brass-pen.svg"
                placeholder="/seed/brass-pen.svg"
                className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              name="description"
              rows={4}
              placeholder="Detailed description of materials, paper weight, binding, and specifications..."
              className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none text-xs"
            />
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="active"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
              />
              <span className="font-semibold text-slate-700">Active (Visible in storefront)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="featured"
                className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
              />
              <span className="font-semibold text-slate-700">Feature on Homepage</span>
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Link
              href="/admin/products"
              className="rounded-lg border border-slate-200 px-4 py-2 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="rounded-lg bg-teal-800 px-5 py-2 font-semibold text-white hover:bg-teal-900"
            >
              Create Product &amp; Add Variants
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
