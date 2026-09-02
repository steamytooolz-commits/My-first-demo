import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-lg flex-1 px-4 py-24 text-center">
        <h1 className="font-serif text-5xl font-bold text-slate-900">404</h1>
        <h2 className="mt-3 text-lg font-bold text-slate-800">Page or Product Not Found</h2>
        <p className="mt-2 text-xs text-slate-500">
          The page you requested could not be located, or the stationery item is no longer in stock.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-xl bg-teal-800 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-900 transition-colors"
          >
            Return to Store
          </Link>
          <Link
            href="/catalog"
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Browse Catalog
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
