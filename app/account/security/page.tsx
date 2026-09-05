import { requireUser } from '@/lib/auth';
import { changePasswordAction } from '@/app/actions/auth';
import ActionForm from '@/components/ActionForm';

export default async function CustomerSecurityPage() {
  await requireUser();

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
      <div>
        <h2 className="font-serif text-xl font-bold text-slate-900">Security &amp; Password</h2>
        <p className="text-xs text-slate-500 mt-1">Update your password using our secure scrypt hashing protocol.</p>
      </div>

      <ActionForm action={async (formData: FormData) => {
        'use server';
        return changePasswordAction(null, formData);
      }} successMessage="Password changed. Other sessions were signed out." className="max-w-md space-y-4 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 mb-1">Current Password</label>
          <input
            type="password"
            name="current_password"
            required
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">New Password</label>
          <input
            type="password"
            name="new_password"
            required
            placeholder="Min 8 chars, 1 letter, 1 number"
            className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Confirm New Password</label>
          <input
            type="password"
            name="confirm_password"
            required
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-200 p-2 focus:border-teal-700 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="rounded-xl bg-teal-800 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-teal-900 transition-colors"
        >
          Update Password
        </button>
      </ActionForm>
    </div>
  );
}
