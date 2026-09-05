'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Building2 } from 'lucide-react';
import { submitTradeApplicationAction } from '@/app/actions/trade';

export default function TradeApplicationForm({ defaults }: { defaults: { full_name: string; phone: string } }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await submitTradeApplicationAction(null, formData);
      if (!res.success) {
        setError(res.error || 'Could not submit application.');
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 font-medium text-rose-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <div>
        <label className="block font-semibold text-slate-700 mb-1">Registered business name *</label>
        <input name="business_name" required maxLength={120} placeholder="e.g. Kalahari Office Supplies (Pty) Ltd" className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">VAT number (if registered)</label>
          <input name="trade_vat_number" maxLength={20} placeholder="4xxxxxxxxx" className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">CIPC / CK number</label>
          <input name="cipc_number" maxLength={30} placeholder="2015/000000/07" className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Contact person *</label>
          <input name="contact_person" required defaultValue={defaults.full_name} maxLength={120} className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none" />
        </div>
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Contact number *</label>
          <input name="phone" required defaultValue={defaults.phone} maxLength={20} placeholder="082 000 0000" className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none" />
        </div>
      </div>
      <div>
        <label className="block font-semibold text-slate-700 mb-1">Trade references (optional)</label>
        <textarea name="trade_references" rows={2} maxLength={1000} placeholder="Existing in-store account no., supplier references…" className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none" />
        <p className="mt-1 text-[11px] text-slate-400">Already buy in-store? Add your account number here — staff will link your history on approval.</p>
      </div>
      <button type="submit" disabled={isPending} className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 font-semibold text-white hover:bg-teal-900 disabled:opacity-50">
        <Building2 className="h-4 w-4" />
        <span>{isPending ? 'Submitting…' : 'Apply for Trade Beta'}</span>
      </button>
    </form>
  );
}
