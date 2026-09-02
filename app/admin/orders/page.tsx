import Link from 'next/link';
import AutoSubmitSelect from '@/components/AutoSubmitSelect';
import { db } from '@/lib/db';
import { formatZar } from '@/lib/money';
import { Download, Search, Eye, Filter } from 'lucide-react';

interface AdminOrdersPageProps {
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  const { status, q } = await searchParams;

  let query = `
    SELECT o.*,
           (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
           (SELECT invoice_number FROM invoices WHERE order_id = o.id LIMIT 1) as invoice_number
    FROM orders o
  `;

  const where: string[] = [];
  const params: any[] = [];

  if (status && status !== 'all') {
    where.push('o.status = ?');
    params.push(status);
  }

  if (q) {
    where.push('(o.order_number LIKE ? OR o.email LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  if (where.length > 0) {
    query += ` WHERE ${where.join(' AND ')}`;
  }

  query += ` ORDER BY o.placed_at DESC`;

  const orders = await db.prepare(query).all(...params) as any[];

  const statusColors: Record<string, string> = {
    paid: 'bg-emerald-100 text-emerald-900',
    pending_payment: 'bg-amber-100 text-amber-900',
    processing: 'bg-sky-100 text-sky-900',
    shipped: 'bg-indigo-100 text-indigo-900',
    delivered: 'bg-teal-100 text-teal-900',
    cancelled: 'bg-rose-100 text-rose-900',
    refunded: 'bg-slate-200 text-slate-800',
  };

  return (
    <div className="space-y-6">
      {/* Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-slate-900">Orders Management</h1>
          <p className="text-xs text-slate-500 mt-1">Review orders, update dispatch statuses, and inspect audit histories.</p>
        </div>

        <a
          href="/api/admin/export/orders"
          download
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <Download className="h-4 w-4 text-slate-500" />
          <span>Export Orders CSV</span>
        </a>
      </div>

      {/* Toolbar & Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <form method="GET" action="/admin/orders" className="flex items-center gap-3 w-full sm:w-auto flex-1">
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              name="q"
              defaultValue={q || ''}
              placeholder="Search by #order or email..."
              className="w-full rounded-lg border border-slate-200 py-1.5 pl-8 pr-3 text-xs focus:border-teal-700 focus:outline-none"
            />
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          </div>

          <AutoSubmitSelect
            name="status"
            defaultValue={status || 'all'}
            className="rounded-lg border border-slate-200 p-1.5 text-xs text-slate-900 focus:border-teal-700 focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="paid">Paid</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </AutoSubmitSelect>
        </form>

        <span className="text-slate-500">{orders.length} orders found</span>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-3 px-4">Order #</th>
              <th className="py-3 px-4">Date Placed</th>
              <th className="py-3 px-4">Customer Email</th>
              <th className="py-3 px-4 text-center">Items</th>
              <th className="py-3 px-4">Method</th>
              <th className="py-3 px-4 text-right">Total</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-slate-50/50">
                <td className="py-3 px-4">
                  <Link href={`/admin/orders/${o.id}`} className="font-bold text-slate-900 hover:text-teal-800">
                    #{o.order_number}
                  </Link>
                </td>
                <td className="py-3 px-4 text-slate-500">{new Date(o.placed_at).toLocaleDateString()}</td>
                <td className="py-3 px-4 text-slate-800">{o.email}</td>
                <td className="py-3 px-4 text-center text-slate-600">{o.item_count}</td>
                <td className="py-3 px-4 text-slate-600 capitalize">{o.shipping_method}</td>
                <td className="py-3 px-4 text-right font-bold text-slate-900">{formatZar(o.total_cents)}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${statusColors[o.status] || 'bg-slate-100'}`}>
                    {o.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="py-3 px-4 text-right space-x-2">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="inline-flex items-center gap-1 font-semibold text-teal-800 hover:underline"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Manage</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
