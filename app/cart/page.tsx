import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CartClient from '@/components/CartClient';
import { getCartSummary } from '@/lib/cart';

export default async function CartPage() {
  const cart = await getCartSummary();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="border-b border-slate-200 pb-4">
          <h1 className="font-serif text-3xl font-bold text-slate-900">Your Cart</h1>
          <p className="text-xs text-slate-500 mt-1">Review your stationery selections before checkout.</p>
        </div>

        <CartClient initialCart={cart} />
      </main>

      <Footer />
    </div>
  );
}
