import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatZar } from '@/lib/money';
import { FileText, ArrowRight } from 'lucide-react';

export default async function CustomerOrdersPage() {
  const user = await requireUser();

  const orders = db.prepare(`
    SELECT o.*, 
           (SELECT invoice_number FROM invoices WHERE order_id = o.id LIMIT 1) as invoice_number,
           (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
    FROM orders o
    WHERE o.user_id = ?
    ORDER BY o.placed_at DESC
  `).all(user.id) as any[];

  const statusBadges: Record<string, string> = {
    paid: 'bg-emerald-100 text-emerald-900',
    pending_payment: 'bg-amber-100 text-amber-900',
    processing: 'bg-sky-100 text-sky-900',
    shipped: 'bg-indigo-100 text-indigo-900',
    delivered: 'bg-teal-100 text-teal-900',
    cancelled: 'bg-rose-100 text-rose-900',
    refunded: 'bg-slate-200 text-slate-800',
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      <div>
        <h2 className="font-serif text-xl font-bold text-slate-900">Your Orders &amp; Invoices</h2>
        <p className="text-xs text-slate-500 mt-1">View fulfillment status, tracking updates, and download official VAT invoices.</p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
          <p className="text-xs text-slate-500">You haven&apos;t placed any orders yet.</p>
          <Link href="/catalog" className="mt-3 inline-block rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white">
            Explore Stationery Catalog
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {orders.map(o => (
            <div key={o.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Link href={`/order/${o.order_number}`} className="font-bold text-slate-900 hover:text-teal-800 text-sm">
                    #{o.order_number}
                  </Link>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${statusBadges[o.status] || 'bg-slate-100'}`}>
                    {o.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Placed on {new Date(o.placed_at).toLocaleDateString()} • {o.item_count} item{o.item_count > 1 ? 's' : ''} • {o.shipping_method}
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4">
                <span className="font-bold text-sm text-slate-900">{formatZar(o.total_cents)}</span>

                <div className="flex items-center gap-2">
                  {o.invoice_number && (
                    <Link
                      href={`/invoices/${o.invoice_number}`}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                    >
                      <FileText className="h-3.5 w-3.5 text-teal-800" />
                      <span>VAT Invoice</span>
                    </Link>
                  )}

                  <Link
                    href={`/order/${o.order_number}`}
                    className="rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-900 flex items-center gap-1"
                  >
                    <span>View Order</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
