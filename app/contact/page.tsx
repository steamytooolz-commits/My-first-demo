import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ContactForm from '@/components/ContactForm';
import { getStoreSettings } from '@/lib/settings';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';

export default function ContactPage() {
  const settings = await getStoreSettings();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-slate-900">Contact Customer Care</h1>
          <p className="text-xs text-slate-500 mt-1">We are here to assist with orders, corporate stationery inquiries, and South African VAT invoices.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 space-y-6 text-xs text-slate-700 shadow-sm">
            <h2 className="font-serif text-base font-bold text-slate-900">Direct Contact</h2>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-teal-800 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Email Inquiries</p>
                  <a href={`mailto:${settings.contact_email}`} className="text-teal-800 hover:underline">
                    {settings.contact_email}
                  </a>
                </div>
              </div>

              {settings.phone ? (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-teal-800 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-slate-900">Customer Support Phone</p>
                    <p>{settings.phone}</p>
                  </div>
                </div>
              ) : null}

              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-teal-800 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Physical Studio Address</p>
                  <p>{settings.address_line1}</p>
                  <p>{settings.city}, South Africa</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-teal-800 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Operating Hours</p>
                  <p>Monday – Friday: 08:30 – 17:00 SAST</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 space-y-4 text-xs shadow-sm">
            <h2 className="font-serif text-base font-bold text-slate-900">Send an Inquiry</h2>
            <ContactForm />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
