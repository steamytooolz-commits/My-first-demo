import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getStoreSettings } from '@/lib/settings';

export default function TermsPage() {
  const settings = getStoreSettings();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-slate-900">Terms of Service</h1>
          <p className="text-xs text-slate-500 mt-1">Paper &amp; Quill (Pty) Ltd • Governed by South African Law</p>
        </div>

        <div className="prose prose-slate max-w-none text-xs leading-relaxed space-y-6 text-slate-700 bg-white p-8 rounded-2xl border border-slate-200">
          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">1. Introduction &amp; Applicability</h2>
            <p>
              These Terms and Conditions govern the purchase of stationery goods from the Paper &amp; Quill online store. By placing an order, you agree to be bound by these provisions, in accordance with the <strong>Electronic Communications and Transactions Act, 25 of 2002 (ECTA)</strong> and the <strong>Consumer Protection Act, 68 of 2008 (CPA)</strong>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">2. Pricing &amp; Value-Added Tax (VAT)</h2>
            <p>
              All prices are in <strong>South African Rand (ZAR)</strong> and include <strong>15% VAT</strong> per <strong>VAT Act 89 of 1991, Section 7(1)</strong> (standard rate, SARS). VAT-inclusive pricing is required by <strong>Section 64 (prices deemed to include tax)</strong> and <strong>Section 65 (advertised prices to include VAT)</strong>. Where VAT is not separately stated, the tax fraction <strong>15/115</strong> applies per <strong>Section 10(2)</strong> — i.e., <span className="font-mono">VAT = round(total × 15/115)</span> (SARS 2025 FAQs confirm 15/115 for 15%, 15.5/115.5 for 15.5%). The prior 14% rate ended 31 March 2018; the 2025 proposal to increase to 15.5%/16% was withdrawn. Registered VAT number: {settings.vat_number || '— (not VAT-registered in demo, Zero-rated for simulation)'}.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">3. Disclosure &amp; Cooling-Off (ECT Act 25 of 2002, CPA 68 of 2008)</h2>
            <p>
              This is an <strong>electronic transaction</strong> per <strong>ECT Act, Chapter VII</strong>. Per <strong>Section 43</strong>, we make available on this website: (a) full name/legal status, (b) physical address/phone, (c) website/email, (f) registration details, (h) description of goods, (i) <strong>full price including delivery/taxes/fees</strong>, (j) payment manner, (k) terms/guarantees, (l) delivery time, (m) record access, (n) return/refund policy, (o) ADR code, (p) security/privacy policy, and (r) Section 44 rights — plus opportunity to <strong>review/correct/withdraw before ordering</strong> (43(2)). Failure to comply allows cancellation within <strong>14 days</strong> (43(3)).
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
              This site is a portfolio demonstration. Product availability, banking details (Standard Bank, Branch 051001 is illustrative), and courier dispatch are simulated. For production use, consult a South African attorney. Not legal advice.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
