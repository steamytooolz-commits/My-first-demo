import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getStoreSettings } from '@/lib/settings';
import { formatZar } from '@/lib/money';

export default function ShippingPage() {
  const settings = getStoreSettings();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-slate-900">Delivery &amp; Returns Policy</h1>
          <p className="text-xs text-slate-500 mt-1">Reliable nationwide courier delivery across all nine South African provinces.</p>
        </div>

        <div className="prose prose-slate max-w-none text-xs leading-relaxed space-y-6 text-slate-700 bg-white p-8 rounded-2xl border border-slate-200">
          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">1. Delivery Rates &amp; Free Shipping</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 not-prose my-4">
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                <p className="font-bold text-slate-900 text-sm">Standard Delivery</p>
                <p className="text-teal-900 font-bold text-lg">{formatZar(settings.standard_base_cents)}</p>
                <p className="text-slate-500 text-[11px] mt-1">2–4 business days via registered courier.</p>
              </div>

              <div className="rounded-xl border border-teal-200 p-4 bg-teal-50/70">
                <p className="font-bold text-teal-950 text-sm">Free Delivery Threshold</p>
                <p className="text-teal-900 font-bold text-lg">{formatZar(settings.free_shipping_threshold_cents)}+</p>
                <p className="text-teal-800 text-[11px] mt-1">Automatically applied at checkout on qualifying orders.</p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                <p className="font-bold text-slate-900 text-sm">Express Courier</p>
                <p className="text-teal-900 font-bold text-lg">{formatZar(settings.express_base_cents)}</p>
                <p className="text-slate-500 text-[11px] mt-1">1–2 business days dispatch priority.</p>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">2. Coverage Areas</h2>
            <p>
              We deliver to street addresses and business offices across Gauteng, Western Cape, KwaZulu-Natal, Eastern Cape, Free State, Mpumalanga, Limpopo, North West, and Northern Cape.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">3. 30-Day Stationery Return Guarantee</h2>
            <p>
              If your stationery arrives damaged, defective, or does not meet expectations, return it within 30 days in its original packaging for an immediate replacement or full refund.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
