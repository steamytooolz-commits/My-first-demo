import Link from 'next/link';
import Image from 'next/image';
import { formatZar } from '@/lib/money';
import QuickAddButton from '@/components/QuickAddButton';

interface ProductCardProps {
  storeName?: string;
  product: {
    id: string;
    name: string;
    slug: string;
    brand?: string | null;
    category_name?: string | null;
    image_url?: string | null;
    min_price_cents: number;
    max_price_cents: number;
    total_stock: number;
    variant_count: number;
    default_variant_id: string;
  };
}

export default function ProductCard({ product, storeName }: ProductCardProps) {
  const isOutOfStock = product.total_stock <= 0;
  const isLowStock = !isOutOfStock && product.total_stock <= 5;
  const isSinglePrice = product.min_price_cents === product.max_price_cents;

  return (
    <div className="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Image container */}
      <Link href={`/products/${product.slug}`} className="relative aspect-square w-full overflow-hidden rounded-lg bg-slate-100">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400 font-serif">
            {storeName || 'Paper & Quill'}
          </div>
        )}

        {/* Stock status badge */}
        {isOutOfStock ? (
          <span className="absolute top-2 right-2 rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow">
            Out of Stock
          </span>
        ) : isLowStock ? (
          <span className="absolute top-2 right-2 rounded-md bg-amber-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow">
            Only {product.total_stock} left
          </span>
        ) : null}
      </Link>

      {/* Details */}
      <div className="mt-4 flex flex-1 flex-col justify-between">
        <div>
          {product.category_name && (
            <p className="text-[11px] font-medium uppercase tracking-wider text-teal-800">
              {product.category_name}
            </p>
          )}
          <Link href={`/products/${product.slug}`} className="mt-1 block">
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-teal-800 transition-colors line-clamp-1">
              {product.name}
            </h3>
          </Link>
          {product.brand && (
            <p className="mt-0.5 text-xs text-slate-500">{product.brand}</p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between pt-2 border-t border-slate-100">
          <div>
            <p className="text-sm font-bold text-slate-900">
              {isSinglePrice ? (
                formatZar(product.min_price_cents)
              ) : (
                <span>
                  {formatZar(product.min_price_cents)} &ndash; {formatZar(product.max_price_cents)}
                </span>
              )}
            </p>
            {product.variant_count > 1 && (
              <p className="text-[10px] text-slate-500">{product.variant_count} options</p>
            )}
          </div>

          {/* Quick Add Button */}
          {!isOutOfStock && product.variant_count === 1 ? (
            <QuickAddButton variantId={product.default_variant_id} />
          ) : (
            <Link
              href={`/products/${product.slug}`}
              className="flex h-8 px-2.5 items-center justify-center rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Select
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
