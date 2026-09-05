import { getStoreSettings } from '@/lib/settings';
import AdminSettingsForm from '@/components/AdminSettingsForm';

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

      <AdminSettingsForm initial={settings} />
    </div>
  );
}
