import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatZar } from '@/lib/money';
import { updateProfileAction } from '@/app/actions/auth';
import ActionForm from '@/components/ActionForm';
import { ArrowRight } from 'lucide-react';

export default async function AccountOverviewPage() {
  const user = await requireUser();

  const orders = await db.prepare(`
    SELECT * FROM orders WHERE user_id = ? ORDER BY placed_at DESC LIMIT 5
  `).all(user.id) as any[];

  const orderStats = await db.prepare(`
    SELECT COUNT(*) as total_orders, COALESCE(SUM(total_cents), 0) as total_spent
    FROM orders WHERE user_id = ? AND status != 'cancelled'
  `).get(user.id) as any;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Orders Placed</p>
          <p className="mt-2 text-3xl font-serif font-bold text-slate-900">{orderStats.total_orders}</p>
          <p className="mt-1 text-xs text-slate-400">Total fulfilled &amp; active stationery orders</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Stationery Investment</p>
          <p className="mt-2 text-3xl font-serif font-bold text-teal-900">{formatZar(orderStats.total_spent)}</p>
          <p className="mt-1 text-xs text-slate-400">Excludes cancelled orders</p>
        </div>
      </div>

      {/* Profile Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-serif text-lg font-bold text-slate-900">Personal Information</h2>
        <ActionForm action={async (formData: FormData) => {
          'use server';
          return updateProfileAction(null, formData);
        }} successMessage="Profile updated." className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              name="full_name"
              defaultValue={user.full_name || ''}
              className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
            <input
              type="tel"
              name="phone"
              defaultValue={user.phone || ''}
              placeholder="e.g. 082 000 0000"
              className="w-full rounded-lg border border-slate-200 p-2 text-slate-900 focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              disabled
              value={user.email}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 cursor-not-allowed"
            />
            <p className="text-[10px] text-slate-400 mt-1">To change email, please <Link href="/contact" className="font-semibold text-teal-800 hover:underline">contact customer care</Link>.</p>
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="marketing_consent"
              name="marketing_consent"
              defaultChecked={user.marketing_consent === 1}
              className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
            />
            <label htmlFor="marketing_consent" className="text-slate-700 cursor-pointer">
              Subscribe to stationery curation newsletters &amp; product drops
            </label>
          </div>

          <div className="sm:col-span-2 pt-2">
            <button
              type="submit"
              className="rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white hover:bg-teal-900 transition-colors"
            >
              Save Profile Changes
            </button>
          </div>
        </ActionForm>
      </div>

      {/* Recent Orders Preview */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-slate-900">Recent Orders</h2>
          <Link href="/account/orders" className="text-xs font-semibold text-teal-800 hover:text-teal-900 flex items-center gap-1">
            <span>View all</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {orders.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">You haven&apos;t placed any stationery orders yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map(o => (
              <div key={o.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <Link href={`/order/${o.order_number}`} className="font-bold text-slate-900 hover:text-teal-800">
                    #{o.order_number}
                  </Link>
                  <p className="text-[11px] text-slate-500">{new Date(o.placed_at).toLocaleDateString()}</p>
                </div>

                <div className="flex items-center gap-4">
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 capitalize">
                    {o.status.replace('_', ' ')}
                  </span>
                  <span className="font-bold text-slate-900">{formatZar(o.total_cents)}</span>
                  <Link
                    href={`/order/${o.order_number}`}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
