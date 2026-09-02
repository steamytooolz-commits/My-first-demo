import { db } from '@/lib/db';
import AutoSubmitSelect from '@/components/AutoSubmitSelect';

export const dynamic = 'force-dynamic';

interface AdminAuditPageProps {
  searchParams: Promise<{ entity?: string }>;
}

export default async function AdminAuditPage({ searchParams }: AdminAuditPageProps) {
  const { entity } = await searchParams;

  let query = `
    SELECT al.*, u.email as user_email
    FROM audit_logs al
    LEFT JOIN users u ON al.actor_id = u.id
  `;

  const where: string[] = [];
  const params: any[] = [];

  if (entity && entity !== 'all') {
    where.push('al.entity = ?');
    params.push(entity);
  }

  if (where.length > 0) {
    query += ` WHERE ${where.join(' AND ')}`;
  }

  query += ` ORDER BY al.created_at DESC LIMIT 100`;

  const logs = db.prepare(query).all(...params) as any[];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-serif text-3xl font-bold text-slate-900">System Audit Trail</h1>
        <p className="text-xs text-slate-500 mt-1">
          Immutable compliance logs of inventory changes, order updates, POPIA erasures, and admin actions.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between text-xs">
        <form method="GET" action="/admin/audit" className="flex items-center gap-2">
          <label className="font-semibold text-slate-700">Filter Entity:</label>
          <AutoSubmitSelect
            name="entity"
            defaultValue={entity || 'all'}
            className="rounded-lg border border-slate-200 p-1.5 text-xs text-slate-900 focus:border-teal-700 focus:outline-none cursor-pointer"
          >
            <option value="all">All Entities</option>
            <option value="order">Orders</option>
            <option value="product">Products</option>
            <option value="inventory">Inventory Adjustments</option>
            <option value="category">Categories</option>
            <option value="coupon">Coupons</option>
            <option value="privacy">POPIA Privacy</option>
            <option value="auth">Authentication</option>
            <option value="settings">Settings</option>
          </AutoSubmitSelect>
        </form>

        <span className="text-slate-500">{logs.length} logged events</span>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Entity</th>
              <th className="py-3 px-4">Operator</th>
              <th className="py-3 px-4">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                  No audit logs recorded for this filter.
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">{log.action}</td>
                  <td className="py-3 px-4 text-slate-600">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">
                      {log.entity} {log.entity_id ? `#${log.entity_id.slice(0, 8)}` : ''}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700">{log.user_email || (log.actor_id ? log.actor_id.slice(0, 8) : 'System')}</td>
                  <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                    {log.data_json || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
