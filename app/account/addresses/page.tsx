import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { saveAddressAction, deleteAddressAction, setDefaultAddressAction } from '@/app/actions/addresses';
import ActionForm from '@/components/ActionForm';
import { Trash2 } from 'lucide-react';

export default async function CustomerAddressesPage() {
  const user = await requireUser();

  const addresses = await db.prepare(`
    SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, rowid DESC
  `).all(user.id) as any[];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="font-serif text-xl font-bold text-slate-900">Saved Delivery Addresses</h2>
            <p className="text-xs text-slate-500 mt-0.5">Manage South African shipping locations for one-click checkout.</p>
          </div>
        </div>

        {addresses.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">No saved addresses found. Add your first delivery address below.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {addresses.map(addr => (
              <div key={addr.id} className="rounded-xl border border-slate-200 p-4 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">{addr.label}</span>
                  {addr.is_default === 1 && (
                    <span className="rounded bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                      Default Address
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">{addr.full_name}</p>
                  <p>{addr.line1}</p>
                  {addr.line2 && <p>{addr.line2}</p>}
                  <p>{addr.city}, {addr.province} {addr.postal_code}</p>
                  {addr.phone ? <p className="text-slate-500 pt-1">Phone: {addr.phone}</p> : null}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  {addr.is_default !== 1 && (
                    <ActionForm action={async () => {
                      'use server';
                      return setDefaultAddressAction(addr.id);
                    }}>
                      <button type="submit" className="text-[11px] font-medium text-teal-800 hover:underline">
                        Set as Default
                      </button>
                    </ActionForm>
                  )}

                  <ActionForm action={async () => {
                    'use server';
                    return deleteAddressAction(addr.id);
                  }} className="ml-auto">
                    <button type="submit" className="text-[11px] text-rose-600 hover:underline flex items-center gap-1">
                      <Trash2 className="h-3 w-3" />
                      <span>Delete</span>
                    </button>
                  </ActionForm>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add New Address Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h3 className="font-serif text-base font-bold text-slate-900">Add New Address</h3>

        <ActionForm action={async (formData: FormData) => {
          'use server';
          return saveAddressAction(null, formData);
        }} successMessage="Address saved." className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Address Label</label>
            <input
              name="label"
              required
              defaultValue="Home"
              placeholder="e.g. Home, Office, Studio"
              className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Recipient Name *</label>
            <input
              name="full_name"
              required
              defaultValue={user.full_name || ''}
              className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Contact Phone</label>
            <input
              name="phone"
              defaultValue={user.phone || ''}
              placeholder="e.g. 082 000 0000"
              className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Street Address *</label>
            <input
              name="line1"
              required
              placeholder="Unit / Building, Street number and name"
              className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Suburb / Line 2</label>
            <input
              name="line2"
              placeholder="Apartment, suite, or suburb"
              className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">City *</label>
            <input
              name="city"
              required
              placeholder="Johannesburg"
              className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Province *</label>
            <select
              name="province"
              required
              defaultValue="Gauteng"
              className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
            >
              <option value="Gauteng">Gauteng</option>
              <option value="Western Cape">Western Cape</option>
              <option value="KwaZulu-Natal">KwaZulu-Natal</option>
              <option value="Eastern Cape">Eastern Cape</option>
              <option value="Free State">Free State</option>
              <option value="Mpumalanga">Mpumalanga</option>
              <option value="Limpopo">Limpopo</option>
              <option value="North West">North West</option>
              <option value="Northern Cape">Northern Cape</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Postal Code *</label>
            <input
              name="postal_code"
              required
              placeholder="2194"
              className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="is_default"
              name="is_default"
              className="h-4 w-4 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
            />
            <label htmlFor="is_default" className="text-slate-700 cursor-pointer">
              Set as my default delivery address
            </label>
          </div>

          <div className="sm:col-span-2 pt-2">
            <button
              type="submit"
              className="rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white hover:bg-teal-900 transition-colors"
            >
              Save Address
            </button>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
