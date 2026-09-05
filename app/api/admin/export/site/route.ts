import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { exportSiteData } from '@/lib/site-transfer';

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const doc = await exportSiteData();
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(doc), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="paper-quill-site-export-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
