import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import TradeApplicationForm from '@/components/TradeApplicationForm';
import { Building2, Clock, CheckCircle2, XCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TradeAccountPage() {
  const user = await requireUser('/auth/login?redirectTo=/account/trade');

  let tradeStatus = (user.trade_status || 'none') as string;
  let businessName = user.business_name || '';
  let latest: any = null;
  try {
    latest = await db.prepare(`SELECT * FROM trade_applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`).get(user.id) as any;
    if (latest?.status) tradeStatus = latest.status === 'approved' ? 'approved' : latest.status === 'rejected' ? 'rejected' : 'pending';
  } catch {
    latest = null;
  }
  // Users-table status wins when explicitly set by admin review
  if (user.trade_status === 'approved' || user.trade_status === 'rejected' || user.trade_status === 'pending') {
    tradeStatus = user.trade_status;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-serif text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-teal-800" />
          <span>Trade Account (B2B Beta)</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Trade is approval-gated: apply with your business details, we verify and link any existing in-store account, then unlock trade terms.
        </p>
      </div>

      {tradeStatus === 'approved' && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-2">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-900">
            <CheckCircle2 className="h-5 w-5" />
            <span>Trade approved{businessName ? ` — ${businessName}` : ''}</span>
          </p>
          <p className="text-xs text-emerald-800">
            Your orders now carry your business name and VAT number on official tax invoices. Quantity pricing and 30-day terms are quoted per account — contact sales to activate.
          </p>
        </div>
      )}

      {tradeStatus === 'pending' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-2">
          <p className="flex items-center gap-2 text-sm font-bold text-amber-900">
            <Clock className="h-5 w-5" />
            <span>Under review</span>
          </p>
          <p className="text-xs text-amber-800">
            {latest?.business_name ? `Application for “${latest.business_name}” was received` : 'Application received'} — we typically verify within 1 business day and link any in-store history before approving.
          </p>
        </div>
      )}

      {tradeStatus === 'rejected' && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 space-y-2">
          <p className="flex items-center gap-2 text-sm font-bold text-rose-900">
            <XCircle className="h-5 w-5" />
            <span>Not approved</span>
          </p>
          <p className="text-xs text-rose-800">Contact support if you believe this is an error — you can re-apply with corrected business details below.</p>
        </div>
      )}

      {(tradeStatus === 'none' || tradeStatus === 'rejected') && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">Apply for trade</h3>
          <TradeApplicationForm defaults={{ full_name: user.full_name || '', phone: user.phone || '' }} />
        </div>
      )}
    </div>
  );
}
