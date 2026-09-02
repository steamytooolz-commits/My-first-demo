import Link from 'next/link';
import { db } from '@/lib/db';
import { formatZar } from '@/lib/money';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { adminDeleteProductAction } from '@/app/actions/admin';

interface AdminProductsPageProps {
  searchParams: Promise<{ q?: string; category?: string }>;
}

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const { q, category } = await searchParams;

  let query = `
    SELECT p.*, c.name as category_name,
           (SELECT COUNT(*) FROM product_variants WHERE product_id = p.id) as variant_count,
           (SELECT COALESCE(SUM(stock_qty), 0) FROM product_variants WHERE product_id = p.id) as total_stock,
           (SELECT MIN(price_cents) FROM product_variants WHERE product_id = p.id) as min_price_cents
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
  `;

  const where: string[] = [];
  const params: any[] = [];

  if (q) {
    where.push('(p.name LIKE ? OR p.brand LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  if (category) {
    where.push('c.slug = ?');
    params.push(category);
  }

  if (where.length > 0) {
    query += ` WHERE ${where.join(' AND ')}`;
  }

  query += ` ORDER BY p.created_at DESC`;

  const products = await db.prepare(query).all(...params) as any[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-slate-900">Products &amp; Inventory</h1>
          <p className="text-xs text-slate-500 mt-1">Manage catalog stationery, variants, SKUs, and stock allocations.</p>
        </div>

        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-800 px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-teal-900 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Create New Product</span>
        </Link>
      </div>

      {/* Filter toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between gap-4">
        <form method="GET" action="/admin/products" className="relative flex-1 max-w-sm">
          <input
            type="text"
            name="q"
            defaultValue={q || ''}
            placeholder="Search products by title or brand..."
            className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
          />
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
        </form>
        <span className="text-xs text-slate-500">{products.length} products total</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-3 px-4">Product Name</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Brand</th>
              <th className="py-3 px-4 text-center">Variants</th>
              <th className="py-3 px-4 text-center">Total Stock</th>
              <th className="py-3 px-4 text-right">Base Price</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-slate-50/50">
                <td className="py-3 px-4">
                  <Link href={`/admin/products/${p.id}`} className="font-bold text-slate-900 hover:text-teal-800 block">
                    {p.name}
                  </Link>
                  <span className="text-[10px] text-slate-400 font-mono">/{p.slug}</span>
                </td>
                <td className="py-3 px-4 text-slate-600">{p.category_name || '—'}</td>
                <td className="py-3 px-4 text-slate-600">{p.brand || '—'}</td>
                <td className="py-3 px-4 text-center font-medium text-slate-700">{p.variant_count}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`inline-block font-mono font-bold text-xs px-2 py-0.5 rounded ${p.total_stock === 0 ? 'bg-rose-100 text-rose-800' : p.total_stock <= 5 ? 'bg-amber-100 text-amber-800' : 'text-slate-800'}`}>
                    {p.total_stock}
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-bold text-slate-900">
                  {p.min_price_cents ? formatZar(p.min_price_cents) : '—'}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${p.active === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {p.active === 1 ? 'Active' : 'Draft'}
                  </span>
                </td>
                <td className="py-3 px-4 text-right space-x-2">
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="inline-flex items-center gap-1 text-slate-600 hover:text-teal-800 font-semibold"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </Link>

                  <form action={async () => {
                    'use server';
                    await adminDeleteProductAction(p.id);
                  }} className="inline-block">
                    <button
                      type="submit"
                      className="text-rose-600 hover:text-rose-800 p-1"
                      title="Delete Product"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
