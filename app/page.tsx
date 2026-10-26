import Link from 'next/link';
import { Brand, Footer } from '@/components/ui';
import { relative } from '@/lib/format';
import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Announcement, Department } from '@/lib/types';

export default async function Home() {
  const supabase = await createClient();
  const [session, { data: departments }, { data: news }] = await Promise.all([
    getSession(),
    supabase.from('departments').select('*').order('sort_order').returns<Department[]>(),
    // Row-level security returns only posts a department head or DPS approved for the public.
    supabase.from('announcements').select('id,title,body,scope,department_key,published_at')
      .eq('status', 'published').eq('is_public', true).order('published_at', { ascending: false }).limit(3).returns<Announcement[]>(),
  ]);
  const depts = (departments ?? []).filter((d) => d.kind === 'department');
  const dps = (departments ?? []).find((d) => d.kind === 'oversight');
  const short = (k: string | null) => (k ? departments?.find((d) => d.key === k)?.short_name ?? k : 'District');

  return (
    <div className="min-h-screen">
      <header className="px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-line bg-surface/85 py-1.5 pr-1.5 pl-4">
          <Brand />
          <Link href={session ? '/hub' : '/login'} className="btn-primary btn-sm">{session ? 'Open the hub' : 'Member sign in'}</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="pt-24 pb-20 sm:pt-32">
          <div className="label mb-5 flex items-center gap-2"><span className="gold-dot" />PS5 law enforcement roleplay</div>
          <h1 className="max-w-3xl text-[42px] leading-[1.05] font-semibold tracking-tight sm:text-[64px]">
            District Five Law Enforcement Hub
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted">
            One place for the Blaine County Sheriff&apos;s Office and the San Andreas Highway Patrol to log patrols,
            run their rosters and stay briefed, under the {dps?.name ?? 'Department of Public Safety'}.
          </p>
          <div className="mt-9 flex flex-wrap gap-2">
            <Link href={session ? '/hub' : '/login'} className="btn-primary">{session ? 'Open the hub' : 'Sign in with Discord'}</Link>
            <a href="#departments" className="btn">The departments</a>
          </div>
        </section>

        <section id="departments" className="grid gap-3 sm:grid-cols-2">
          {depts.map((d) => (
            <div key={d.key} className="card p-7">
              <div className="label">{d.short_name}</div>
              <h2 className="mt-3 text-[22px] font-semibold tracking-tight">{d.name}</h2>
              <p className="mt-2 text-[15px] text-muted">{d.public_blurb ?? d.tagline}</p>
            </div>
          ))}
        </section>
        {dps && (
          <p className="mt-4 text-[14px] text-muted">
            <span className="text-ink">{dps.short_name}</span> oversees both departments and sets district-wide policy.
          </p>
        )}

        {!!news?.length && (
          <section className="mt-24">
            <h2 className="label mb-5">News</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {news.map((a) => (
                <article key={a.id} className="card p-6">
                  <div className="text-[12px] text-faint">{a.scope === 'district' ? 'District Five' : short(a.department_key)} · {a.published_at ? relative(a.published_at) : ''}</div>
                  <h3 className="mt-2 text-[16px] font-medium">{a.title}</h3>
                  <p className="mt-2 line-clamp-4 text-[14px] leading-relaxed text-muted">{a.body}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="mt-24 card flex flex-wrap items-center justify-between gap-6 p-8">
          <div>
            <h2 className="text-[22px] font-semibold tracking-tight">Joining</h2>
            <p className="mt-2 max-w-lg text-[15px] text-muted">
              Applications and recruitment run through each department&apos;s Discord. Once you are accepted, sign in here with the same Discord account.
            </p>
          </div>
          <Link href="/login" className="btn">Member sign in</Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
