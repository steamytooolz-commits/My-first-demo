import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getStoreSettings } from '@/lib/settings';

export default function PrivacyPage() {
  const settings = getStoreSettings();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-slate-900">Privacy Notice &amp; POPIA Compliance</h1>
          <p className="text-xs text-slate-500 mt-1">Effective Date: 1 September 2026</p>
        </div>

        <div className="prose prose-slate max-w-none text-xs leading-relaxed space-y-6 text-slate-700 bg-white p-8 rounded-2xl border border-slate-200">
          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">1. Commitment to Privacy</h2>
            <p>
              Paper &amp; Quill (Pty) Ltd (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is committed to protecting your personal information in compliance with the South African <strong>Protection of Personal Information Act, 4 of 2013 (&ldquo;POPIA&rdquo;)</strong> and the <strong>Promotion of Access to Information Act, 2 of 2000 (&ldquo;PAIA&rdquo;)</strong>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">2. Responsible Party &amp; Information Officer</h2>
            <p>
              The designated Information Officer for Paper &amp; Quill can be reached at:
            </p>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-[11px]">
              <p>Information Officer: Compliance Desk</p>
              <p>Email: {settings.contact_email}</p>
              {settings.phone ? <p>Phone: {settings.phone}</p> : null}
              <p>Address: {settings.address_line1}, {settings.city}, South Africa</p>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">3. Information Collected &amp; Lawful Purpose</h2>
            <p>We process personal information solely for the following explicit purposes:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Order Fulfilment:</strong> Recipient name, physical delivery address, contact details, and items purchased.</li>
              <li><strong>Statutory Tax Compliance:</strong> Invoicing records pursuant to the South African Value-Added Tax Act, 1991, and Section 29 of the Tax Administration Act, 2011 (retained for 5 years).</li>
              <li><strong>Communication:</strong> Order confirmation, courier dispatch tracking notifications, and customer inquiries.</li>
              <li><strong>Marketing (Optional):</strong> Electronic newsletters where explicit consent has been provided, with one-click opt-out available at all times.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">4. Data Subject Rights</h2>
            <p>
              Under POPIA, all registered users have the right to:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Right of Access &amp; Portability:</strong> Export all personal information in machine-readable JSON format via your account dashboard.</li>
              <li><strong>Right to Rectification:</strong> Edit and update contact details, names, and delivery addresses at any time.</li>
              <li><strong>Right to Object &amp; Erasure (De-Identification):</strong> Request permanent account deletion. When requested, personal identifiers are irreversibly anonymized following a 7-day safety period, while required statutory VAT fiscal records are preserved in accordance with SARS guidelines.</li>
            </ul>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
