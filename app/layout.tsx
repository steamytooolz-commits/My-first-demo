import type {Metadata} from 'next';
import './globals.css'; // Global styles
import WhatsAppButton from '@/components/WhatsAppButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Paper & Quill Stationery',
  description: 'A complete, production-ready stationery online store featuring storefront browsing, cart, checkout simulation, customer portal, invoicing, POPIA compliance, and admin dashboard.',
  openGraph: {
    title: 'Paper & Quill Stationery',
    description: 'A complete, production-ready stationery online store featuring storefront browsing, cart, checkout simulation, customer portal, invoicing, POPIA compliance, and admin dashboard.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Paper & Quill Stationery',
    description: 'A complete, production-ready stationery online store featuring storefront browsing, cart, checkout simulation, customer portal, invoicing, POPIA compliance, and admin dashboard.',
  },
};

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
