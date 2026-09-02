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
              All prices displayed on this website are denominated in South African Rand (ZAR) and include 15% Value-Added Tax (VAT) where applicable. Registered VAT number: {settings.vat_number}.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">3. Electronic Funds Transfer (EFT) Payment Terms</h2>
            <p>
              For orders placed using the manual EFT payment method, payment is due within {settings.invoice_due_days} calendar days from order placement. Please quote your unique Order Number or Tax Invoice Number as the reference on your banking transfer.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
