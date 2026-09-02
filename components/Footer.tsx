import Link from 'next/link';
import { getStoreSettings } from '@/lib/settings';
import { ShieldCheck, Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  const settings = getStoreSettings();

  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600 text-sm no-print">
      {/* Demo helper banner */}
      <div className="bg-slate-100 border-b border-slate-200 py-2.5 px-4 text-xs text-slate-600 text-center">
        <span className="font-semibold text-slate-800">48-Hour Staging Simulation:</span> Admin: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-900 font-mono">admin@example.com / ChangeMe123!</code> • Customer: <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-900 font-mono">customer@example.com / Customer123!</code>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand Col */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-800 text-white font-serif font-bold text-sm">
                PQ
              </span>
              <span className="font-serif text-lg font-bold text-slate-900">{settings.store_name}</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Curated fine pens, Smyth-sewn journals, and archival desktop stationery designed for mindful makers and professionals across South Africa.
            </p>
            <div className="flex items-center gap-2 text-xs text-teal-800 font-medium">
              <ShieldCheck className="h-4 w-4" />
              <span>POPIA Compliant • Secure Data Handling</span>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">Collections</h4>
            <ul className="mt-4 space-y-2 text-xs">
              <li><Link href="/catalog?category=notebooks-pads" className="hover:text-slate-900">Notebooks &amp; Journals</Link></li>
              <li><Link href="/catalog?category=pens-writing" className="hover:text-slate-900">Fine Writing &amp; Ink</Link></li>
              <li><Link href="/catalog?category=office-supplies" className="hover:text-slate-900">Office &amp; Desk Essentials</Link></li>
              <li><Link href="/catalog?category=art-supplies" className="hover:text-slate-900">Art &amp; Sketching</Link></li>
              <li><Link href="/catalog?category=school-essentials" className="hover:text-slate-900">School Supplies</Link></li>
            </ul>
          </div>

          {/* Customer Support & Privacy */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">Customer Care &amp; POPIA</h4>
            <ul className="mt-4 space-y-2 text-xs">
              <li><Link href="/account" className="hover:text-slate-900">Customer Portal</Link></li>
              <li><Link href="/account/orders" className="hover:text-slate-900">Track Order &amp; Invoices</Link></li>
              <li><Link href="/account/privacy" className="hover:text-slate-900">POPIA Privacy &amp; Data Rights</Link></li>
              <li><Link href="/cart" className="hover:text-slate-900">Cart &amp; Checkout</Link></li>
              <li><Link href="/admin" className="hover:text-slate-900">Store Administration</Link></li>
            </ul>
          </div>

          {/* Contact & Banking Details */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-900">Dispatch &amp; Fulfilment</h4>
            <div className="mt-4 space-y-2.5 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                <span>{settings.address_line1}, {settings.city}, {settings.postal_code}</span>
              </div>
              {settings.phone ? (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                  <span>{settings.phone}</span>
                </div>
              ) : null}
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                <span>{settings.contact_email}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-slate-200 pt-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© {new Date().getFullYear()} {settings.store_name}. All rights reserved.</p>
          <p className="text-slate-400">All prices in South African Rand (ZAR) • Free shipping on orders over R950</p>
        </div>
      </div>
    </footer>
  );
}
