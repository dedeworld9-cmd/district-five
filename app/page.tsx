import Link from 'next/link';
import { Emblem } from '@/components/Emblem';
import { PHOTOS } from '@/lib/brand';
import { DIVISION_LABEL, relative } from '@/lib/format';
import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Announcement, Department } from '@/lib/types';

const DISCORD = 'https://discord.gg/32wxGVBa6U';
const DISCORD_ICON = 'M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z';

function DiscordIcon({ size = 16 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={DISCORD_ICON} /></svg>;
}

// In-game photos from the TLRP training slides.
const GALLERY = [
  { src: '/photos/tactical-team.jpg', caption: 'Tactical operations' },
  { src: '/photos/academy.jpg', caption: 'Academy formation' },
  { src: '/photos/traffic-stop.jpg', caption: 'High-risk stop' },
  { src: '/photos/skyline.jpg', caption: 'Field training' },
  { src: '/photos/entry-team.jpg', caption: 'Building entry' },
];

function Arrow() {
  return <span aria-hidden="true">→</span>;
}

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
  const units = all.filter((d) => d.kind === 'department');
  const command = (div: Department['division']) => all.find((d) => d.kind === 'oversight' && d.oversees.includes(div));
  const short = (k: string | null) => (k ? all.find((d) => d.key === k)?.short_name ?? k : 'District Five');
  // Signed-out visitors sign in with Discord first, then land on the join form.
  const joinHref = (k?: string) => {
    const next = k ? `/hub/join?dept=${k}` : '/hub/join';
    return session ? next : `/login?next=${encodeURIComponent(next)}`;
  };
  const hubHref = session ? '/hub' : '/login';

  const actions = [
    { title: 'Join the Discord', body: 'Connect with District Five, get updates, and reach recruitment, support and department channels.',
      href: DISCORD, cta: 'Join Discord', external: true, tone: 'text-[#5865f2] bg-[#5865f2]/10 border-[#5865f2]/25', icon: <DiscordIcon size={18} /> },
    { title: 'Apply today', body: 'Sign in with Discord, pick a department and give command your roleplay name. Keep your DMs open for the interview.',
      href: joinHref(), cta: 'Apply today', tone: 'text-[#a78bfa] bg-[#a78bfa]/10 border-[#a78bfa]/25',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M15 19v-1a4 4 0 0 0-8 0v1M11 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 8v6M22 11h-6" /></svg> },
    { title: session ? 'Open the hub' : 'Member sign in', body: 'Start your shift, file reports and records, and check the roster, warrants and BOLOs.',
      href: hubHref, cta: session ? 'Open the hub' : 'Sign in', tone: 'text-ok bg-ok/10 border-ok/25',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg> },
  ];

  return (
    <div className="min-h-screen overflow-x-hidden bg-black">
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-5 sm:px-6">
        <nav className="flex items-center gap-0.5 rounded-full border border-white/10 bg-black/60 p-1 backdrop-blur-md sm:gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/lounge.png" alt="The Lounge Roleplay" width={28} height={28} className="mx-0.5 h-7 w-7 rounded-full ring-1 ring-white/15" />
          <a href="#top" className="rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white">Home</a>
          <a href="#departments" className="rounded-full px-3 py-1.5 text-[13px] text-zinc-400 hover:text-white">Departments</a>
          <Link href={hubHref} className="rounded-full px-3 py-1.5 text-[13px] text-zinc-400 hover:text-white">{session ? 'Hub' : 'Sign in'}</Link>
          <a href={DISCORD} target="_blank" rel="noreferrer" aria-label="Join the Discord"
            className="ml-0.5 grid h-7 w-7 place-items-center rounded-full bg-white text-[#5865f2]"><DiscordIcon size={15} /></a>
        </nav>
      </header>

      <section id="top" className="relative flex min-h-screen min-h-[100dvh] flex-col">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/photos/sunset-trooper.jpg" alt="" className="absolute inset-0 -z-0 h-full w-full object-cover object-[65%_center]" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgb(3 6 14 / 0.92) 0%, rgb(3 6 14 / 0.7) 45%, rgb(3 6 14 / 0.45) 100%)' }} />
        <div className="absolute inset-x-0 bottom-0 h-40" style={{ background: 'linear-gradient(transparent, #000)' }} />
        <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pt-28 pb-20 sm:px-6">
          <div className="rise inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[11px] text-zinc-300 backdrop-blur">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/lounge.png" alt="" width={16} height={16} className="h-4 w-4 rounded-full" />
            District Five · Open applications
          </div>
          <h1 className="rise mt-5 max-w-2xl text-[46px] leading-[1.05] font-semibold tracking-tight text-white sm:text-[64px]" style={{ animationDelay: '80ms' }}>
            District Five<br />Departments
          </h1>
          <p className="rise mt-6 max-w-xl text-[16px] leading-relaxed text-zinc-300" style={{ animationDelay: '160ms' }}>
            Welcome to District Five, the law enforcement and Fire &amp; EMS departments of The Lounge Roleplay. We are committed to
            professionalism, accountability and structured training while giving every member a realistic and immersive roleplay
            experience. Our personnel are held to high standards and expected to uphold the values of their department.
          </p>
          <div className="rise mt-8 flex flex-wrap gap-2" style={{ animationDelay: '240ms' }}>
            <a href={DISCORD} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-full bg-white px-5 text-[13px] font-semibold text-black hover:bg-zinc-200">Join Discord</a>
            <a href="#departments" className="inline-flex h-10 items-center rounded-full border border-white/20 bg-black/40 px-5 text-[13px] font-semibold text-white backdrop-blur hover:bg-white/10">About us</a>
          </div>
        </div>
      </section>

      <section id="departments" className="relative scroll-mt-20 bg-black">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <h2 className="text-[26px] font-semibold tracking-tight text-white">Our departments</h2>
          <p className="mt-1.5 text-[14px] text-zinc-500">
            {(['leo', 'fire_ems'] as const).map((div) => command(div) && `${DIVISION_LABEL[div]} is overseen by ${command(div)!.name}.`).filter(Boolean).join(' ')
              || 'The departments that make up District Five.'}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {units.map((d, i) => (
              <article key={d.key} id={d.key} className="group flex scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-white/8 bg-zinc-950">
                <div className="relative h-40 overflow-hidden">
                  {PHOTOS[d.key] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={PHOTOS[d.key]} alt="" className="h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105" />
                  ) : <div className="h-full w-full" style={{ background: `radial-gradient(circle at 70% 80%, ${d.accent}33, transparent 60%)` }} />}
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(transparent 30%, rgb(9 9 11))' }} />
                  <div className="absolute bottom-3 left-4"><Emblem dept={d.key} label={d.short_name} accent={d.accent} division={d.division} size={44} /></div>
                </div>
                <div className="flex flex-1 flex-col p-5 pt-3">
                  <div className="text-[10px] font-semibold tracking-[0.18em] text-zinc-400 uppercase">
                    {String(i + 1).padStart(2, '0')} · {d.short_name}
                  </div>
                  <h3 className="mt-2 text-[17px] leading-snug font-semibold text-white">{d.name}</h3>
                  <p className="mt-2 flex-1 text-[13px] leading-relaxed text-zinc-400">{d.public_blurb ?? d.tagline}</p>
                  <Link href={joinHref(d.key)} className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-white hover:text-zinc-300">
                    Request to join <Arrow />
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {!!news?.length && (
            <div className="mt-20">
              <h2 className="text-[26px] font-semibold tracking-tight text-white">Press releases</h2>
              <p className="mt-1.5 text-[14px] text-zinc-500">The most recent public statements from District Five command.</p>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {news.map((a, i) => (
                  <article key={a.id} className="rounded-2xl border border-white/8 bg-zinc-950 p-5"
                    style={{ background: 'radial-gradient(circle at 90% 0%, rgb(34 197 94 / 0.06), transparent 50%), rgb(9 9 11)' }}>
                    <div className="text-[10px] font-semibold tracking-[0.18em] text-zinc-400 uppercase">
                      Release {String(i + 1).padStart(2, '0')} · {a.scope === 'district' ? 'District Five' : short(a.department_key)}
                    </div>
                    <h3 className="mt-3 text-[17px] font-semibold text-white">{a.title}</h3>
                    <p className="mt-2 line-clamp-4 text-[13px] leading-relaxed text-zinc-400">{a.body}</p>
                    {a.published_at && <div className="mt-4 text-[12px] text-zinc-500">{relative(a.published_at)}</div>}
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="relative bg-black">
        <div className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
          <h2 className="text-[26px] font-semibold tracking-tight text-white">Life in District Five</h2>
          <p className="mt-1.5 text-[14px] text-zinc-500">Training, patrol and tactical operations from our members.</p>
          <div className="mt-8 grid auto-rows-[180px] grid-cols-2 gap-3 sm:auto-rows-[220px] lg:grid-cols-4">
            {GALLERY.map((g, i) => (
              <figure key={g.src} className={`group relative overflow-hidden rounded-2xl border border-white/8 ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.src} alt={g.caption} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <figcaption className="absolute inset-x-0 bottom-0 p-3 text-[12px] font-medium text-white" style={{ background: 'linear-gradient(transparent, rgb(0 0 0 / 0.75))' }}>{g.caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6">
          <div className="text-[11px] tracking-[0.3em] text-zinc-400 uppercase">Get involved</div>
          <h2 className="mt-3 text-[32px] font-semibold tracking-tight text-white">Quick Actions.</h2>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-zinc-400">
            Three direct ways to get started with District Five. Join the community, apply to a department, or sign in to the hub.
          </p>
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
            {actions.map((a) => (
              <div key={a.title} className="flex flex-col items-center rounded-2xl border border-white/8 bg-zinc-950 p-5">
                <span className={`grid h-10 w-10 place-items-center self-start rounded-xl border ${a.tone}`}>{a.icon}</span>
                <h3 className="mt-3 text-[16px] font-semibold text-white">{a.title}</h3>
                <p className="mt-2 flex-1 text-[13px] leading-relaxed text-zinc-400">{a.body}</p>
                {a.external ? (
                  <a href={a.href} target="_blank" rel="noreferrer" className="mt-5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-white text-[13px] font-semibold text-black hover:bg-zinc-200">{a.cta} <Arrow /></a>
                ) : (
                  <Link href={a.href} className="mt-5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-white text-[13px] font-semibold text-black hover:bg-zinc-200">{a.cta} <Arrow /></Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-6 px-4 py-8 sm:px-6">
          <div>
            <div className="text-[13px] font-semibold text-white">District Five Departments</div>
            <div className="mt-1 text-[13px] text-zinc-500">Law enforcement and Fire &amp; EMS roleplay on The Lounge Roleplay.</div>
          </div>
          <nav className="flex flex-wrap gap-4 text-[13px] text-zinc-400">
            <a href="#top" className="hover:text-white">Home</a>
            <a href="#departments" className="hover:text-white">Departments</a>
            <Link href={hubHref} className="hover:text-white">{session ? 'Hub' : 'Sign in'}</Link>
            <a href={DISCORD} target="_blank" rel="noreferrer" className="hover:text-white">Discord</a>
          </nav>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-8 text-[12px] leading-relaxed text-zinc-600 sm:px-6">
          District Five is part of The Lounge Roleplay, a roleplay community. Every department, person and record here is fictional,
          and none of it is affiliated with any real government agency. Do not enter real-world personal information.
        </div>
      </footer>
    </div>
  );
}
