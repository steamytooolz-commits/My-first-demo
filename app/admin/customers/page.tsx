import { db } from '@/lib/db';
import { adminExecuteErasureAction, adminReviewTradeApplicationAction } from '@/app/actions/admin';
import { Shield, Download, Trash2, Building2 } from 'lucide-react';
import ActionForm from '@/components/ActionForm';

export default async function AdminCustomersPage() {
  let customers: any[] = [];
  try {
    customers = await db.prepare(`
      SELECT u.id, u.email, u.full_name, u.phone, u.role, u.status,
             u.marketing_consent, u.poia_processing_consent_at,
             u.account_type, u.trade_status, u.business_name, u.created_at,
             (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count
      FROM users u
      ORDER BY u.created_at DESC
    `).all() as any[];
  } catch (e) {
    // Pre-003 fallback: legacy columns only
    customers = await db.prepare(`
      SELECT u.id, u.email, u.full_name, u.phone, u.role, u.status, u.marketing_consent,
             u.poia_processing_consent_at, u.created_at,
             (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count
      FROM users u
      ORDER BY u.created_at DESC
    `).all() as any[];
  }

  const privacyRequests = await db.prepare(`
    SELECT pr.*, u.email as user_email
    FROM data_subject_requests pr
    LEFT JOIN users u ON pr.user_id = u.id
    ORDER BY pr.created_at DESC
  `).all() as any[];

  let tradeQueue: any[] = [];
  try {
    tradeQueue = await db.prepare(`
      SELECT ta.*, u.email as user_email
      FROM trade_applications ta
      LEFT JOIN users u ON ta.user_id = u.id
      ORDER BY CASE WHEN ta.status = 'pending' THEN 0 ELSE 1 END, ta.created_at DESC
    `).all() as any[];
  } catch {
    tradeQueue = [];
  }
  const pendingTrades = tradeQueue.filter((t) => t.status === 'pending');

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-slate-900">Customers &amp; POPIA Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Registered accounts, Protection of Personal Information Act (POPIA) consent records, and erasure queue.
          </p>
        </div>

        <a
          href="/api/admin/export/customers"
          download
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <Download className="h-4 w-4 text-slate-500" />
          <span>Export Customers CSV</span>
        </a>
      </div>

      {/* POPIA Privacy Requests Queue */}
      <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-800" />
            <h2 className="font-serif text-base font-bold text-teal-950">POPIA Erasure Requests Queue</h2>
          </div>
          <span className="text-xs text-teal-800 font-semibold">{privacyRequests.length} total request(s)</span>
        </div>

        {privacyRequests.length === 0 ? (
          <p className="text-xs text-teal-900">No active customer erasure or access requests pending.</p>
        ) : (
          <div className="divide-y divide-teal-100 bg-white rounded-lg border border-teal-200 overflow-hidden text-xs">
            {privacyRequests.map(pr => (
              <div key={pr.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{pr.user_email || 'De-identified User'}</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${pr.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {pr.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Requested: {new Date(pr.created_at).toLocaleDateString()} • Scheduled for:{' '}
                    {new Date(pr.scheduled_for).toLocaleDateString()}
                  </p>
                  {pr.reason && <p className="text-[11px] text-slate-600 italic mt-0.5">&ldquo;{pr.reason}&rdquo;</p>}
                </div>

                {pr.status === 'pending' && (
                  <ActionForm action={async () => {
                    'use server';
                    return adminExecuteErasureAction(pr.id);
                  }}>
                    <button
                      type="submit"
                      className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Execute Erasure Now</span>
                    </button>
                  </ActionForm>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trade applications queue (B2B Beta) */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-indigo-800" />
            <h2 className="font-serif text-base font-bold text-indigo-950">Trade Applications (B2B Beta)</h2>
          </div>
          <span className="text-xs text-indigo-800 font-semibold">{pendingTrades.length} pending • {tradeQueue.length} total</span>
        </div>

        {tradeQueue.length === 0 ? (
          <p className="text-xs text-indigo-900">No trade applications yet. Customers apply via Account → Trade Account (B2B).</p>
        ) : (
          <div className="divide-y divide-indigo-100 bg-white rounded-lg border border-indigo-200 overflow-hidden text-xs">
            {tradeQueue.map((ta) => (
              <div key={ta.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900">{ta.business_name}</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${ta.status === 'pending' ? 'bg-amber-100 text-amber-800' : ta.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {ta.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {ta.user_email} • {ta.contact_person} • {ta.phone}
                    {ta.trade_vat_number ? ` • VAT ${ta.trade_vat_number}` : ''}{ta.cipc_number ? ` • CIPC ${ta.cipc_number}` : ''}
                  </p>
                  {ta.trade_references && <p className="text-[11px] text-slate-600 italic mt-0.5">Refs: {ta.trade_references}</p>}
                </div>

                {ta.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <ActionForm action={async () => {
                      'use server';
                      return adminReviewTradeApplicationAction(ta.id, 'approved');
                    }}>
                      <button type="submit" className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors">
                        Approve
                      </button>
                    </ActionForm>
                    <ActionForm action={async () => {
                      'use server';
                      return adminReviewTradeApplicationAction(ta.id, 'rejected');
                    }}>
                      <button type="submit" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
                        Reject
                      </button>
                    </ActionForm>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Customer Registry */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden space-y-4 p-6">
        <h2 className="font-serif text-base font-bold text-slate-900">Customer Accounts Registry</h2>

        <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full min-w-[820px] text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-3 px-3">Name &amp; Email</th>
              <th className="py-3 px-3">Role</th>
              <th className="py-3 px-3">Phone</th>
              <th className="py-3 px-3 text-center">Orders</th>
              <th className="py-3 px-3 text-center">POPIA Consent</th>
              <th className="py-3 px-3 text-center">Marketing</th>
              <th className="py-3 px-3">Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {customers.map(c => (
              <tr key={c.id} className="hover:bg-slate-50/50">
                <td className="py-3 px-3">
                  <p className="font-bold text-slate-900">{c.full_name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{c.email}</p>
                </td>
                <td className="py-3 px-3">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${c.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'}`}>
                    {c.role}
                  </span>
                  {(c.trade_status === 'approved' || c.account_type === 'trade') && (
                    <span className="ml-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase bg-indigo-100 text-indigo-800" title={c.business_name || 'Trade account'}>
                      Trade
                    </span>
                  )}
                  {c.trade_status === 'pending' && (
                    <span className="ml-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                      Trade pending
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 text-slate-600">{c.phone || '—'}</td>
                <td className="py-3 px-3 text-center font-bold text-slate-800">{c.order_count}</td>
                <td className="py-3 px-3 text-center">
                  <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${c.poia_processing_consent_at ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {c.poia_processing_consent_at ? 'Consented' : 'Missing'}
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${c.marketing_consent === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {c.marketing_consent === 1 ? 'Opted In' : 'No'}
                  </span>
                </td>
                <td className="py-3 px-3 text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
