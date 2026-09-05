import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { generateCustomerExport } from '@/lib/privacy';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await checkRateLimit(`export:${user.id}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many export requests. Try again later.' }, { status: 429 });
  }

  const exportData = await generateCustomerExport(user.id);
  const jsonString = JSON.stringify(exportData, null, 2);

  return new NextResponse(jsonString, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Content-Disposition': 'attachment; filename="paper-and-quill-data-export.json"',
    },
  });
}
