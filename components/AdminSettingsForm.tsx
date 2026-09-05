'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Landmark, Truck, MessageCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { adminSaveSettingsAction } from '@/app/actions/admin';
import type { StoreSettings } from '@/lib/settings';

export default function AdminSettingsForm({ initial }: { initial: StoreSettings }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSavedAt(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await adminSaveSettingsAction(null, formData);
      if (!res.success) {
        setError(res.error || 'Could not save settings.');
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 text-xs">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 font-medium text-rose-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {savedAt && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Settings saved at {savedAt} — storefront, cart and checkout update immediately.</span>
        </div>
      )}
      {/* Business Identity */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-serif text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
          <Store className="h-4 w-4 text-teal-800" />
          <span>Store Identity &amp; SARS VAT</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Store Legal Name *</label>
            <input name="store_name" required defaultValue={initial.store_name} className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">SARS VAT Registration Number</label>
            <input name="vat_number" defaultValue={initial.vat_number} placeholder="4910284719" className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Contact / Support Email *</label>
            <input name="contact_email" type="email" required defaultValue={initial.contact_email} className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Support Phone *</label>
            <input name="phone" required defaultValue={initial.phone} className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Address Line 1</label>
            <input name="address_line1" defaultValue={initial.address_line1} className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Address Line 2</label>
            <input name="address_line2" defaultValue={initial.address_line2 || ''} className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">City</label>
            <input name="city" defaultValue={initial.city} className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Province</label>
              <input name="province" defaultValue={initial.province || 'Gauteng'} className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Postal Code</label>
              <input name="postal_code" defaultValue={initial.postal_code || '2001'} className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="tax_enabled" name="tax_enabled" defaultChecked={initial.tax_enabled} className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700" />
            <label htmlFor="tax_enabled" className="font-semibold text-slate-700 cursor-pointer">
              Enable VAT Calculation ({initial.tax_rate_percent}% SARS standard)
            </label>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">VAT Rate (%)</label>
            <input name="tax_rate_percent" type="number" step="0.1" defaultValue={initial.tax_rate_percent} className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
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
            <input name="bank_name" defaultValue={initial.bank_name} className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Account Holder Name</label>
            <input name="bank_account_name" defaultValue={initial.bank_account_name} className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Account Number</label>
            <input name="bank_account_number" defaultValue={initial.bank_account_number} className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Branch Code</label>
            <input name="bank_branch_code" defaultValue={initial.bank_branch_code} className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">Reference Instructions</label>
            <input name="bank_reference_note" defaultValue={initial.bank_reference_note} className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none" />
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
            <input type="checkbox" id="whatsapp_enabled" name="whatsapp_enabled" defaultChecked={initial.whatsapp_enabled} className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700" />
            <label htmlFor="whatsapp_enabled" className="font-semibold text-slate-700 cursor-pointer">
              Enable WhatsApp chat button
            </label>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">WhatsApp Number</label>
            <input name="whatsapp_number" defaultValue={initial.whatsapp_number || ''} placeholder="27820000000" inputMode="tel" className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
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
            <input name="standard_base_rand" type="number" step="0.01" defaultValue={(initial.standard_base_cents / 100).toFixed(2)} className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Free Shipping Threshold (Rand)</label>
            <input name="free_shipping_threshold_rand" type="number" step="0.01" defaultValue={(initial.free_shipping_threshold_cents / 100).toFixed(2)} className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Express Delivery (Rand)</label>
            <input name="express_base_rand" type="number" step="0.01" defaultValue={(initial.express_base_cents / 100).toFixed(2)} className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Heavy Parcel Over (grams)</label>
            <input name="weight_threshold_g" type="number" step="1" defaultValue={initial.weight_threshold_g} className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Heavy Surcharge Std (Rand)</label>
            <input name="weight_surcharge_rand" type="number" step="0.01" defaultValue={(initial.weight_surcharge_cents / 100).toFixed(2)} className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Heavy Surcharge Express (Rand)</label>
            <input name="express_weight_surcharge_rand" type="number" step="0.01" defaultValue={(initial.express_weight_surcharge_cents / 100).toFixed(2)} className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="free_shipping_enabled" name="free_shipping_enabled" defaultChecked={initial.free_shipping_enabled} className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700" />
            <label htmlFor="free_shipping_enabled" className="font-semibold text-slate-700 cursor-pointer">
              Enable Free Shipping on qualifying orders
            </label>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Invoice Prefix</label>
            <input name="invoice_prefix" defaultValue={initial.invoice_prefix || 'INV'} className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Order Prefix</label>
            <input name="order_prefix" defaultValue={initial.order_prefix || 'ORD'} className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Low Stock Warning Threshold</label>
            <input name="low_stock_threshold" type="number" defaultValue={initial.low_stock_threshold} className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Invoice Payment Due Days</label>
            <input name="invoice_due_days" type="number" defaultValue={initial.invoice_due_days} className="w-full rounded-lg border border-slate-200 p-2 font-mono focus:border-teal-700 focus:outline-none" />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-xl bg-teal-800 px-6 py-3 font-semibold text-white shadow-sm hover:bg-teal-900 transition-colors disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save All Store Settings'}
      </button>
    </form>
  );
}
