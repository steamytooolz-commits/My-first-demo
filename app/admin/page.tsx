import Link from 'next/link';
import { db, isTurso } from '@/lib/db';
import { formatZar } from '@/lib/money';
import { requireAdmin } from '@/lib/auth';
import {
  DollarSign,
  ShoppingBag,
  Clock,
  AlertTriangle,
  ArrowRight,
  Download,
  Plus,
  FileSpreadsheet,
  Landmark,
  FileText,
} from 'lucide-react';

export default async function AdminDashboardPage() {
  await requireAdmin();

  // Financial metrics
  const revenueStats = await db.prepare(`
    SELECT COALESCE(SUM(total_cents), 0) as total_revenue, COUNT(*) as total_orders
    FROM orders
    WHERE status != 'cancelled'
  `).get() as any;

  const pendingOrdersCount = (await db.prepare(`
    SELECT COUNT(*) as count FROM orders WHERE status = 'pending_payment'
  `).get() as any).count;

  const lowStockVariants = await db.prepare(`
    SELECT pv.id, pv.sku, pv.name, pv.stock_qty, pv.low_stock_threshold, p.name as product_name
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    WHERE pv.active = 1 AND pv.stock_qty <= pv.low_stock_threshold
    ORDER BY pv.stock_qty ASC
    LIMIT 10
  `).all() as any[];

  const recentOrders = await db.prepare(`
    SELECT o.*, (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
    FROM orders o
    ORDER BY o.placed_at DESC
    LIMIT 6
  `).all() as any[];

  return (
    <div className="space-y-8">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">Real-time stationery store metrics and operations summary.</p>
          <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${isTurso ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isTurso ? 'bg-emerald-600' : 'bg-amber-600'}`} />
            {isTurso ? 'Database: Turso shared (persistent)' : 'Database: ephemeral /tmp — connect Turso for persistence'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-800 px-3.5 py-2 text-xs font-semibold text-white shadow hover:bg-teal-900 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </Link>
          <a
            href="/api/admin/export/orders"
            download
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Export Orders CSV</span>
          </a>
          <form action={async () => {
            'use server';
            const { adminRunMaintenanceAction } = await import('@/app/actions/admin');
            await adminRunMaintenanceAction();
          }}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-sm hover:bg-amber-100 transition-colors"
            >
              <span>Run Maintenance</span>
            </button>
          </form>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Gross Revenue</span>
            <DollarSign className="h-4 w-4 text-teal-700" />
          </div>
          <p className="text-2xl font-serif font-bold text-slate-900">{formatZar(revenueStats.total_revenue)}</p>
          <p className="text-[11px] text-slate-400">Total non-cancelled sales</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Orders</span>
            <ShoppingBag className="h-4 w-4 text-teal-700" />
          </div>
          <p className="text-2xl font-serif font-bold text-slate-900">{revenueStats.total_orders}</p>
          <p className="text-[11px] text-slate-400">All customer orders placed</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Orders</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-serif font-bold text-amber-800">{pendingOrdersCount}</p>
          <p className="text-[11px] text-slate-400">Awaiting payment verification</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Low Stock Items</span>
            <AlertTriangle className="h-4 w-4 text-rose-600" />
          </div>
          <p className="text-2xl font-serif font-bold text-rose-700">{lowStockVariants.length}</p>
          <p className="text-[11px] text-slate-400">At or below threshold</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Save time: 3 money flows (client pitch panel) */}
        <div className="lg:col-span-12 rounded-xl border border-teal-200 bg-teal-50/60 p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4">
            <div>
              <h2 className="font-serif text-lg font-bold text-slate-900">Save time: 3 money flows</h2>
              <p className="text-xs text-slate-600 mt-0.5">The three admin jobs that win back hours every week — one click each.</p>
            </div>
            <span className="text-[11px] font-semibold text-teal-800">Live demo script: import → verify → export</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl border border-teal-200 bg-white p-4 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <FileSpreadsheet className="h-4 w-4 text-teal-800" />
                <span>1. Load catalogue in bulk</span>
              </div>
              <p className="text-slate-600">Drop a supplier price list, confirm columns, import up to 2,000 rows. Re-imports update, never duplicate.</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link href="/admin/products/import" className="rounded-lg bg-teal-800 px-3 py-1.5 font-semibold text-white hover:bg-teal-900">Import CSV</Link>
                <Link href="/admin/products/new" className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">Single create</Link>
              </div>
            </div>
            <div className="rounded-xl border border-teal-200 bg-white p-4 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Landmark className="h-4 w-4 text-teal-800" />
                <span>2. Verify EFT, clear pending</span>
              </div>
              <p className="text-slate-600">{pendingOrdersCount} order{pendingOrdersCount === 1 ? '' : 's'} awaiting payment. Open, confirm funds, mark paid — invoice flips to paid automatically.</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link href="/admin/orders" className="rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-800">Review {pendingOrdersCount} pending</Link>
              </div>
            </div>
            <div className="rounded-xl border border-teal-200 bg-white p-4 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <FileText className="h-4 w-4 text-teal-800" />
                <span>3. Hand accountant clean books</span>
              </div>
              <p className="text-slate-600">SARS-ready VAT totals plus one-click CSVs. No retyping, no month-end scramble.</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a href="/api/admin/export/orders" download className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">Orders CSV</a>
                <a href="/api/admin/export/invoices" download className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">Invoices CSV</a>
                <a href="/api/admin/export/customers" download className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50">Customers CSV</a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Recent Orders List */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="font-serif text-lg font-bold text-slate-900">Recent Customer Orders</h2>
            <Link href="/admin/orders" className="text-xs font-semibold text-teal-800 hover:text-teal-900 flex items-center gap-1">
              <span>View all orders</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentOrders.map(o => (
              <div key={o.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <Link href={`/admin/orders/${o.id}`} className="font-bold text-slate-900 hover:text-teal-800">
                    #{o.order_number}
                  </Link>
                  <p className="text-[11px] text-slate-500">
                    {o.email} • {new Date(o.placed_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                    {o.status.replace('_', ' ')}
                  </span>
                  <span className="font-bold text-slate-900">{formatZar(o.total_cents)}</span>
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                  >
                    Manage
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="font-serif text-lg font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>Stock Alerts</span>
            </h2>
            <Link href="/admin/products" className="text-xs font-semibold text-teal-800 hover:underline">
              Inventory
            </Link>
          </div>

          {lowStockVariants.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">All inventory is currently above minimum stock thresholds.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {lowStockVariants.map(v => (
                <div key={v.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-900 truncate max-w-[160px]">{v.product_name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{v.sku} ({v.name})</p>
                  </div>
                  <span className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${v.stock_qty === 0 ? 'bg-rose-100 text-rose-900' : 'bg-amber-100 text-amber-900'}`}>
                    {v.stock_qty} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
