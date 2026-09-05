'use client';

import { useState } from 'react';
import { registerAction } from '@/app/actions/auth';
import { AlertCircle } from 'lucide-react';

function safeRedirect(raw: string | null | undefined): string {
  const v = String(raw || '').trim();
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return '/account';
  if (/[\\]/.test(v)) return '/account';
  return v.slice(0, 200) || '/account';
}

export default function RegisterFormClient({ redirectTo, storeName }: { redirectTo: string; storeName?: string }) {
  const brand = storeName || 'Paper & Quill';
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password strength checker
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isStrong = hasMinLength && hasLetter && hasNumber;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const formData = new FormData(e.currentTarget);
      const result = await registerAction(null, formData);

      if (!result || !result.success) {
        setIsSubmitting(false);
        setError(result?.error || 'Failed to create account.');
        if (result?.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        return;
      }

      window.location.href = safeRedirect(result.redirectTo || redirectTo);
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err?.message || 'Failed to create account.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs">
      <div>
        <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
        <input
          type="text"
          name="full_name"
          required
          placeholder="e.g. Sipho Sithole"
          className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none"
        />
        {fieldErrors.full_name && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.full_name}</p>}
      </div>

      <div>
        <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
        <input
          type="email"
          name="email"
          required
          placeholder="sipho@example.co.za"
          className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none"
        />
        {fieldErrors.email && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.email}</p>}
      </div>

      <div>
        <label className="block font-semibold text-slate-700 mb-1">Phone Number (Optional)</label>
        <input
          type="tel"
          name="phone"
          placeholder="e.g. 082 000 0000"
          className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none"
        />
      </div>

      <div>
        <label className="block font-semibold text-slate-700 mb-1">Password *</label>
        <input
          type="password"
          name="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Min 8 characters"
          className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none"
        />
        {/* Real-time requirements checklist */}
        <div className="mt-1.5 grid grid-cols-3 gap-1 text-[10px]">
          <span className={hasMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
            ✓ 8+ chars
          </span>
          <span className={hasLetter ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
            ✓ 1 letter
          </span>
          <span className={hasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
            ✓ 1 number
          </span>
        </div>
        {fieldErrors.password && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.password}</p>}
      </div>

      {/* POPIA Mandatory Consent Checkbox */}
      <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3 space-y-2">
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            id="poia_consent"
            name="poia_consent"
            required
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
          />
          <label htmlFor="poia_consent" className="text-[11px] text-slate-700 leading-relaxed cursor-pointer">
            <strong className="text-teal-950 block">Processing Acknowledgement (Required)</strong>
            I understand {brand} must process my name, contact and delivery details to fulfil orders and meet tax law (contract + legal obligation, POPIA s11(1)(b)–(c)). Marketing emails remain strictly opt-in below.
          </label>
        </div>
        {fieldErrors.poia_consent && <p className="text-[11px] text-rose-600">{fieldErrors.poia_consent}</p>}
      </div>

      {/* Marketing Consent Checkbox (Optional) */}
      <div className="flex items-start gap-2.5 px-1">
        <input
          type="checkbox"
          id="marketing_consent"
          name="marketing_consent"
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
        />
        <label htmlFor="marketing_consent" className="text-[11px] text-slate-600 cursor-pointer">
          Subscribe to occasional product curations and seasonal stationery releases (Optional).
        </label>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-800 border border-rose-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        id="register-submit-button"
        disabled={isSubmitting || !isStrong}
        className="w-full rounded-xl bg-teal-800 py-3 text-xs font-semibold text-white shadow-sm hover:bg-teal-900 disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? 'Creating Account...' : 'Agree &amp; Register Account'}
      </button>
    </form>
  );
}
