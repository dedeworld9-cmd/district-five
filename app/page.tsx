import Link from 'next/link';
import { Brand, Footer } from '@/components/ui';
import { DIVISION_LABEL, relative } from '@/lib/format';
import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Announcement, Department } from '@/lib/types';

export default async function Home() {
  const supabase = await createClient();
  const [session, { data: departments }, { data: news }] = await Promise.all([
    getSession(),
    supabase.from('departments').select('*').order('sort_order').returns<Department[]>(),
    // Row-level security returns only posts a department head or division command approved for the public.
    supabase.from('announcements').select('id,title,body,scope,department_key,published_at')
      .eq('status', 'published').eq('is_public', true).order('published_at', { ascending: false }).limit(3).returns<Announcement[]>(),
  ]);
  const all = departments ?? [];
  // One section per division that has departments, each naming the command that oversees it.
  const divisions = (['leo', 'fire_ems', 'dispatch'] as const).map((div) => ({
    key: div,
    depts: all.filter((d) => d.kind === 'department' && d.division === div),
    command: all.find((d) => d.kind === 'oversight' && d.oversees.includes(div)),
  })).filter((g) => g.depts.length);
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
          <div className="label mb-5 flex items-center gap-2"><span className="gold-dot" />PS5 roleplay community</div>
          <h1 className="max-w-3xl text-[42px] leading-[1.05] font-semibold tracking-tight sm:text-[64px]">
            District Five Departments Hub
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted">
            One place for District Five&apos;s law enforcement and Fire/EMS departments to log shifts,
            run their rosters and stay briefed.
          </p>
          <div className="mt-9 flex flex-wrap gap-2">
            <Link href={session ? '/hub' : '/login'} className="btn-primary">{session ? 'Open the hub' : 'Sign in with Discord'}</Link>
            <a href="#departments" className="btn">The departments</a>
          </div>
        </section>

        <div id="departments" className="grid gap-14">
          {divisions.map((g) => (
            <section key={g.key}>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="label">{DIVISION_LABEL[g.key]}</h2>
                {g.command && <span className="text-[13px] text-faint">Overseen by {g.command.name}</span>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {g.depts.map((d) => (
                  <div key={d.key} className="card p-7">
                    <div className="label">{d.short_name}</div>
                    <h3 className="mt-3 text-[22px] font-semibold tracking-tight">{d.name}</h3>
                    <p className="mt-2 text-[15px] text-muted">{d.public_blurb ?? d.tagline}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

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
