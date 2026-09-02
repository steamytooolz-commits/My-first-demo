import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { formatZar } from '@/lib/money';
import {
  adminSaveProductAction,
  adminSaveVariantAction,
  adminAdjustStockAction,
} from '@/app/actions/admin';
import { ArrowLeft, Plus, Edit2, RotateCw } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface ProductEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProductDetailPage({ params }: ProductEditPageProps) {
  const { id } = await params;

  const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
  if (!product) {
    notFound();
  }

  const categories = await db.prepare('SELECT id, name FROM categories ORDER BY name ASC').all() as any[];
  const variants = await db.prepare('SELECT * FROM product_variants WHERE product_id = ? ORDER BY price_cents ASC').all(id) as any[];
  const images = await db.prepare('SELECT url FROM product_images WHERE product_id = ? LIMIT 1').all(id) as any[];

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Top navigation */}
      <div className="flex items-center gap-2">
        <Link href="/admin/products" className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to products list</span>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-slate-900">{product.name}</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">ID: {product.id}</p>
        </div>
        <Link
          href={`/products/${product.slug}`}
          target="_blank"
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-slate-50"
        >
          View in Storefront ↗
        </Link>
      </div>

      {/* Edit Product Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-serif text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
          General Details
        </h2>

        <form action={async (formData: FormData) => {
          'use server';
          await adminSaveProductAction(null, formData);
        }} className="space-y-4 text-xs">
          <input type="hidden" name="id" value={product.id} />

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Product Title *</label>
            <input
              name="name"
              required
              defaultValue={product.name}
              className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">URL Slug *</label>
              <input
                name="slug"
                required
                defaultValue={product.slug}
                className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 font-mono focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <select
                name="category_id"
                defaultValue={product.category_id || ''}
                className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none"
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
                defaultValue={product.brand || ''}
                className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Primary Image URL</label>
              <input
                name="imageUrl"
                defaultValue={images[0]?.url || ''}
                className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              name="description"
              rows={4}
              defaultValue={product.description || ''}
              className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="active"
                defaultChecked={product.active === 1}
                className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
              />
              <span className="font-semibold text-slate-700">Active in Storefront</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="featured"
                defaultChecked={product.featured === 1}
                className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
              />
              <span className="font-semibold text-slate-700">Feature on Homepage</span>
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white hover:bg-teal-900"
            >
              Update Product Details
            </button>
          </div>
        </form>
      </div>

      {/* Product Variants & SKUs */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="font-serif text-lg font-bold text-slate-900">Product Variants &amp; Inventory</h2>
            <p className="text-xs text-slate-500">Each variant has its own unique SKU, price, weight, and stock count.</p>
          </div>
        </div>

        {/* Existing Variants Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-600">
              <tr>
                <th className="py-2.5 px-3">SKU</th>
                <th className="py-2.5 px-3">Variant Name</th>
                <th className="py-2.5 px-3 text-right">Price (ZAR)</th>
                <th className="py-2.5 px-3 text-center">Stock</th>
                <th className="py-2.5 px-3 text-center">Threshold</th>
                <th className="py-2.5 px-3 text-right">Weight (g)</th>
                <th className="py-2.5 px-3 text-right">Stock Adjustment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {variants.map(v => (
                <tr key={v.id}>
                  <td className="py-3 px-3 font-mono font-bold text-slate-800">{v.sku}</td>
                  <td className="py-3 px-3 font-medium text-slate-900">{v.name}</td>
                  <td className="py-3 px-3 text-right font-bold text-slate-900">{formatZar(v.price_cents)}</td>
                  <td className="py-3 px-3 text-center font-mono font-bold">
                    <span className={`px-2 py-0.5 rounded ${v.stock_qty <= v.low_stock_threshold ? 'bg-amber-100 text-amber-900' : 'text-slate-800'}`}>
                      {v.stock_qty}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-slate-500">{v.low_stock_threshold}</td>
                  <td className="py-3 px-3 text-right text-slate-600">{v.weight_g}g</td>
                  <td className="py-3 px-3 text-right">
                    {/* Inline stock adjustment form */}
                    <form action={async (formData: FormData) => {
                      'use server';
                      await adminAdjustStockAction(null, formData);
                    }} className="inline-flex items-center gap-1.5">
                      <input type="hidden" name="variantId" value={v.id} />
                      <input
                        type="number"
                        name="delta"
                        placeholder="±Qty"
                        required
                        className="w-16 rounded border border-slate-200 p-1 text-[11px] font-mono text-center"
                      />
                      <input
                        type="text"
                        name="note"
                        placeholder="Reason"
                        className="w-24 rounded border border-slate-200 p-1 text-[10px]"
                      />
                      <button
                        type="submit"
                        className="rounded bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white hover:bg-slate-800"
                      >
                        Adjust
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add New Variant Form */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3 text-xs">
          <h3 className="font-bold text-slate-900">Add Another Variant / SKU</h3>
          <form action={async (formData: FormData) => {
            'use server';
            await adminSaveVariantAction(null, formData);
          }} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input type="hidden" name="productId" value={product.id} />

            <div>
              <label className="block font-semibold text-slate-700 mb-1">SKU *</label>
              <input
                name="sku"
                required
                placeholder="e.g. NOTE-A4-LIN"
                className="w-full rounded border border-slate-200 p-1.5 uppercase font-mono text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Variant Name *</label>
              <input
                name="name"
                required
                placeholder="e.g. Lined / Matte Black"
                className="w-full rounded border border-slate-200 p-1.5 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Price (Rand) *</label>
              <input
                name="price_rand"
                type="number"
                step="0.01"
                required
                placeholder="245.00"
                className="w-full rounded border border-slate-200 p-1.5 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Initial Stock Qty</label>
              <input
                name="stock_qty"
                type="number"
                defaultValue="20"
                className="w-full rounded border border-slate-200 p-1.5 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Weight (Grams)</label>
              <input
                name="weight_g"
                type="number"
                defaultValue="400"
                className="w-full rounded border border-slate-200 p-1.5 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Low Stock Warning At</label>
              <input
                name="low_stock_threshold"
                type="number"
                defaultValue="5"
                className="w-full rounded border border-slate-200 p-1.5 text-xs font-mono"
              />
            </div>

            <div className="sm:col-span-2 flex items-end">
              <button
                type="submit"
                className="w-full rounded-lg bg-teal-800 py-2 font-semibold text-white hover:bg-teal-900 transition-colors"
              >
                + Add Variant SKU
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
