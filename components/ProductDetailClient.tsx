'use client';

import { useState } from 'react';
import { formatZar } from '@/lib/money';
import { ShoppingBag, Check, AlertTriangle, XCircle } from 'lucide-react';
import { addToCartAction } from '@/app/actions/cart';

interface Variant {
  id: string;
  sku: string;
  name: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  stock_qty: number;
  low_stock_threshold: number;
  weight_g: number;
  options_json: string;
}

interface ProductDetailClientProps {
  productId: string;
  productName: string;
  variants: Variant[];
}

export default function ProductDetailClient({
  productId,
  productName,
  variants,
}: ProductDetailClientProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(variants[0]?.id || '');
  const [qty, setQty] = useState<number>(1);
  const [addedSuccess, setAddedSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const selectedVariant = variants.find(v => v.id === selectedVariantId) || variants[0];
  const isOutOfStock = !selectedVariant || selectedVariant.stock_qty <= 0;
  const isLowStock = !isOutOfStock && selectedVariant.stock_qty <= selectedVariant.low_stock_threshold;

  async function handleAddToCart(e: React.FormEvent) {
    e.preventDefault();
    if (isOutOfStock || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setAddedSuccess(false);

    const formData = new FormData();
    formData.set('variantId', selectedVariant.id);
    formData.set('qty', String(qty));

    const result = await addToCartAction(null, formData);
    setIsSubmitting(false);

    if (result.success) {
      setAddedSuccess(true);
      setTimeout(() => setAddedSuccess(false), 4000);
    } else {
      setErrorMessage(result.error || 'Failed to add to cart.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Price & SKU Header */}
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold tracking-tight text-slate-900">
            {formatZar(selectedVariant?.price_cents || 0)}
          </span>
          {selectedVariant?.compare_at_price_cents && selectedVariant.compare_at_price_cents > selectedVariant.price_cents && (
            <span className="text-sm text-slate-400 line-through">
              {formatZar(selectedVariant.compare_at_price_cents)}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500 font-mono">
          SKU: <span className="font-semibold text-slate-700">{selectedVariant?.sku}</span>
          {selectedVariant?.weight_g ? ` • Weight: ${selectedVariant.weight_g}g` : ''}
        </p>
      </div>

      {/* Variant Selector */}
      {variants.length > 1 && (
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Select Option / Variant: <span className="text-teal-800 font-bold">{selectedVariant?.name}</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {variants.map(v => {
              const isSelected = v.id === selectedVariantId;
              const oos = v.stock_qty <= 0;

              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setSelectedVariantId(v.id);
                    setQty(1);
                    setErrorMessage(null);
                  }}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold border transition-all ${
                    isSelected
                      ? 'border-teal-700 bg-teal-50 text-teal-900 ring-1 ring-teal-700'
                      : oos
                      ? 'border-slate-200 bg-slate-100 text-slate-400 line-through'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  {v.name}
                  {oos && ' (Out of stock)'}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stock Availability Indicator */}
      <div>
        {isOutOfStock ? (
          <div className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-800 border border-rose-200">
            <XCircle className="h-4 w-4 text-rose-600" />
            <span>Currently out of stock. Check back soon.</span>
          </div>
        ) : isLowStock ? (
          <div className="inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 border border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>Low Stock: Only {selectedVariant.stock_qty} units available!</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 border border-emerald-200">
            <Check className="h-4 w-4 text-emerald-600" />
            <span>In Stock ({selectedVariant.stock_qty} available for immediate dispatch)</span>
          </div>
        )}
      </div>

      {/* Add to Cart Form */}
      <form onSubmit={handleAddToCart} className="space-y-4 pt-2">
        <div className="flex items-center gap-4">
          {/* Quantity selector */}
          <div className="flex items-center rounded-lg border border-slate-300 bg-white">
            <button
              type="button"
              disabled={qty <= 1 || isOutOfStock}
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="px-3 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              &minus;
            </button>
            <span className="w-10 text-center text-xs font-semibold text-slate-900">{qty}</span>
            <button
              type="button"
              disabled={qty >= (selectedVariant?.stock_qty || 1) || isOutOfStock}
              onClick={() => setQty(q => Math.min(selectedVariant?.stock_qty || 1, q + 1))}
              className="px-3 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              +
            </button>
          </div>

          <button
            type="submit"
            id="add-to-cart-button"
            disabled={isOutOfStock || isSubmitting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-800 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>{isOutOfStock ? 'Sold Out' : isSubmitting ? 'Adding...' : 'Add to Cart'}</span>
          </button>
        </div>

        {/* Feedback messages */}
        {addedSuccess && (
          <div className="rounded-lg bg-emerald-50 p-3 text-xs font-medium text-emerald-800 border border-emerald-200 flex items-center gap-2">
            <Check className="h-4 w-4" />
            <span>Added {qty} item{qty > 1 ? 's' : ''} to your cart. View your cart to checkout!</span>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-lg bg-rose-50 p-3 text-xs font-medium text-rose-800 border border-rose-200 flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            <span>{errorMessage}</span>
          </div>
        )}
      </form>
    </div>
  );
}
