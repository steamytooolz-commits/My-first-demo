import Link from 'next/link';
import { redirect } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getSessionUser } from '@/lib/auth';
import { logoutAction } from '@/app/actions/auth';
import { Package, MapPin, Shield, Lock, User, LogOut } from 'lucide-react';

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/auth/login?redirectTo=/account');
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 w-full">
        <div className="mb-6 border-b border-slate-200 pb-4">
          <h1 className="font-serif text-3xl font-bold text-slate-900">My Account</h1>
          <p className="text-xs text-slate-500 mt-1">
            Signed in as <strong className="text-slate-800">{user.email}</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Sidebar */}
          <aside className="lg:col-span-3">
            <nav className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-1 text-xs font-semibold">
              <Link
                href="/account"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <User className="h-4 w-4 text-teal-800" />
                <span>Account Overview</span>
              </Link>

              <Link
                href="/account/orders"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <Package className="h-4 w-4 text-teal-800" />
                <span>Orders &amp; Invoices</span>
              </Link>

              <Link
                href="/account/addresses"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <MapPin className="h-4 w-4 text-teal-800" />
                <span>Saved Addresses</span>
              </Link>

              <Link
                href="/account/privacy"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <Shield className="h-4 w-4 text-teal-800" />
                <span>POPIA Data &amp; Privacy</span>
              </Link>

              <Link
                href="/account/security"
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
              >
                <Lock className="h-4 w-4 text-teal-800" />
                <span>Security &amp; Password</span>
              </Link>

              <div className="pt-2 border-t border-slate-100">
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-rose-600 hover:bg-rose-50 transition-colors text-left"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </form>
              </div>
            </nav>
          </aside>

          {/* Account Sub-page Content */}
          <section className="lg:col-span-9">
            {children}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
