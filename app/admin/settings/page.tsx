import { getStoreSettings } from '@/lib/settings';
import { adminSaveSettingsAction } from '@/app/actions/admin';
import { Store, Landmark, Truck, MessageCircle } from 'lucide-react';

export default async function AdminSettingsPage() {
  const settings = await getStoreSettings();

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="font-serif text-3xl font-bold text-slate-900">Store Settings &amp; Compliance</h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure South African VAT registration, EFT banking details, shipping rates, and store metadata.
        </p>
      </div>

      <form action={async (formData: FormData) => {
        'use server';
        await adminSaveSettingsAction(null, formData);
      }} className="space-y-8 text-xs">
        {/* Business Identity */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-serif text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Store className="h-4 w-4 text-teal-800" />
            <span>Store Identity &amp; SARS VAT</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Store Legal Name *</label>
              <input
                name="store_name"
                required
                defaultValue={settings.store_name}
                className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">SARS VAT Registration Number</label>
              <input
                name="vat_number"
                defaultValue={settings.vat_number}
                placeholder="4910284719"
                className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact / Support Email *</label>
              <input
                name="contact_email"
                type="email"
                required
                defaultValue={settings.contact_email}
                className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Support Phone *</label>
              <input
                name="phone"
                required
                defaultValue={settings.phone}
                className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Address Line 1</label>
              <input
                name="address_line1"
                defaultValue={settings.address_line1}
                className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Address Line 2</label>
              <input
                name="address_line2"
                defaultValue={settings.address_line2 || ''}
                className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">City</label>
              <input
                name="city"
                defaultValue={settings.city}
                className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Province</label>
                <input
                  name="province"
                  defaultValue={settings.province || 'Gauteng'}
                  className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Postal Code</label>
                <input
                  name="postal_code"
                  defaultValue={settings.postal_code || '2001'}
                  className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="tax_enabled"
                name="tax_enabled"
                defaultChecked={settings.tax_enabled}
                className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
              />
              <label htmlFor="tax_enabled" className="font-semibold text-slate-700 cursor-pointer">
                Enable VAT Calculation ({settings.tax_rate_percent}% SARS standard)
              </label>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">VAT Rate (%)</label>
              <input
                name="tax_rate_percent"
                type="number"
                step="0.1"
                defaultValue={settings.tax_rate_percent}
                className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* EFT Banking Details */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-serif text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Landmark className="h-4 w-4 text-teal-800" />
            <span>Manual EFT Banking Information</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
              <input
                name="bank_name"
                defaultValue={settings.bank_name}
                className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Holder Name</label>
              <input
                name="bank_account_name"
                defaultValue={settings.bank_account_name}
                className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Account Number</label>
              <input
                name="bank_account_number"
                defaultValue={settings.bank_account_number}
                className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Branch Code</label>
              <input
                name="bank_branch_code"
                defaultValue={settings.bank_branch_code}
                className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Reference Instructions</label>
              <input
                name="bank_reference_note"
                defaultValue={settings.bank_reference_note}
                className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* WhatsApp Order Help */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-serif text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <MessageCircle className="h-4 w-4 text-teal-800" />
            <span>WhatsApp Order Help</span>
          </h2>
          <p className="text-[11px] text-slate-500">
            Shows a floating WhatsApp chat button on every store page. Use international format without + or spaces, e.g. 27820000000.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="whatsapp_enabled"
                name="whatsapp_enabled"
                defaultChecked={settings.whatsapp_enabled}
                className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
              />
              <label htmlFor="whatsapp_enabled" className="font-semibold text-slate-700 cursor-pointer">
                Enable WhatsApp chat button
              </label>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">WhatsApp Number</label>
              <input
                name="whatsapp_number"
                defaultValue={settings.whatsapp_number || ''}
                placeholder="27820000000"
                inputMode="tel"
                className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Shipping & Thresholds */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="font-serif text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <Truck className="h-4 w-4 text-teal-800" />
            <span>Shipping Fees &amp; Order Policies</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Standard Delivery (Rand)</label>
              <input
                name="standard_base_rand"
                type="number"
                step="0.01"
                defaultValue={(settings.standard_base_cents / 100).toFixed(2)}
                className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Free Shipping Threshold (Rand)</label>
              <input
                name="free_shipping_threshold_rand"
                type="number"
                step="0.01"
                defaultValue={(settings.free_shipping_threshold_cents / 100).toFixed(2)}
                className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Express Delivery (Rand)</label>
              <input
                name="express_base_rand"
                type="number"
                step="0.01"
                defaultValue={(settings.express_base_cents / 100).toFixed(2)}
                className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="free_shipping_enabled"
                name="free_shipping_enabled"
                defaultChecked={settings.free_shipping_enabled}
                className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
              />
              <label htmlFor="free_shipping_enabled" className="font-semibold text-slate-700 cursor-pointer">
                Enable Free Shipping on qualifying orders
              </label>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Invoice Prefix</label>
              <input
                name="invoice_prefix"
                defaultValue={settings.invoice_prefix || 'INV'}
                className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Order Prefix</label>
              <input
                name="order_prefix"
                defaultValue={settings.order_prefix || 'ORD'}
                className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Low Stock Warning Threshold</label>
              <input
                name="low_stock_threshold"
                type="number"
                defaultValue={settings.low_stock_threshold}
                className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Invoice Payment Due Days</label>
              <input
                name="invoice_due_days"
                type="number"
                defaultValue={settings.invoice_due_days}
                className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="rounded-xl bg-teal-800 px-6 py-3 font-semibold text-white shadow-sm hover:bg-teal-900 transition-colors"
        >
          Save All Store Settings
        </button>
      </form>
    </div>
  );
}
