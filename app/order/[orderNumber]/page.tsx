import { notFound } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import OrderRetryClient from '@/components/OrderRetryClient';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getStoreSettings } from '@/lib/settings';
import { formatZar } from '@/lib/money';
import { CheckCircle2, Clock, Truck, FileText, ArrowLeft, Landmark, AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface OrderPageProps {
  params: Promise<{ orderNumber: string }>;
}

export default async function OrderDetailPage({ params }: OrderPageProps) {
  const { orderNumber } = await params;
  const user = await getSessionUser();
  const settings = getStoreSettings();

  const order = db.prepare(`
    SELECT * FROM orders WHERE order_number = ?
  `).get(orderNumber) as any;

  if (!order) {
    notFound();
  }

  // Security: only customer who placed it or admin can view
  if (!user || (user.id !== order.user_id && user.role !== 'admin')) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Navbar />
        <main className="mx-auto max-w-lg flex-1 px-4 py-16 text-center space-y-4">
          <h2 className="font-serif text-2xl font-bold text-slate-900">Access Restricted</h2>
          <p className="text-xs text-slate-500">Please sign in with the account used to place this order.</p>
          <Link href={`/auth/login?redirectTo=/order/${orderNumber}`} className="inline-block rounded-xl bg-teal-800 px-4 py-2.5 text-xs font-semibold text-white">
            Sign In
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const items = db.prepare(`
    SELECT * FROM order_items WHERE order_id = ? ORDER BY rowid ASC
  `).all(order.id) as any[];

  const invoice = db.prepare(`
    SELECT invoice_number, status, total_cents FROM invoices WHERE order_id = ?
  `).get(order.id) as any;

  const events = db.prepare(`
    SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at DESC
  `).all(order.id) as any[];

  const shippingAddr = JSON.parse(order.shipping_address_json || '{}');

  const statusColors: Record<string, string> = {
    paid: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    pending_payment: 'bg-amber-100 text-amber-900 border-amber-300',
    processing: 'bg-sky-100 text-sky-900 border-sky-300',
    shipped: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    delivered: 'bg-teal-100 text-teal-900 border-teal-300',
    cancelled: 'bg-rose-100 text-rose-900 border-rose-300',
    refunded: 'bg-slate-200 text-slate-800 border-slate-300',
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Header navigation & status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <Link href="/account/orders" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 mb-2">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to all orders</span>
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-3xl font-bold text-slate-900">
                Order #{order.order_number}
              </h1>
              <span className={`rounded-full px-3 py-1 text-xs font-bold border ${statusColors[order.status] || 'bg-slate-100 text-slate-800'}`}>
                {order.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Placed on {new Date(order.placed_at).toLocaleString()}</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {invoice && (
              <Link
                href={`/invoices/${invoice.invoice_number}`}
                id="view-vat-invoice-button"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
              >
                <FileText className="h-4 w-4 text-teal-800" />
                <span>View VAT Invoice</span>
              </Link>
            )}
          </div>
        </div>

        {/* Retry Payment Simulation Panel (if pending) */}
        {order.status === 'pending_payment' && (
          <OrderRetryClient orderId={order.id} />
        )}

        {/* Manual EFT instructions notice (if payment_method === 'manual_eft' and pending) */}
        {order.payment_method === 'manual_eft' && order.status === 'pending_payment' && (
          <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-5 text-xs space-y-2 text-teal-950">
            <div className="flex items-center gap-2 font-bold text-teal-900 text-sm">
              <Landmark className="h-4 w-4" />
              <span>Manual EFT Payment Instructions</span>
            </div>
            <p>Please make your electronic funds transfer using the following banking details:</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[11px] bg-white p-3 rounded-lg border border-teal-100">
              <div><span className="text-slate-400 block">Bank</span><strong>{settings.bank_name}</strong></div>
              <div><span className="text-slate-400 block">Account</span><strong>{settings.bank_account_number}</strong></div>
              <div><span className="text-slate-400 block">Branch</span><strong>{settings.bank_branch_code}</strong></div>
              <div><span className="text-slate-400 block">Reference</span><strong className="text-teal-800">{order.order_number}</strong></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Order Items & Timeline */}
          <div className="lg:col-span-8 space-y-6">
            {/* Line Items */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="font-serif text-lg font-bold text-slate-900 pb-3 border-b border-slate-100">
                Purchased Stationery Items
              </h3>

              <div className="divide-y divide-slate-100">
                {items.map(item => {
                  let snapshot: { name?: string; sku?: string } = {};
                  try {
                    snapshot = JSON.parse(item.variant_snapshot_json || '{}');
                  } catch {
                    snapshot = {};
                  }
                  return (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{snapshot.name || 'Stationery Item'}</h4>
                        {snapshot.sku && <p className="text-[10px] font-mono text-slate-400">SKU: {snapshot.sku}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-900">{formatZar(item.line_total_cents)}</p>
                        <p className="text-[11px] text-slate-500">{item.qty} × {formatZar(item.unit_price_cents)}</p>
                        {item.line_discount_cents > 0 && (
                          <p className="text-[10px] text-emerald-700">Disc: -{formatZar(item.line_discount_cents)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Timeline Events */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h3 className="font-serif text-lg font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
                <Clock className="h-4 w-4 text-teal-800" />
                <span>Order Timeline</span>
              </h3>

              <div className="space-y-3">
                {events.map(ev => (
                  <div key={ev.id} className="flex items-start gap-3 text-xs">
                    <div className="mt-1 h-2 w-2 rounded-full bg-teal-800 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-900 capitalize">
                        {ev.type.replace('_', ' ')}
                      </p>
                      {ev.note && <p className="text-slate-600 mt-0.5">{ev.note}</p>}
                      <p className="text-[10px] text-slate-400 mt-0.5">{new Date(ev.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Summary & Addresses Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Financial Summary */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 text-xs">
              <h3 className="font-serif text-base font-bold text-slate-900 pb-2 border-b border-slate-100">
                Payment Summary
              </h3>

              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">{formatZar(order.subtotal_cents)}</span>
              </div>

              {order.discount_cents > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Discount ({order.coupon_code || 'Coupon'})</span>
                  <span>-{formatZar(order.discount_cents)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>Shipping ({order.shipping_method})</span>
                <span className="font-semibold text-slate-900">
                  {order.shipping_cents === 0 ? 'FREE' : formatZar(order.shipping_cents)}
                </span>
              </div>

              {order.tax_cents > 0 && (
                <div className="flex justify-between text-slate-500 text-[11px]">
                  <span>Includes 15% VAT</span>
                  <span>{formatZar(order.tax_cents)}</span>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                <span>Total Amount</span>
                <span className="text-base text-teal-900">{formatZar(order.total_cents)}</span>
              </div>
            </div>

            {/* Delivery Information */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 text-xs">
              <h3 className="font-serif text-base font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Truck className="h-4 w-4 text-teal-800" />
                <span>Delivery Address</span>
              </h3>

              <div className="text-slate-700 space-y-0.5">
                <p className="font-bold text-slate-900">{shippingAddr.full_name}</p>
                <p>{shippingAddr.line1}</p>
                {shippingAddr.line2 && <p>{shippingAddr.line2}</p>}
                <p>{shippingAddr.city}, {shippingAddr.province} {shippingAddr.postal_code}</p>
                {shippingAddr.phone ? <p className="text-slate-500 pt-1">Phone: {shippingAddr.phone}</p> : null}
              </div>

              {order.customer_note && (
                <div className="pt-2 border-t border-slate-100">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">Order Note</p>
                  <p className="text-slate-600 italic mt-0.5">&ldquo;{order.customer_note}&rdquo;</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
