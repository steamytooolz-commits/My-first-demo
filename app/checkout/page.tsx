import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CheckoutClient from '@/components/CheckoutClient';
import { getSessionUser } from '@/lib/auth';
import { getCartSummary } from '@/lib/cart';
import { getStoreSettings } from '@/lib/settings';
import { db } from '@/lib/db';

export default async function CheckoutPage() {
  const user = await getSessionUser();
  const cart = await getCartSummary();
  const settings = await getStoreSettings();

  let savedAddresses: any[] = [];
  if (user) {
    savedAddresses = await db.prepare(`
      SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, rowid DESC
    `).all(user.id);
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="border-b border-slate-200 pb-4">
          <h1 className="font-serif text-3xl font-bold text-slate-900">Checkout</h1>
          <p className="text-xs text-slate-500 mt-1">Complete your delivery details and payment simulation.</p>
        </div>

        <CheckoutClient
          user={user}
          savedAddresses={savedAddresses}
          cart={cart}
          settings={{
            free_shipping_enabled: settings.free_shipping_enabled,
            free_shipping_threshold_cents: settings.free_shipping_threshold_cents,
            standard_base_cents: settings.standard_base_cents,
            express_base_cents: settings.express_base_cents,
            weight_threshold_g: settings.weight_threshold_g,
            weight_surcharge_cents: settings.weight_surcharge_cents,
            express_weight_surcharge_cents: settings.express_weight_surcharge_cents,
            tax_enabled: settings.tax_enabled,
            tax_rate_percent: settings.tax_rate_percent,
          }}
          bankDetails={{
            bank_name: settings.bank_name,
            bank_account_name: settings.bank_account_name,
            bank_account_number: settings.bank_account_number,
            bank_branch_code: settings.bank_branch_code,
            bank_reference_note: settings.bank_reference_note,
          }}
        />
      </main>

      <Footer />
    </div>
  );
}
