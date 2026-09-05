'use client';

import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface ActionFormResult {
  success: boolean;
  error?: string;
}

interface ActionFormProps {
  action: (formData: FormData) => Promise<ActionFormResult>;
  children: ReactNode;
  className?: string;
  successMessage?: string;
}

// Wraps inline server actions so failures are VISIBLE instead of silent.
// Pass the page's inline 'use server' function straight through as `action`.
export default function ActionForm({ action, children, className, successMessage }: ActionFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const res = await action(formData);
        if (!res || !res.success) {
          setError(res?.error || 'Action failed. Nothing was changed.');
        } else if (successMessage) {
          setSaved(true);
        }
      } catch (err: any) {
        setError(err?.message || 'Action failed. Nothing was changed.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className={className} aria-busy={isPending}>
      {error && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {saved && successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}
      {children}
    </form>
  );
}
