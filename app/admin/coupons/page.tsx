import { db } from '@/lib/db';
import { formatZar } from '@/lib/money';
import { adminSaveCouponAction, adminDeleteCouponAction } from '@/app/actions/admin';
import { Tag, Plus, Trash2 } from 'lucide-react';

export default async function AdminCouponsPage() {
  const coupons = db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all() as any[];

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="font-serif text-3xl font-bold text-slate-900">Coupons &amp; Promotions</h1>
        <p className="text-xs text-slate-500 mt-1">Configure discount vouchers, minimum spends, and redemptions.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Existing coupons */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-serif text-base font-bold text-slate-900">Active Coupons ({coupons.length})</h2>

          <div className="divide-y divide-slate-100 text-xs">
            {coupons.map(c => (
              <div key={c.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-teal-800 text-sm">{c.code}</span>
                    <span className="rounded bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-900">
                      {c.type === 'percent'
                        ? `${c.value}% OFF`
                        : c.type === 'free_shipping'
                        ? 'FREE SHIPPING'
                        : `${formatZar(c.value)} OFF`}
                    </span>
                    {c.active === 0 && (
                      <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-500">Disabled</span>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Used {c.used_count || 0} time{c.used_count !== 1 ? 's' : ''}
                    {c.usage_limit ? ` of ${c.usage_limit} max` : ''} • Min spend:{' '}
                    {c.min_subtotal_cents > 0 ? formatZar(c.min_subtotal_cents) : 'None'}
                    {c.expires_at ? ` • Expires: ${c.expires_at}` : ''}
                  </p>
                </div>

                <form action={async () => {
                  'use server';
                  await adminDeleteCouponAction(c.id);
                }}>
                  <button type="submit" className="text-rose-600 hover:text-rose-800 p-1" title="Delete coupon">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>

        {/* Add coupon form */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-serif text-base font-bold text-slate-900 flex items-center gap-2">
            <Plus className="h-4 w-4 text-teal-800" />
            <span>Create Promotional Coupon</span>
          </h2>

          <form action={async (formData: FormData) => {
            'use server';
            await adminSaveCouponAction(null, formData);
          }} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Coupon Code *</label>
              <input
                name="code"
                required
                placeholder="e.g. WELCOME15"
                className="w-full rounded-lg border border-slate-200 p-2 font-mono uppercase focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Discount Type</label>
                <select
                  name="type"
                  defaultValue="percent"
                  className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
                >
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Fixed Rand (R)</option>
                  <option value="free_shipping">Free Shipping</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Discount Value</label>
                <input
                  name="value_percent"
                  type="number"
                  placeholder="15 (%) or Rand"
                  className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Min Order (Rand)</label>
                <input
                  name="min_subtotal_rand"
                  type="number"
                  step="0.01"
                  defaultValue="0"
                  className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Max Cap (Rand)</label>
                <input
                  name="max_discount_rand"
                  type="number"
                  step="0.01"
                  placeholder="Optional limit"
                  className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Usage Limit</label>
                <input
                  name="usage_limit"
                  type="number"
                  placeholder="e.g. 100"
                  className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expires At</label>
                <input
                  name="expires_at"
                  type="date"
                  className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cp_one_per_customer"
                  name="one_per_customer"
                  className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
                />
                <label htmlFor="cp_one_per_customer" className="font-semibold text-slate-700 cursor-pointer">
                  Limit to 1 use per customer
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cp_active"
                  name="active"
                  defaultChecked
                  className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
                />
                <label htmlFor="cp_active" className="font-semibold text-slate-700 cursor-pointer">
                  Active Immediately
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-teal-800 py-2.5 font-semibold text-white hover:bg-teal-900 transition-colors"
            >
              Save Coupon
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
