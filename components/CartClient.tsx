'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatZar } from '@/lib/money';
import { Trash2, Tag, ArrowRight, Truck, Check, AlertCircle } from 'lucide-react';
import {
  updateCartItemAction,
  removeCartItemAction,
  setShippingMethodAction,
  applyCouponAction,
  removeCouponAction,
} from '@/app/actions/cart';
import { CartSummary } from '@/lib/cart';

interface CartClientProps {
  initialCart: CartSummary;
  settings?: {
    free_shipping_threshold_cents: number;
    standard_base_cents: number;
    express_base_cents: number;
  };
}

export default function CartClient({ initialCart, settings }: CartClientProps) {
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(initialCart.couponWarning || null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [loadingVariantId, setLoadingVariantId] = useState<string | null>(null);

  const { items, subtotalCents, discountCents, shippingCents, taxCents, totalCents, shippingMethod, freeShippingProgress } = initialCart;
  const thresholdLabel = formatZar(settings?.free_shipping_threshold_cents ?? freeShippingProgress.thresholdCents);
  const standardLabel = (freeShippingProgress.qualifies ? 'FREE' : formatZar(settings?.standard_base_cents ?? 7500));
  const expressLabel = formatZar(settings?.express_base_cents ?? 15000);

  async function handleQtyChange(variantId: string, currentQty: number, delta: number) {
    const newQty = currentQty + delta;
    setLoadingVariantId(variantId);
    await updateCartItemAction(variantId, newQty);
    setLoadingVariantId(null);
  }

  async function handleRemove(variantId: string) {
    setLoadingVariantId(variantId);
    await removeCartItemAction(variantId);
    setLoadingVariantId(null);
  }

  async function handleShippingChange(method: 'pickup' | 'standard' | 'express') {
    await setShippingMethodAction(method);
  }

  async function handleApplyCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!couponCode.trim()) return;

    setIsApplyingCoupon(true);
    setCouponError(null);

    const formData = new FormData();
    formData.set('couponCode', couponCode.trim());
    const res = await applyCouponAction(null, formData);
    setIsApplyingCoupon(false);

    if (!res.success) {
      setCouponError(res.error || 'Invalid coupon code');
    } else {
      setCouponCode('');
    }
  }

  async function handleRemoveCoupon() {
    await removeCouponAction();
    setCouponError(null);
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center my-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400 font-serif text-2xl">
          🛒
        </div>
        <h2 className="mt-4 font-serif text-2xl font-bold text-slate-900">Your stationery cart is empty</h2>
        <p className="mt-2 text-sm text-slate-500">Explore our curated collection of notebooks, pens, and desk organization.</p>
        <Link
          href="/catalog"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-teal-800 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-900 transition-colors"
        >
          <span>Start Shopping</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 my-8">
      {/* Items & Shipping column */}
      <div className="lg:col-span-8 space-y-6">
        {/* Free shipping progress bar */}
        {freeShippingProgress.enabled && (
          <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-teal-900">
                <Truck className="h-4 w-4 text-teal-700" />
                {freeShippingProgress.qualifies ? (
                  <span>You have unlocked Free Standard Delivery!</span>
                ) : (
                  <span>
                    Add {formatZar(freeShippingProgress.remainingCents)} more to qualify for Free Delivery
                  </span>
                )}
              </span>
              <span className="text-teal-700 font-mono text-[11px]">Threshold: {thresholdLabel}</span>
            </div>
            <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-teal-200/60">
              <div
                className="h-full bg-teal-700 transition-all duration-500 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((freeShippingProgress.thresholdCents - freeShippingProgress.remainingCents) /
                        freeShippingProgress.thresholdCents) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Item List */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
          {items.map(item => {
            const isLoading = loadingVariantId === item.variant_id;

            return (
              <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 border border-slate-200">
                    <Image
                      src={item.image_url || '/seed/a4-notebook.svg'}
                      alt={item.product_name}
                      fill
                      className="object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <Link href={`/products/${item.product_slug}`} className="text-sm font-bold text-slate-900 hover:text-teal-800 transition-colors">
                      {item.product_name}
                    </Link>
                    <p className="text-xs text-slate-500">{item.variant_name}</p>
                    <p className="text-[11px] font-mono text-slate-400">SKU: {item.variant_sku}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-700 sm:hidden">
                      {formatZar(item.unit_price_cents)} each
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between w-full sm:w-auto gap-6 pt-2 sm:pt-0">
                  <div className="hidden sm:block text-right">
                    <p className="text-xs text-slate-500">Unit</p>
                    <p className="text-xs font-semibold text-slate-800">{formatZar(item.unit_price_cents)}</p>
                  </div>

                  {/* Quantity stepper */}
                  <div className="flex items-center rounded-lg border border-slate-300 bg-white">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleQtyChange(item.variant_id, item.qty, -1)}
                      className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      &minus;
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-slate-900">
                      {isLoading ? '...' : item.qty}
                    </span>
                    <button
                      type="button"
                      disabled={item.qty >= item.stock_qty || isLoading}
                      onClick={() => handleQtyChange(item.variant_id, item.qty, 1)}
                      className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>

                  {/* Line Total */}
                  <div className="text-right min-w-[80px]">
                    <p className="text-xs text-slate-500 sm:hidden">Total</p>
                    <p className="text-sm font-bold text-slate-900">
                      {formatZar(item.line_subtotal_cents)}
                    </p>
                  </div>

                  {/* Remove item */}
                  <button
                    type="button"
                    title="Remove item"
                    disabled={isLoading}
                    onClick={() => handleRemove(item.variant_id)}
                    className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Shipping Method Selector */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-serif text-base font-bold text-slate-900">Delivery Method</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Pickup */}
            <button
              type="button"
              aria-pressed={shippingMethod === 'pickup'}
              onClick={() => handleShippingChange('pickup')}
              className={`cursor-pointer rounded-xl border p-4 flex flex-col justify-between text-left transition-all ${
                shippingMethod === 'pickup'
                  ? 'border-teal-700 bg-teal-50/50 ring-1 ring-teal-700'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span>
                <span className="text-xs font-bold text-slate-900 block">Warehouse Collection</span>
                <span className="text-[11px] text-slate-500 block mt-0.5">Ferndale, Johannesburg</span>
              </span>
              <span className="mt-3 text-xs font-bold text-teal-800">FREE ({formatZar(0)})</span>
            </button>

            {/* Standard Courier */}
            <button
              type="button"
              aria-pressed={shippingMethod === 'standard'}
              onClick={() => handleShippingChange('standard')}
              className={`cursor-pointer rounded-xl border p-4 flex flex-col justify-between text-left transition-all ${
                shippingMethod === 'standard'
                  ? 'border-teal-700 bg-teal-50/50 ring-1 ring-teal-700'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span>
                <span className="text-xs font-bold text-slate-900 block">Standard Courier</span>
                <span className="text-[11px] text-slate-500 block mt-0.5">2-4 business days</span>
              </span>
              <span className="mt-3 text-xs font-bold text-slate-900">
                {standardLabel}
              </span>
            </button>

            {/* Express Courier */}
            <button
              type="button"
              aria-pressed={shippingMethod === 'express'}
              onClick={() => handleShippingChange('express')}
              className={`cursor-pointer rounded-xl border p-4 flex flex-col justify-between text-left transition-all ${
                shippingMethod === 'express'
                  ? 'border-teal-700 bg-teal-50/50 ring-1 ring-teal-700'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span>
                <span className="text-xs font-bold text-slate-900 block">Express Overnight</span>
                <span className="text-[11px] text-slate-500 block mt-0.5">1-2 business days</span>
              </span>
              <span className="mt-3 text-xs font-bold text-slate-900">{expressLabel}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary sidebar */}
      <div className="lg:col-span-4 space-y-6">
        {/* Coupon input */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-900">
            <Tag className="h-3.5 w-3.5 text-teal-800" />
            <span>Promotional Coupon</span>
          </div>

          {initialCart.couponCode ? (
            <div className="flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2 border border-teal-200 text-xs">
              <div className="flex items-center gap-1.5 text-teal-900 font-bold">
                <Check className="h-3.5 w-3.5" />
                <span>{initialCart.couponCode} applied</span>
              </div>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="text-[11px] font-semibold text-rose-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={e => setCouponCode(e.target.value.toUpperCase())}
                placeholder="e.g. WELCOME10"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs uppercase font-mono focus:border-teal-700 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isApplyingCoupon || !couponCode.trim()}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {isApplyingCoupon ? '...' : 'Apply'}
              </button>
            </form>
          )}

          {couponError && (
            <div className="text-[11px] text-rose-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span>{couponError}</span>
            </div>
          )}

          <p className="text-[10px] text-slate-400">
            Demo coupons: <code className="text-slate-600">WELCOME10</code> (10% off), <code className="text-slate-600">SAVE50</code> (R50 off R300), <code className="text-slate-600">FREESHIP</code>
          </p>
        </div>

        {/* Order Summary Totals */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="font-serif text-lg font-bold text-slate-900 pb-3 border-b border-slate-100">
            Order Summary
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900">{formatZar(subtotalCents)}</span>
            </div>

            {discountCents > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Coupon Discount</span>
                <span>-{formatZar(discountCents)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600">
              <span>Delivery ({shippingMethod})</span>
              <span className="font-semibold text-slate-900">
                {shippingCents === 0 ? 'FREE' : formatZar(shippingCents)}
              </span>
            </div>

            {taxCents > 0 && (
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Includes VAT</span>
                <span>{formatZar(taxCents)}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 flex justify-between text-base font-bold text-slate-900">
              <span>Total Due</span>
              <span className="text-xl text-teal-900">{formatZar(totalCents)}</span>
            </div>
          </div>

          <Link
            href="/checkout"
            id="proceed-to-checkout-button"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-800 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-900 transition-colors"
          >
            <span>Proceed to Checkout</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
