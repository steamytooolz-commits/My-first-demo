import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { requestErasureAction } from '@/app/actions/privacy';
import { ShieldCheck, Download, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';

export default async function CustomerPrivacyPage() {
  const user = await requireUser();

  const pendingErasure = await db.prepare(`
    SELECT * FROM data_subject_requests
    WHERE user_id = ? AND type = 'erasure' AND status = 'pending'
    ORDER BY created_at DESC LIMIT 1
  `).get(user.id) as any;

  return (
    <div className="space-y-6">
      {/* Information Box */}
      <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2 font-bold text-teal-950 text-base font-serif">
          <ShieldCheck className="h-5 w-5 text-teal-800" />
          <span>Your Privacy Rights under POPIA</span>
        </div>
        <p className="text-xs text-teal-900 leading-relaxed">
          In accordance with the South African <strong>Protection of Personal Information Act, 4 of 2013 (POPIA)</strong>, you have full authority to inspect, export, or request the permanent erasure of your personal data.
        </p>
      </div>

      {/* Right to Access / Data Portability */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-serif text-base font-bold text-slate-900">Right to Access (Data Portability)</h3>
          <p className="text-xs text-slate-500 mt-1">
            Download a complete machine-readable archive containing your user profile, saved addresses, order records, and consent timestamps in standard JSON format.
          </p>
        </div>

        <div>
          <a
            href="/api/account/export"
            download
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow hover:bg-slate-800 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Download My Personal Data (.JSON)</span>
          </a>
        </div>
      </div>

      {/* Right to Erasure / De-identification */}
      <div className="rounded-xl border border-rose-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-serif text-base font-bold text-rose-900">Right to Erasure &amp; De-Identification</h3>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
            You may request that your customer account and personal contact identifiers be permanently wiped.
          </p>
        </div>

        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200 space-y-1">
          <p className="font-bold flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
            <span>Important Statutory Compliance Notice:</span>
          </p>
          <p className="text-[11px] leading-relaxed text-amber-800">
            Under Section 29 of the South African Tax Administration Act (TAA), issued VAT tax invoices and financial audit logs must be retained for 5 years. During account erasure, your name, phone, email, and password will be irreversibly de-identified to <code className="bg-amber-100 px-1 rounded font-mono">deleted-user-xxx@anonymized.invalid</code> while satisfying SARS fiscal retention rules.
          </p>
        </div>

        {pendingErasure ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 space-y-2">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
              <CheckCircle className="h-4 w-4 text-amber-700" />
              <span>Erasure Request Queued</span>
            </div>
            <p className="text-xs text-amber-800">
              A 7-day cooling-off period is active. Your account is scheduled for automatic permanent anonymization on:
            </p>
            <p className="font-mono text-xs font-bold text-amber-950">
              {new Date(pendingErasure.scheduled_for).toLocaleString()}
            </p>
          </div>
        ) : (
          <form action={async (formData: FormData) => {
            'use server';
            await requestErasureAction(null, formData);
          }} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Reason for Erasure Request (Optional)
              </label>
              <textarea
                name="reason"
                rows={2}
                placeholder="Let us know why you are requesting account closure..."
                className="w-full rounded-lg border border-slate-200 p-2 focus:border-rose-700 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="rounded-xl bg-rose-700 px-4 py-2.5 font-semibold text-white shadow hover:bg-rose-800 transition-colors flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              <span>Request Account Erasure (7-Day Schedule)</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
