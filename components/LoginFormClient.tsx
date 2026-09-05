'use client';

import { useState } from 'react';
import { loginAction } from '@/app/actions/auth';
import { AlertCircle, Lock, Mail } from 'lucide-react';

function safeRedirect(raw: string | null | undefined): string {
  const v = String(raw || '').trim();
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return '/account';
  if (/[\\]/.test(v)) return '/account';
  return v.slice(0, 200) || '/account';
}

export default function LoginFormClient({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set('email', email.trim());
      formData.set('password', password);
      formData.set('redirectTo', redirectTo || '/account');

      const result = await loginAction(null, formData);

      if (!result || !result.success) {
        setIsSubmitting(false);
        setError(result?.error || 'Failed to sign in.');
        return;
      }

      window.location.href = safeRedirect(result.redirectTo || redirectTo);
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err?.message || 'Failed to sign in.');
    }
  }

  function fillCredentials(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  }

  return (
    <div className="space-y-4">
      {/* Fast demo account quick buttons */}
      <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-3 text-xs space-y-2">
        <span className="font-bold text-teal-900 block text-[11px] uppercase tracking-wider">
          Quick Demo Autofill
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fillCredentials('customer@example.com', 'Customer123!')}
            className="flex-1 rounded-lg border border-teal-200 bg-white py-1.5 px-2 text-[11px] font-semibold text-teal-950 hover:bg-teal-50 transition-colors"
          >
            Fill Customer
          </button>
          <button
            type="button"
            onClick={() => fillCredentials('admin@example.com', 'ChangeMe123!')}
            className="flex-1 rounded-lg border border-teal-200 bg-white py-1.5 px-2 text-[11px] font-semibold text-teal-950 hover:bg-teal-50 transition-colors"
          >
            Fill Admin
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
          <div className="relative">
            <input
              type="email"
              name="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
            />
            <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
          <div className="relative">
            <input
              type="password"
              name="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-teal-700 focus:outline-none"
            />
            <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-800 border border-rose-200 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          id="login-submit-button"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-teal-800 py-3 text-xs font-semibold text-white shadow-sm hover:bg-teal-900 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
