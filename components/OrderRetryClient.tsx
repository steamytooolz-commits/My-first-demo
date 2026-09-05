'use client';

import { useState } from 'react';
import { retryPaymentAction } from '@/app/actions/checkout';
import { CreditCard } from 'lucide-react';

export default function OrderRetryClient({ orderId }: { orderId: string }) {
  const [outcome, setOutcome] = useState<'success' | 'declined' | 'pending'>('success');
  const [isRetrying, setIsRetrying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRetry() {
    setIsRetrying(true);
    setMessage(null);
    const res = await retryPaymentAction(orderId, outcome);
    setIsRetrying(false);
    if (res.success) {
      window.location.reload();
    } else {
      setMessage(res.error || 'Payment retry failed');
    }
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 space-y-3">
      <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
        <CreditCard className="h-4 w-4 text-amber-700" />
        <span>Simulate Payment Authorization (Sandbox)</span>
      </div>
      <p className="text-xs text-amber-800">
        This order is currently pending payment. Choose a test outcome to simulate immediate bank authorization:
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOutcome('success')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${
            outcome === 'success'
              ? 'border-emerald-600 bg-emerald-100 text-emerald-900'
              : 'border-slate-300 bg-white text-slate-700'
          }`}
        >
          ✓ Approve Payment
        </button>
        <button
          type="button"
          onClick={() => setOutcome('declined')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${
            outcome === 'declined'
              ? 'border-rose-600 bg-rose-100 text-rose-900'
              : 'border-slate-300 bg-white text-slate-700'
          }`}
        >
          ✗ Decline Payment
        </button>
        <button
          type="button"
          onClick={() => setOutcome('pending')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${
            outcome === 'pending'
              ? 'border-amber-600 bg-amber-100 text-amber-900'
              : 'border-slate-300 bg-white text-slate-700'
          }`}
        >
          ⏳ Keep Pending
        </button>
      </div>

      <div className="pt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={isRetrying}
          onClick={handleRetry}
          className="rounded-lg bg-teal-800 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-900 disabled:opacity-50 transition-colors"
        >
          {isRetrying ? 'Processing simulation...' : 'Submit Payment Simulation'}
        </button>
        {message && <span className="text-xs text-rose-600">{message}</span>}
      </div>
    </div>
  );
}
