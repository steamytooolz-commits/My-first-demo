import Link from 'next/link';
import { ShoppingBag, User, Shield, Search } from 'lucide-react';
import { getSessionUser } from '@/lib/auth';
import { getCartSummary } from '@/lib/cart';
import { getStoreSettings } from '@/lib/settings';
import { formatZar } from '@/lib/money';

export default async function Navbar() {
  const user = await getSessionUser();
  const cart = await getCartSummary();
  const settings = await getStoreSettings();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
      {/* Top utility notification bar */}
      <div className="bg-slate-900 px-4 py-1.5 text-center text-xs font-medium text-slate-200">
        <span>Free standard delivery across South Africa on orders over {formatZar(settings.free_shipping_threshold_cents)} • Safe simulated payments</span>
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link href="/" id="brand-logo" className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 hover:opacity-90">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-800 text-white shadow-sm font-serif">
              PQ
            </span>
            <span className="font-serif text-lg tracking-normal">Paper &amp; Quill</span>
          </Link>

          {/* Main nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/catalog" className="transition-colors hover:text-slate-900">
              All Products
            </Link>
            <Link href="/catalog?category=notebooks-pads" className="transition-colors hover:text-slate-900">
              Notebooks &amp; Pads
            </Link>
            <Link href="/catalog?category=pens-writing" className="transition-colors hover:text-slate-900">
              Pens &amp; Writing
            </Link>
            <Link href="/catalog?category=office-supplies" className="transition-colors hover:text-slate-900">
              Office
            </Link>
          </nav>
        </div>

        {/* Search, Account & Cart */}
        <div className="flex items-center gap-3">
          {/* Quick search input form */}
          <form action="/catalog" method="GET" className="relative hidden sm:block w-48 lg:w-64">
            <input
              type="text"
              name="q"
              placeholder="Search stationery..."
              className="w-full rounded-full border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-700 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-700"
            />
            <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
          </form>

          {/* Admin link if role is admin */}
          {user && user.role === 'admin' && (
            <Link
              href="/admin"
              id="admin-nav-button"
              className="flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Admin</span>
            </Link>
          )}

          {/* User Account / Sign In */}
          {user ? (
            <Link
              href="/account"
              id="account-nav-button"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <User className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline max-w-[100px] truncate">{user.full_name || 'My Account'}</span>
            </Link>
          ) : (
            <Link
              href="/auth/login"
              id="login-nav-button"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <User className="h-3.5 w-3.5 text-slate-500" />
              <span>Sign In</span>
            </Link>
          )}

          {/* Cart button with live count */}
          <Link
            href="/cart"
            id="cart-nav-button"
            className="relative flex items-center justify-center rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-900 transition-colors"
          >
            <ShoppingBag className="h-4 w-4 mr-1.5" />
            <span>Cart</span>
            {cart.itemCount > 0 && (
              <span className="ml-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-teal-900">
                {cart.itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
