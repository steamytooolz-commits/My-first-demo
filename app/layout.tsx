import type {Metadata} from 'next';
import './globals.css'; // Global styles
import WhatsAppButton from '@/components/WhatsAppButton';
import { getStoreSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  let name = 'Paper & Quill Stationery';
  try {
    const s = await getStoreSettings();
    if (s.store_name) name = s.store_name;
  } catch {}
  const description = `${name} — fine pens, journals and desk essentials. Live demo storefront with cart, checkout, VAT invoices and admin.`;
  return {
    title: name,
    description,
    openGraph: { title: name, description, type: 'website' },
    twitter: { card: 'summary_large_image', title: name, description },
  };
}

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-teal-100 selection:text-teal-900" suppressHydrationWarning>
        {children}
        <WhatsAppButton />
      </body>
    </html>
  );
}
