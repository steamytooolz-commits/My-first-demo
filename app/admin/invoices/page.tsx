import Link from 'next/link';
import { db } from '@/lib/db';
import { formatZar } from '@/lib/money';
import { Download, FileText, Eye } from 'lucide-react';

export default async function AdminInvoicesPage() {
  const invoices = await db.prepare(`
    SELECT i.*, o.order_number, o.email as customer_email
    FROM invoices i
    JOIN orders o ON i.order_id = o.id
    ORDER BY i.created_at DESC
  `).all() as any[];

  return (
    <div className="space-y-6">
      {/* Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-slate-900">VAT Tax Invoices</h1>
          <p className="text-xs text-slate-500 mt-1">Official South African Value-Added Tax compliant invoices and audit copies.</p>
        </div>

        <a
          href="/api/admin/export/invoices"
          download
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <Download className="h-4 w-4 text-slate-500" />
          <span>Export Invoices CSV</span>
        </a>
      </div>

      {/* Invoices Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
            <tr>
              <th className="py-3 px-4">Invoice #</th>
              <th className="py-3 px-4">Order #</th>
              <th className="py-3 px-4">Customer Email</th>
              <th className="py-3 px-4">Issue Date</th>
              <th className="py-3 px-4">Due Date</th>
              <th className="py-3 px-4 text-right">Total (Incl VAT)</th>
              <th className="py-3 px-4 text-right">Paid</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-slate-50/50">
                <td className="py-3 px-4 font-mono font-bold text-teal-800">
                  <Link href={`/invoices/${inv.invoice_number}`} target="_blank" className="hover:underline">
                    {inv.invoice_number}
                  </Link>
                </td>
                <td className="py-3 px-4 font-medium text-slate-800">#{inv.order_number}</td>
                <td className="py-3 px-4 text-slate-600">{inv.customer_email}</td>
                <td className="py-3 px-4 text-slate-500">{inv.issue_date}</td>
                <td className="py-3 px-4 text-slate-500">{inv.due_date}</td>
                <td className="py-3 px-4 text-right font-bold text-slate-900">{formatZar(inv.total_cents)}</td>
                <td className="py-3 px-4 text-right text-emerald-700">{formatZar(inv.amount_paid_cents)}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <Link
                    href={`/invoices/${inv.invoice_number}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 font-semibold text-teal-800 hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Print</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
