import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getStoreSettings } from '@/lib/settings';
import { formatZar } from '@/lib/money';

export default function ShippingPage() {
  const settings = await getStoreSettings();

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
            <h2 className="font-serif text-base font-bold text-slate-900">3. Returns, Cooling-Off &amp; Statutory Rights</h2>
            <p>
              <strong>Statutory cooling-off — ECT Act 25 of 2002, Section 44:</strong> For electronic transactions, you may <strong>cancel without reason/penalty within 7 days after receipt of goods</strong> (or 7 days after conclusion for services). Only direct return cost may be charged (44(2)), refund within 30 days (44(3)). This does <strong>not</strong> apply to goods personalised, perishable, or made to your specifications (44(2)(f)). <strong>CPA 68 of 2008, Section 16</strong> (5 business days for direct marketing) does <strong>not</strong> apply when ECT 44 applies (CPA 16(1)).
            </p>
            <p>
              <strong>Failure to disclose (ECT 43(3)):</strong> If we failed to provide Section 43 information (price, delivery, return policy, etc.), you may cancel within <strong>14 days</strong> of receipt.
            </p>
            <p>
              <strong>Voluntary 30-Day Guarantee (More Generous):</strong> Beyond the statutory 7 days, if stationery arrives damaged, defective, or not as described, return it <strong>within 30 days in original packaging</strong> for immediate replacement or full refund. This exceeds ECT requirements and is offered at our discretion for demo purposes. For CPA Section 20/56 rights (unsafe/defective goods), statutory rights apply regardless.
            </p>
            <p className="text-[10px] italic text-slate-500">
              Demo simulation — no real courier is dispatched. Returns are simulated via admin order status `cancelled`/`refunded` with stock restoration and invoice `void`/`refunded`.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
