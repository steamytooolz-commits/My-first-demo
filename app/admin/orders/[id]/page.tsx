import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { formatZar } from '@/lib/money';
import { adminUpdateOrderStatusAction } from '@/app/actions/admin';
import { ArrowLeft, FileText, CheckCircle, Truck, XCircle, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface AdminOrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminOrderDetailPage({ params }: AdminOrderDetailPageProps) {
  const { id } = await params;

  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!order) {
    notFound();
  }

  const items = await db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid ASC').all(id) as any[];
  const invoice = await db.prepare('SELECT * FROM invoices WHERE order_id = ?').get(id) as any;
  const events = await db.prepare('SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at DESC').all(id) as any[];

  const shippingAddr = JSON.parse(order.shipping_address_json || '{}');

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center gap-2">
        <Link href="/admin/orders" className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to orders</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-3xl font-bold text-slate-900">Order #{order.order_number}</h1>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white uppercase tracking-wider">
              {order.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Placed {new Date(order.placed_at).toLocaleString()} by {order.email}</p>
        </div>

        {invoice && (
          <Link
            href={`/invoices/${invoice.invoice_number}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <FileText className="h-4 w-4 text-teal-800" />
            <span>View Tax Invoice ({invoice.invoice_number})</span>
          </Link>
        )}
      </div>

      {/* Admin Status Transition Panel */}
      <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-6 shadow-sm space-y-4">
        <h2 className="font-serif text-base font-bold text-teal-950">Update Order Lifecycle Status</h2>
        <p className="text-xs text-teal-900">
          Updating status triggers timestamped order event logs and inventory reconciliations (such as stock restoration on cancellation).
        </p>

        <form action={async (formData: FormData) => {
          'use server';
          const newStatus = formData.get('status') as string;
          const note = (formData.get('note') as string) || '';
          await adminUpdateOrderStatusAction(order.id, newStatus, note);
        }} className="flex flex-wrap items-end gap-3 text-xs">
          <input type="hidden" name="orderId" value={order.id} />

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Target Status</label>
            <select
              name="status"
              defaultValue={order.status}
              className="rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
            >
              <option value="pending_payment">Pending Payment</option>
              <option value="paid">Paid (Funds Verified)</option>
              <option value="processing">Processing (Packing Stationery)</option>
              <option value="shipped">Shipped (In Transit)</option>
              <option value="delivered">Delivered (Completed)</option>
              <option value="cancelled">Cancelled (Restore Stock)</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block font-semibold text-slate-700 mb-1">Audit Log Note / Tracking Info</label>
            <input
              name="note"
              placeholder="e.g. Courier Guy tracking: CG-99281928"
              className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:border-teal-700 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white hover:bg-teal-900 transition-colors"
          >
            Apply Status Update
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Items & Events */}
        <div className="lg:col-span-8 space-y-6">
          {/* Purchased Items */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="font-serif text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
              Purchased Stationery Items
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              {items.map(item => {
                let snapshot: { name?: string; sku?: string } = {};
                try {
                  snapshot = JSON.parse(item.variant_snapshot_json || '{}');
                } catch {
                  snapshot = {};
                }
                return (
                  <div key={item.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900">{snapshot.name || 'Stationery Item'}</p>
                      {snapshot.sku && <p className="text-[10px] font-mono text-slate-400">SKU: {snapshot.sku}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{formatZar(item.line_total_cents)}</p>
                      <p className="text-slate-500 text-[11px]">{item.qty} × {formatZar(item.unit_price_cents)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Audit Trail Timeline */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="font-serif text-base font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Clock className="h-4 w-4 text-teal-800" />
              <span>Order Event Timeline</span>
            </h3>
            <div className="space-y-3">
              {events.map(e => (
                <div key={e.id} className="text-xs border-l-2 border-teal-800 pl-3 py-0.5 space-y-0.5">
                  <p className="font-bold text-slate-900 uppercase text-[11px]">{e.type.replace('_', ' ')}</p>
                  {e.note && <p className="text-slate-600">{e.note}</p>}
                  <p className="text-[10px] text-slate-400">{new Date(e.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Delivery & Totals */}
        <div className="lg:col-span-4 space-y-6">
          {/* Order Financials */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 text-xs">
            <h3 className="font-serif text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
              Payment Breakdown
            </h3>
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900">{formatZar(order.subtotal_cents)}</span>
            </div>
            {order.discount_cents > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Discount</span>
                <span>-{formatZar(order.discount_cents)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Shipping</span>
              <span className="font-semibold text-slate-900">
                {order.shipping_cents === 0 ? 'FREE' : formatZar(order.shipping_cents)}
              </span>
            </div>
            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>VAT (15%)</span>
              <span>{formatZar(order.tax_cents)}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
              <span>Total</span>
              <span className="text-base text-teal-900">{formatZar(order.total_cents)}</span>
            </div>
          </div>

          {/* Delivery Snapshot */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 text-xs">
            <h3 className="font-serif text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
              Delivery Destination
            </h3>
            <p className="font-bold text-slate-900">{shippingAddr.full_name}</p>
            <p className="text-slate-600">{shippingAddr.line1}</p>
            {shippingAddr.line2 && <p className="text-slate-600">{shippingAddr.line2}</p>}
            <p className="text-slate-600">{shippingAddr.city}, {shippingAddr.province} {shippingAddr.postal_code}</p>
            {shippingAddr.phone ? <p className="text-slate-500 pt-1">Phone: {shippingAddr.phone}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
