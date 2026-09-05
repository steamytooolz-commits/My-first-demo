'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { adminDeleteProductAction } from '@/app/actions/admin';

export default function DeleteProductButton({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`Delete "${productName}" and all its SKUs? This cannot be undone.`)) return;
    startTransition(async () => {
      await adminDeleteProductAction(productId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="text-rose-600 hover:text-rose-800 p-1 disabled:opacity-50"
      title="Delete Product"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
