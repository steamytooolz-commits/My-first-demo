import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import LoginFormClient from '@/components/LoginFormClient';

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirectTo } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="mx-auto max-w-md flex-1 px-4 py-16 sm:px-6 w-full">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-center mb-6">
            <h1 className="font-serif text-2xl font-bold text-slate-900">Sign in to your account</h1>
            <p className="mt-1 text-xs text-slate-500">Access your orders, saved delivery addresses, and invoices.</p>
          </div>

          <LoginFormClient redirectTo={redirectTo || '/account'} />

          <div className="mt-6 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
            Don&apos;t have an account?{' '}
            <Link href={`/auth/register${redirectTo ? `?redirectTo=${redirectTo}` : ''}`} className="font-bold text-teal-800 hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
