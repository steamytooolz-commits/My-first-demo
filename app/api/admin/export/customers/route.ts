import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatCsv } from '@/lib/csv';

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const customers = await db.prepare(`
    SELECT u.id, u.email, u.full_name, u.phone, u.role, u.status,
           u.poia_processing_consent_at, u.marketing_consent, u.created_at,
           (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) as order_count
    FROM users u
    ORDER BY u.created_at DESC
  `).all() as any[];

  const headers = [
    'User ID',
    'Full Name',
    'Email Address',
    'Phone',
    'Role',
    'Status',
    'POPIA Processing Consented At',
    'Marketing Consent',
    'Total Orders',
    'Registered At',
  ];

  const rows = customers.map(c => [
    c.id,
    c.full_name,
    c.email,
    c.phone || '',
    c.role,
    c.status,
    c.poia_processing_consent_at || 'Not Consented',
    c.marketing_consent === 1 ? 'Opted In' : 'No',
    c.order_count,
    c.created_at,
  ]);

  const csv = formatCsv(headers, rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="customers-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
