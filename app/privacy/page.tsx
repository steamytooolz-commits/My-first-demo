import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getStoreSettings } from '@/lib/settings';

export default function PrivacyPage() {
  const settings = await getStoreSettings();

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
            <h2 className="font-serif text-base font-bold text-slate-900">3. Information Collected &amp; Lawful Purpose (POPIA Sections 10-13)</h2>
            <p>We process personal information solely for explicit purposes per <strong>Section 13</strong> (collection for specific, explicitly defined, lawful purpose) and the minimality principle <strong>Section 10</strong>:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Order Fulfilment (Contract, Section 11(1)(b)):</strong> Recipient name, physical delivery address, contact details, items purchased — necessary to perform the sale and delivery.</li>
              <li><strong>Statutory Tax Compliance (Legal Obligation, Section 11(1)(c)):</strong> Invoicing records per <strong>VAT Act 89 of 1991</strong> Section 7/10 and <strong>TAA 28 of 2011 Section 29(3)(a)</strong> — retained 5 years from submission of return (Section 32 extends if audit/appeal), kept original form per Section 30.</li>
              <li><strong>Communication (Legitimate Interest/Contract):</strong> Order confirmation, dispatch tracking, inquiries — electronic form per TAA Section 30(1)(b) GN 787 of 2012.</li>
              <li><strong>Marketing — Consent Only (Section 69):</strong> Electronic newsletters only where explicit `marketing_consent` is given, with one-click opt-out (Section 11(1)(a) + Section 69). No marketing without consent.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">4. Data Subject Rights (POPIA Sections 23 &amp; 24)</h2>
            <p>
              Under POPIA, data subjects have the right to request access (Section 23) and correction/deletion or de-identification (Section 24):
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Right of Access &amp; Portability (Section 23):</strong> Export all personal information in machine-readable JSON via <span className="font-mono">/api/account/export</span> and your account dashboard (Section 23(1)(a)-(b)).</li>
              <li><strong>Right to Rectification (Section 24(1)(a)):</strong> Edit contact details, names, and delivery addresses at any time via the profile and address forms. The responsible party must correct inaccurate information as soon as reasonably practicable.</li>
              <li><strong>Right to Deletion / De-identification (Section 24(1)(b) read with Section 14(4)-(5)):</strong> Request permanent account deletion. Personal identifiers are irreversibly anonymized (email → <span className="font-mono">erased-&lt;id&gt;@invalid.local</span>, names/phones scrubbed, password invalidated) so reconstruction is prevented per Section 14(5). Historic VAT invoices are retained but buyer data is redacted, as retention is <strong>required by law</strong> under <strong>POPIA 14(1)(a)</strong> + <strong>TAA 29(3)(a)</strong> (5 years from submission of return; Section 32 extends if audit/appeal notified).</li>
              <li><strong>Grace Period (Demo Simulation):</strong> Erasure is queued for <strong>7 days</strong> (`data_subject_requests.scheduled_for`) to allow support review of disputes — <strong>not a statutory period</strong> under POPIA (which requires de-identification “as soon as reasonably practicable” after no longer authorised). Administrators may trigger immediate erasure if the data subject insists.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-base font-bold text-slate-900">5. Retention &amp; Lawful Basis</h2>
            <p>
              We retain personal information only as long as necessary for order fulfilment and tax compliance (TAA Section 29). Lawful basis per <strong>POPIA Section 11(1)</strong> includes <strong>(a) consent</strong> (marketing, `marketing_consent`) and <strong>(b) contract</strong> (delivery, `poia_processing_consent_at` is collected for transparency but contract is primary). Where retention is required by law (POPIA 14(1)(a) + TAA 29), we de-identify rather than delete.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
