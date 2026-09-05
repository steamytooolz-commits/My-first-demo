import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingBag,
  FileText,
  Tag,
  Users,
  Settings,
  ShieldAlert,
  Archive,
  ArrowLeft,
} from 'lucide-react';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    redirect('/auth/login?redirectTo=/admin');
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      {/* Admin Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 no-print">
        {/* Brand */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2 text-white font-serif font-bold text-lg">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600 text-white text-xs">
              PQ
            </span>
            <span>Admin Center</span>
          </Link>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-4 space-y-1 text-xs font-semibold">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LayoutDashboard className="h-4 w-4 text-teal-400" />
            <span>Dashboard Overview</span>
          </Link>

          <Link
            href="/admin/products"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Package className="h-4 w-4 text-teal-400" />
            <span>Products &amp; Inventory</span>
          </Link>

          <Link
            href="/admin/categories"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Layers className="h-4 w-4 text-teal-400" />
            <span>Categories</span>
          </Link>

          <Link
            href="/admin/orders"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ShoppingBag className="h-4 w-4 text-teal-400" />
            <span>Orders Management</span>
          </Link>

          <Link
            href="/admin/invoices"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <FileText className="h-4 w-4 text-teal-400" />
            <span>Invoices (VAT)</span>
          </Link>

          <Link
            href="/admin/coupons"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Tag className="h-4 w-4 text-teal-400" />
            <span>Coupons &amp; Promos</span>
          </Link>

          <Link
            href="/admin/customers"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Users className="h-4 w-4 text-teal-400" />
            <span>Customers &amp; POPIA</span>
          </Link>

          <Link
            href="/admin/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Settings className="h-4 w-4 text-teal-400" />
            <span>Store Settings</span>
          </Link>

          <Link
            href="/admin/audit"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ShieldAlert className="h-4 w-4 text-teal-400" />
            <span>Audit Trail Logs</span>
          </Link>

          <Link
            href="/admin/backups"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Archive className="h-4 w-4 text-teal-400" />
            <span>Backups &amp; Transfer</span>
          </Link>
        </nav>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-800 text-xs">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Storefront</span>
          </Link>
        </div>
      </aside>

      {/* Main Admin View Container */}
      <main className="flex-1 p-6 sm:p-8 lg:p-10 overflow-y-auto max-w-7xl">
        {children}
      </main>
    </div>
  );
}
