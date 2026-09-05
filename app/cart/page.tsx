import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CartClient from '@/components/CartClient';
import { getCartSummary } from '@/lib/cart';
import { getStoreSettings } from '@/lib/settings';

export default async function CartPage() {
  const cart = await getCartSummary();
  const settings = await getStoreSettings();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="border-b border-slate-200 pb-4">
          <h1 className="font-serif text-3xl font-bold text-slate-900">Your Cart</h1>
          <p className="text-xs text-slate-500 mt-1">Review your stationery selections before checkout.</p>
        </div>

        <CartClient
          initialCart={cart}
          settings={{
            free_shipping_threshold_cents: settings.free_shipping_threshold_cents,
            standard_base_cents: settings.standard_base_cents,
            express_base_cents: settings.express_base_cents,
          }}
        />
      </main>

      <Footer />
    </div>
  );
}
