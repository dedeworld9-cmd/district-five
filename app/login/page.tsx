import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Brand, Footer } from '@/components/ui';
import { getSession } from '@/lib/session';
import { devLoginEnabled } from '@/lib/supabase/env';
import { signInWithDiscord } from './actions';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (await getSession()) redirect(sp.next?.startsWith('/hub') ? sp.next : '/hub');
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-4">
      <div className="pt-8"><Brand /></div>
      <div className="flex flex-1 flex-col justify-center py-16">
        <div className="label mb-4 flex items-center gap-2"><span className="gold-dot" />Members</div>
        <h1 className="text-[32px] font-semibold tracking-tight">Sign in to the hub</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Use the Discord account you use in the BCSO or SAHP servers. Your roster entry links to it automatically.
        </p>
        {sp.error && <p role="alert" className="mt-6 rounded-xl border border-bad/30 px-4 py-3 text-[14px] text-bad">{sp.error}</p>}
        <form action={signInWithDiscord} className="mt-8">
          <input type="hidden" name="next" value={sp.next ?? '/hub'} />
          <button className="btn-primary w-full">Continue with Discord</button>
        </form>
        {devLoginEnabled() && (
          <Link href="/dev-login" className="btn mt-3 w-full">Local test personas</Link>
        )}
        <Link href="/" className="mt-8 text-center text-[13px] text-muted hover:text-ink">Back to the public site</Link>
      </div>
      <Footer />
    </main>
  );
}
