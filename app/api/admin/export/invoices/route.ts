import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatCsv } from '@/lib/csv';

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const invoices = await db.prepare(`
    SELECT i.invoice_number, o.order_number, i.status, i.issue_date, i.due_date,
           i.total_cents, i.amount_paid_cents
    FROM invoices i
    JOIN orders o ON i.order_id = o.id
    ORDER BY i.created_at DESC
  `).all() as any[];

  const headers = [
    'Invoice Number',
    'Order Number',
    'Status',
    'Issue Date',
    'Due Date',
    'Total (ZAR)',
    'Amount Paid (ZAR)',
    'Balance Due (ZAR)',
  ];

  const rows = invoices.map(inv => {
    const balance = Math.max(0, inv.total_cents - inv.amount_paid_cents);
    return [
      inv.invoice_number,
      inv.order_number,
      inv.status,
      inv.issue_date,
      inv.due_date,
      (inv.total_cents / 100).toFixed(2),
      (inv.amount_paid_cents / 100).toFixed(2),
      (balance / 100).toFixed(2),
    ];
  });

  const csv = formatCsv(headers, rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="invoices-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
