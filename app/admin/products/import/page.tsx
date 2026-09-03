import Link from 'next/link';
import ProductImportClient from '@/components/ProductImportClient';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function AdminProductImportPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/admin/products" className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to products</span>
        </Link>
      </div>

      <div>
        <h1 className="font-serif text-2xl font-bold text-slate-900">Import Catalogue (CSV)</h1>
        <p className="text-xs text-slate-500 mt-1">
          Load your whole catalogue in one go. Upload → confirm the column mapping → import.
          Re-importing the same slugs/SKUs updates instead of duplicating.
        </p>
      </div>

      <ProductImportClient />
    </div>
  );
}
