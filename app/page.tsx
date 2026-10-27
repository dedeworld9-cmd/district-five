import Link from 'next/link';
import { Emblem } from '@/components/Emblem';
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

  const units = divisions.flatMap((g) => g.depts);
  const features = [
    ['Shift logs', 'Clock in, clock out, and send the log to your supervisor in one step.', 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'],
    ['Reports & requests', 'Incidents, use of force, patient care, warrants, BOLOs, leave and training.', 'M9 12h6M9 16h6M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z'],
    ['Live board', 'Who is on duty, active warrants and BOLOs, and the weekly hours board.', 'M3 12h4l3-8 4 16 3-8h4'],
    ['Roster & command', 'Ranks, certifications, subdivisions and the chain of command.', 'M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19v-1a3 3 0 0 0-2-2.8M4 19v-1a3 3 0 0 1 2-2.8'],
  ] as const;

  return (
    <div className="min-h-screen overflow-x-hidden">
      <section className="relative isolate">
        <div className="lightbar absolute inset-x-0 top-0 z-10" />
        <div className="hero-grid absolute inset-0 -z-10" />
        <div className="glow glow-red -z-10 top-24 left-[8%] h-72 w-72 sm:h-96 sm:w-96" />
        <div className="glow glow-blue -z-10 top-24 right-[8%] h-72 w-72 sm:h-96 sm:w-96" />

        <header className="relative z-20 px-3 pt-3 sm:px-6 sm:pt-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-line bg-surface/70 py-1.5 pr-1.5 pl-4 backdrop-blur-md">
            <Brand />
            <Link href={session ? '/hub' : '/login'} className="btn-primary btn-sm">{session ? 'Open the hub' : 'Member sign in'}</Link>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-4 pt-20 pb-24 text-center sm:px-6 sm:pt-28 sm:pb-32">
          <div className="rise inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/60 px-3.5 py-1.5 text-[12px] text-muted backdrop-blur">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-ok" />The Lounge Roleplay<span className="hidden sm:inline"> · Law enforcement · Fire &amp; EMS</span>
          </div>
          <h1 className="rise wordmark mx-auto mt-8 text-[56px] leading-[0.95] font-bold tracking-[-0.04em] sm:text-[104px]" style={{ animationDelay: '80ms' }}>
            District Five
          </h1>
          <p className="rise mt-4 text-[13px] font-semibold tracking-[0.32em] text-gold uppercase sm:text-[14px]" style={{ animationDelay: '160ms' }}>
            Departments Hub
          </p>
          <p className="rise mx-auto mt-7 max-w-xl text-[17px] leading-relaxed text-muted" style={{ animationDelay: '240ms' }}>
            Every shift, report and roster for District Five&apos;s departments, in one place.
          </p>
          <div className="rise mt-10 flex flex-wrap justify-center gap-2" style={{ animationDelay: '320ms' }}>
            <Link href={session ? '/hub' : '/login'} className="btn-primary !h-11 !px-6">{session ? 'Open the hub' : 'Sign in with Discord'}</Link>
            <a href="#departments" className="btn !h-11 !px-6 backdrop-blur">Meet the departments</a>
          </div>

          {units.length > 0 && (
            <div className="rise mt-14 flex flex-wrap items-center justify-center gap-x-5 gap-y-4 sm:mt-16 sm:gap-x-8" style={{ animationDelay: '420ms' }}>
              {units.map((d) => (
                <a key={d.key} href={`#${d.key}`} className="flex items-center gap-2.5 opacity-80 transition-opacity hover:opacity-100">
                  <Emblem dept={d.key} label={d.short_name} accent={d.accent} division={d.division} size={40} />
                  <span className="hidden text-left text-[12px] leading-tight text-muted sm:inline">{d.name.split(' ').slice(0, -1).join(' ')}<br /><span className="text-ink">{d.name.split(' ').slice(-1)}</span></span>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <div id="departments" className="grid scroll-mt-8 gap-16">
          {divisions.map((g) => (
            <section key={g.key}>
              <div className="mb-5 flex flex-wrap items-end justify-between gap-2 border-b border-line pb-4">
                <h2 className="text-[26px] font-semibold tracking-tight">{DIVISION_LABEL[g.key]}</h2>
                {g.command && <span className="text-[13px] text-faint">Overseen by <span className="text-muted">{g.command.name}</span></span>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {g.depts.map((d) => (
                  <div key={d.key} id={d.key} className="dept-card card relative scroll-mt-24 overflow-hidden p-7"
                    style={{ '--accent': d.accent } as React.CSSProperties}>
                    <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${d.accent}, transparent)` }} />
                    <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full opacity-[0.10] blur-3xl" style={{ background: d.accent }} />
                    <div className="relative flex items-start gap-5">
                      <Emblem dept={d.key} label={d.short_name} accent={d.accent} division={d.division} size={64} />
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: d.accent }}>{d.short_name}</div>
                        <h3 className="mt-1.5 text-[21px] leading-snug font-semibold tracking-tight">{d.name}</h3>
                        <p className="mt-2 text-[15px] leading-relaxed text-muted">{d.public_blurb ?? d.tagline}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-28">
          <div className="mb-8 max-w-xl">
            <div className="label mb-3">Inside the hub</div>
            <h2 className="text-[30px] leading-tight font-semibold tracking-tight">Built for the shift, not the paperwork.</h2>
          </div>
          <div className="grid gap-px overflow-hidden rounded-[18px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {features.map(([title, body, icon]) => (
              <div key={title} className="bg-surface p-6">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg>
                </span>
                <h3 className="mt-4 text-[15px] font-medium">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {!!news?.length && (
          <section className="mt-28">
            <h2 className="label mb-5">Latest news</h2>
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

        <section className="relative mt-28 overflow-hidden rounded-[22px] border border-line-strong p-8 sm:p-12">
          <div className="glow glow-red -z-10 -bottom-32 -left-20 h-64 w-64 !opacity-20" />
          <div className="glow glow-blue -z-10 -top-32 -right-20 h-64 w-64 !opacity-20" />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className="text-[28px] font-semibold tracking-tight">Want to join?</h2>
              <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-muted">
                Applications and recruitment run through each department&apos;s Discord. Once you are accepted, sign in here with the same Discord account.
              </p>
            </div>
            <Link href="/login" className="btn-primary !h-11 !px-6">Member sign in</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
