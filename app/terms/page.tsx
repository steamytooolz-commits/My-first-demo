import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getStoreSettings } from '@/lib/settings';

export default async function TermsPage() {
  const settings = await getStoreSettings();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-slate-900">Terms of Service</h1>
          <p className="text-xs text-slate-500 mt-1">{settings.store_name} • Governed by South African Law</p>
        </div>

        <div className="prose prose-slate max-w-none text-xs leading-relaxed space-y-6 text-slate-700 bg-white p-8 rounded-2xl border border-slate-200">
          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">1. Introduction &amp; Applicability</h2>
            <p>
              These Terms and Conditions govern the purchase of stationery goods from the {settings.store_name} online store. By placing an order, you agree to be bound by these provisions, in accordance with the <strong>Electronic Communications and Transactions Act, 25 of 2002 (ECTA)</strong> and the <strong>Consumer Protection Act, 68 of 2008 (CPA)</strong>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">2. Pricing &amp; Value-Added Tax (VAT)</h2>
            <p>
              All prices are in <strong>South African Rand (ZAR)</strong>. {settings.tax_enabled && settings.vat_number ? (
                <>Prices include <strong>{settings.tax_rate_percent}% VAT</strong> per <strong>VAT Act 89 of 1991, Section 7(1)</strong> (standard rate, SARS). VAT-inclusive pricing follows <strong>Sections 64–65</strong>; where VAT is not separately stated the tax fraction applies per <strong>Section 10(2)</strong> — i.e., <span className="font-mono">VAT = round(total × {settings.tax_rate_percent}/{100 + settings.tax_rate_percent})</span>. Registered VAT number: {settings.vat_number}.</>
              ) : (
                <>This demo store is currently <strong>not VAT-registered and charges no VAT</strong> — displayed prices are VAT-exclusive and invoices are issued as standard invoices, not tax invoices. When VAT registration is enabled, prices will include VAT per <strong>VAT Act 89 of 1991, Sections 7, 10(2), 64–65</strong> and the registered VAT number will appear here and on every invoice.</>
              )}
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">3. Disclosure &amp; Cooling-Off (ECT Act 25 of 2002, CPA 68 of 2008)</h2>
            <p>
              This is an <strong>electronic transaction</strong> per <strong>ECT Act, Chapter VII</strong>. Per <strong>Section 43(1)</strong>, this website publishes: (a) full name/legal status, (b) physical address and contact details, (c) website/email address, (h) description of goods, (i) <strong>full price including delivery/taxes/fees</strong>, (j) manner of payment, (k) terms of agreement, (l) time for delivery, (n) return and refund policy, (p) security and privacy policy, and (r) Section 44 rights — plus the opportunity to <strong>review the full order and correct errors before placing it</strong> (43(2)). Registration number, office-bearer and ADR details are available on request from {settings.contact_email}. Failure to comply allows cancellation within <strong>14 days</strong> (43(3)).
            </p>
            <p>
              <strong>Cooling-off — ECT Section 44 (not CPA 16):</strong> You may cancel <strong>without reason/penalty</strong> any electronic transaction for <strong>goods within 7 days after receipt</strong> or <strong>services within 7 days after conclusion</strong> (44(1)), with only direct return cost charged (44(2)), refund within <strong>30 days</strong> (44(3)). <strong>CPA Section 16</strong> (5 business days for direct marketing) <strong>does not apply</strong> when ECT 44 applies per CPA 16(1). Our voluntary <strong>30-day</strong> return guarantee (see Delivery &amp; Returns) exceeds the statutory 7 days.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">4. Electronic Funds Transfer (EFT) Payment Terms (Simulation)</h2>
            <p>
              For manual EFT (simulation, no real account verified), payment is due within {settings.invoice_due_days} days. Quote Order Number / Invoice Number as reference. This store uses <strong>simulated payments only</strong> — no PayFast/Stripe, no real card capture (see Assumptions).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">5. Limitation &amp; Demo Disclaimer</h2>
            <p className="text-[11px] italic">
              This site is a portfolio demonstration. Product availability and courier dispatch are simulated, and the banking details shown at checkout and on invoices are simulated demo details — no real account is verified and no real payment is captured. For production use, consult a South African attorney. Not legal advice.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
