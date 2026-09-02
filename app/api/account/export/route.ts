import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { generateCustomerExport } from '@/lib/privacy';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const exportData = await generateCustomerExport(user.id);
  const jsonString = JSON.stringify(exportData, null, 2);

  return new NextResponse(jsonString, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="paper-and-quill-data-export-${user.id.slice(0, 8)}.json"`,
    },
  });
}
