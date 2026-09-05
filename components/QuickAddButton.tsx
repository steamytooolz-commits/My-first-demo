'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Check } from 'lucide-react';
import { addToCartAction } from '@/app/actions/cart';

export default function QuickAddButton({ variantId }: { variantId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  function handleAdd() {
    setError(null);
    setAdded(false);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('variantId', variantId);
      formData.set('qty', '1');
      const res = await addToCartAction(null, formData);
      if (!res.success) {
        setError(res.error || 'Could not add to cart.');
        return;
      }
      setAdded(true);
      router.refresh();
      window.setTimeout(() => setAdded(false), 2000);
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleAdd}
        disabled={isPending}
        title={error || 'Add to cart'}
        className={`flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-sm transition-colors disabled:opacity-50 ${added ? 'bg-emerald-700' : 'bg-teal-800 hover:bg-teal-900'}`}
      >
        {added ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
      </button>
      {error && <span className="max-w-[120px] text-right text-[10px] font-medium text-rose-600">{error}</span>}
    </span>
  );
}
