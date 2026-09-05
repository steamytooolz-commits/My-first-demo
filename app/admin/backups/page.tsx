import Link from 'next/link';
import SiteImportForm from '@/components/SiteImportForm';
import { ArrowLeft, Download, ShieldAlert } from 'lucide-react';
import { SITE_TABLES } from '@/lib/site-transfer';

export const dynamic = 'force-dynamic';

export default function AdminBackupsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/admin" className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to dashboard</span>
        </Link>
      </div>

      <div>
        <h1 className="font-serif text-2xl font-bold text-slate-900">Backups &amp; Site Transfer</h1>
        <p className="text-xs text-slate-500 mt-1">
          Download the whole site — products, orders, customers, coupons, settings, invoices — as one JSON file.
          Restore it after a rebuild or move it to another environment. No more redoing demo work.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Export files contain password hashes and customer data. Store them like passwords — never email them or commit them to git.
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="font-serif text-lg font-bold text-slate-900">1. Export full site</h2>
          <p className="text-xs text-slate-500 mt-1">
            Covers {SITE_TABLES.length} tables: {SITE_TABLES.slice(0, 8).join(', ')}… (sessions and rate counters excluded).
          </p>
        </div>
        <a
          href="/api/admin/export/site"
          download
          className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-xs font-semibold text-white shadow hover:bg-teal-900 transition-colors"
        >
          <Download className="h-4 w-4" />
          <span>Download Site Export (.json)</span>
        </a>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <h2 className="font-serif text-lg font-bold text-slate-900">2. Restore from file</h2>
          <p className="text-xs text-slate-500 mt-1">
            Merge adds what&apos;s missing; replace wipes first. Unknown columns are dropped so old exports restore onto newer schemas.
          </p>
        </div>
        <SiteImportForm />
      </div>
    </div>
  );
}
