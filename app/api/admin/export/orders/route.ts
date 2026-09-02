import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatCsv } from '@/lib/csv';

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orders = await db.prepare(`
    SELECT order_number, placed_at, email, status,
           subtotal_cents, discount_cents, shipping_cents, tax_cents, total_cents,
           coupon_code, shipping_method
    FROM orders
    ORDER BY placed_at DESC
  `).all() as any[];

  const headers = [
    'Order Number',
    'Placed At',
    'Customer Email',
    'Status',
    'Subtotal (ZAR)',
    'Discount (ZAR)',
    'Shipping (ZAR)',
    'Tax (ZAR)',
    'Total (ZAR)',
    'Coupon Code',
    'Shipping Method',
  ];

  const rows = orders.map(o => [
    o.order_number,
    o.placed_at,
    o.email,
    o.status,
    (o.subtotal_cents / 100).toFixed(2),
    (o.discount_cents / 100).toFixed(2),
    (o.shipping_cents / 100).toFixed(2),
    (o.tax_cents / 100).toFixed(2),
    (o.total_cents / 100).toFixed(2),
    o.coupon_code || '',
    o.shipping_method,
  ]);

  const csv = formatCsv(headers, rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="orders-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
