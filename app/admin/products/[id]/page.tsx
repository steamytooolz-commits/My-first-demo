import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { formatZar } from '@/lib/money';
import AdminProductEditForm from '@/components/AdminProductEditForm';
import { AdminVariantCreateForm, AdminStockAdjustForm } from '@/components/AdminVariantForm';
import { ArrowLeft } from 'lucide-react';

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

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-serif text-lg font-bold text-slate-900 pb-2 border-b border-slate-100">
          General Details
        </h2>
        <AdminProductEditForm product={product} categories={categories} primaryImage={images[0]?.url || ''} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="font-serif text-lg font-bold text-slate-900">Product Variants &amp; Inventory</h2>
            <p className="text-xs text-slate-500">Each variant has its own unique SKU, price, weight, and stock count.</p>
          </div>
        </div>

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
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right">Stock Adjustment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {variants.map((v: any) => (
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
                  <td className="py-3 px-3 text-center">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${v.active === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {v.active === 1 ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <AdminStockAdjustForm variantId={v.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {variants.length === 0 && (
            <p className="py-6 text-center text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg mt-3">
              No SKUs yet — this product is hidden from the store. Add the first variant below to publish it.
            </p>
          )}
        </div>

        <AdminVariantCreateForm productId={product.id} />
      </div>
    </div>
  );
}
