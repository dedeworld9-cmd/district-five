import Link from 'next/link';
import { DeptPicker } from '@/components/DeptPicker';
import { LOGOS, PHOTOS } from '@/lib/brand';
import { relative } from '@/lib/format';
import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import type { Announcement, Department, Rank } from '@/lib/types';

export const metadata: Metadata = { title: 'Front page concept', robots: { index: false } };

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


export default async function Concept() {
  const supabase = await createClient();
  const [session, { data: departments }, { data: ranks }, { data: news }] = await Promise.all([
    getSession(),
    supabase.from('departments').select('*').order('sort_order').returns<Department[]>(),
    supabase.from('ranks').select('department_key,name,sort_order,is_sample,active').eq('active', true).order('sort_order').returns<Rank[]>(),
    supabase.from('announcements').select('id,title,body,scope,department_key,published_at')
      .eq('status', 'published').eq('is_public', true).order('published_at', { ascending: false }).limit(3).returns<Announcement[]>(),
  ]);
  const all = departments ?? [];
  const dps = all.find((d) => d.key === 'dps');
  const command = (div: Department['division']) => all.find((d) => d.kind === 'oversight' && d.key !== 'dps' && d.oversees.includes(div)) ?? dps;
  const short = (k: string | null) => (k ? all.find((d) => d.key === k)?.short_name ?? k : 'District Five');
  const joinHref = (k?: string) => {
    const next = k ? `/hub/join?dept=${k}` : '/hub/join';
    return session ? next : `/login?next=${encodeURIComponent(next)}`;
  };
  const hubHref = session ? '/hub' : '/login';
  // Lowest rank first. Ladders still marked as samples stay off the public page.
  const ladder = (k: string) => {
    const r = (ranks ?? []).filter((x) => x.department_key === k);
    return r.some((x) => x.is_sample) ? [] : r.sort((a, b) => a.sort_order - b.sort_order).map((x) => x.name);
  };
  const units = all.filter((d) => d.kind === 'department').map((d) => ({
    key: d.key, name: d.name, short_name: d.short_name, division: d.division, tagline: d.tagline, public_blurb: d.public_blurb,
    accent: d.accent, ranks: ladder(d.key), joinHref: joinHref(d.key), overseenBy: command(d.division)?.name ?? null,
  }));
  const [lead, ...rest] = GALLERY;

  return (
    <div className="concept min-h-screen overflow-x-hidden bg-[#050608] text-white">
      <header className="absolute inset-x-0 top-0 z-50">
        <nav className="mx-auto flex max-w-[1360px] items-center gap-6 px-4 py-5 sm:px-8">
          <a href="#top" className="flex items-center gap-2.5 text-[16px] font-semibold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/lounge.png" alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-full" />
            District Five
          </a>
          <div className="ml-auto hidden items-center gap-6 text-[15px] text-zinc-300 sm:flex">
            <a href="#departments" className="hover:text-white">Departments</a>
            <a href="#life" className="hover:text-white">Life in District Five</a>
            <Link href={hubHref} className="hover:text-white">{session ? 'Hub' : 'Sign in'}</Link>
          </div>
          <a href={DISCORD} target="_blank" rel="noreferrer" className="press ml-auto inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[14px] font-semibold text-black sm:ml-0">
            <DiscordIcon size={16} /> Join Discord
          </a>
        </nav>
      </header>

      <section id="top" className="relative flex min-h-[100svh] flex-col justify-end">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/photos/sunset-trooper.jpg" alt="A deputy at sunset in District Five" className="drift absolute inset-0 h-full w-full object-cover object-[65%_center]" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgb(5 6 8 / 0.55) 0%, rgb(5 6 8 / 0.15) 35%, rgb(5 6 8 / 0.85) 78%, #050608 100%)' }} />
        <div className="relative mx-auto w-full max-w-[1360px] px-4 pt-32 pb-10 sm:px-8 sm:pb-14">
          <h1 className="rise text-[clamp(64px,13.5vw,212px)] leading-[0.86] font-semibold tracking-[-0.045em]">District Five</h1>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="rise max-w-[30ch] text-[22px] leading-snug text-zinc-100 sm:text-[26px]" style={{ animationDelay: '90ms' }}>
                The department hub for law enforcement, Fire &amp; EMS and dispatch on The Lounge Roleplay.
              </p>
              <div className="rise mt-7 flex flex-wrap gap-3" style={{ animationDelay: '180ms' }}>
                <Link href={joinHref()} className="press inline-flex h-12 items-center rounded-full bg-white px-6 text-[15px] font-semibold text-black">Apply to a department</Link>
                <a href="#departments" className="press inline-flex h-12 items-center rounded-full bg-white/12 px-6 text-[15px] font-semibold text-white hover:bg-white/20">See the departments</a>
              </div>
            </div>
            <ul className="rise flex flex-wrap gap-3" style={{ animationDelay: '270ms' }} aria-label="Departments">
              {all.filter((d) => LOGOS[d.key]).map((d) => (
                <li key={d.key}>
                  <a href={d.key === 'dps' ? '#dps' : '#departments'} title={d.name} className="press block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={LOGOS[d.key]} alt={d.name} width={56} height={56} className="h-12 w-12 object-contain sm:h-14 sm:w-14" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="reveal mx-auto grid max-w-[1360px] gap-10 px-4 pt-28 sm:px-8 sm:pt-40 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
        <div>
          <h2 className="text-[17px] font-semibold text-zinc-400">Who we are</h2>
          <p className="mt-5 text-[24px] leading-[1.35] tracking-[-0.01em] text-white sm:text-[30px]">
            Welcome to the District Five Department Hub. This hub serves our law enforcement, Fire &amp; EMS and dispatch personnel.
          </p>
          <p className="mt-6 max-w-[60ch] text-[18px] leading-relaxed text-zinc-300">
            We are committed to professionalism, accountability and structured training while giving every member a realistic and
            immersive roleplay experience. Our personnel are held to high standards and expected to uphold the values of their department.
          </p>
        </div>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/photos/academy.jpg" alt="Recruits in formation at the academy" loading="lazy" className="aspect-[4/3] w-full object-cover" />
          <figcaption className="mt-3 text-[14px] text-zinc-400">Academy formation. Every new member starts with training.</figcaption>
        </figure>
      </section>

      <section id="departments" className="reveal mx-auto max-w-[1360px] scroll-mt-6 px-4 pt-28 sm:px-8 sm:pt-40">
        <h2 className="text-[40px] leading-[1.02] font-semibold tracking-[-0.03em] sm:text-[64px]">Find your department</h2>
        <p className="mt-4 max-w-[52ch] text-[18px] leading-relaxed text-zinc-300">Pick one to see what it does, how its ranks run and how to join.</p>
        <div className="mt-10"><DeptPicker units={units} /></div>
      </section>

      {dps && (
        <section id="dps" className="reveal mt-28 scroll-mt-6 bg-[#13070d] sm:mt-40">
          <div className="mx-auto grid max-w-[1360px] gap-10 px-4 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGOS.dps} alt="" width={112} height={112} className="h-24 w-24 object-contain sm:h-28 sm:w-28" />
              <h2 className="mt-8 text-[36px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-[52px]">{dps.name}</h2>
              <p className="mt-5 max-w-[52ch] text-[18px] leading-relaxed text-[#f6d5e2]">
                {dps.public_blurb ?? 'The administrative department of District Five. A command staff of eight oversees law enforcement, Fire & EMS and dispatch, sets district policy and reviews the most serious records.'}
              </p>
              <p className="mt-6 text-[16px] font-medium text-[#f2a7c3]">Positions are filled by appointment from within the departments.</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={PHOTOS.dps} alt="A Department of Public Safety command vehicle" loading="lazy" className="aspect-[16/10] w-full object-cover" />
          </div>
        </section>
      )}

      <section id="life" className="reveal mx-auto max-w-[1360px] scroll-mt-6 px-4 pt-28 sm:px-8 sm:pt-40">
        <h2 className="text-[40px] leading-[1.02] font-semibold tracking-[-0.03em] sm:text-[64px]">Life in District Five</h2>
        <p className="mt-4 max-w-[52ch] text-[18px] leading-relaxed text-zinc-300">Training, patrol and tactical operations, shot in game by our members.</p>
        <figure className="group mt-10 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lead.src} alt={lead.caption} loading="lazy" className="lift aspect-[16/9] w-full object-cover sm:aspect-[21/9]" />
          <figcaption className="mt-3 text-[14px] text-zinc-400">{lead.caption}</figcaption>
        </figure>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {rest.map((g) => (
            <figure key={g.src} className="group overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.src} alt={g.caption} loading="lazy" className="lift aspect-[4/3] w-full object-cover" />
              <figcaption className="mt-2.5 text-[14px] text-zinc-400">{g.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {!!news?.length && (
        <section className="reveal mx-auto max-w-[1360px] px-4 pt-28 sm:px-8 sm:pt-40">
          <h2 className="text-[40px] leading-[1.02] font-semibold tracking-[-0.03em] sm:text-[64px]">Press releases</h2>
          <div className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-3">
            {news.map((a) => (
              <article key={a.id}>
                <p className="text-[14px] text-zinc-400">{a.scope === 'district' ? 'District Five' : short(a.department_key)}{a.published_at && `, ${relative(a.published_at)}`}</p>
                <h3 className="mt-2 text-[22px] leading-snug font-semibold">{a.title}</h3>
                <p className="mt-3 line-clamp-5 text-[16px] leading-relaxed text-zinc-300">{a.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="reveal mt-28 bg-white text-black sm:mt-40">
        <div className="mx-auto max-w-[1360px] px-4 py-20 sm:px-8 sm:py-28">
          <h2 className="text-[40px] leading-[1.02] font-semibold tracking-[-0.03em] sm:text-[64px]">From Discord to your first shift</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-12">
            <li className="flex flex-col">
              <h3 className="text-[24px] font-semibold">Join the Discord</h3>
              <p className="mt-3 flex-1 text-[17px] leading-relaxed text-zinc-700">Connect with The Lounge, get District Five updates, and reach recruitment, support and department channels.</p>
              <a href={DISCORD} target="_blank" rel="noreferrer" className="press mt-6 inline-flex h-12 w-fit items-center rounded-full bg-black px-6 text-[15px] font-semibold text-white">Join Discord</a>
            </li>
            <li className="flex flex-col">
              <h3 className="text-[24px] font-semibold">Apply to a department</h3>
              <p className="mt-3 flex-1 text-[17px] leading-relaxed text-zinc-700">Sign in with Discord, pick a department and give command your roleplay name. Keep your DMs open for the interview.</p>
              <Link href={joinHref()} className="press mt-6 inline-flex h-12 w-fit items-center rounded-full bg-black px-6 text-[15px] font-semibold text-white">Apply today</Link>
            </li>
            <li className="flex flex-col">
              <h3 className="text-[24px] font-semibold">Start your shift</h3>
              <p className="mt-3 flex-1 text-[17px] leading-relaxed text-zinc-700">Once you are on the roster, sign in to clock on, file reports and records, and check the roster, warrants and BOLOs.</p>
              <Link href={hubHref} className="press mt-6 inline-flex h-12 w-fit items-center rounded-full bg-black px-6 text-[15px] font-semibold text-white">{session ? 'Open the hub' : 'Sign in'}</Link>
            </li>
          </ol>
        </div>
      </section>

      <footer className="mx-auto max-w-[1360px] px-4 pt-20 pb-10 sm:px-8">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-zinc-300">
          <a href="#departments" className="hover:text-white">Departments</a>
          <a href="#life" className="hover:text-white">Life in District Five</a>
          <Link href={hubHref} className="hover:text-white">{session ? 'Hub' : 'Sign in'}</Link>
          <a href={DISCORD} target="_blank" rel="noreferrer" className="hover:text-white">Discord</a>
        </div>
        <p className="mt-6 max-w-[80ch] text-[14px] leading-relaxed text-zinc-400">
          The Lounge Roleplay is the roleplay server, and District Five is where its departments are. Every department, person and record here is fictional,
          and none of it is affiliated with any real government agency. Do not enter real-world personal information.
        </p>
        <p aria-hidden="true" className="mt-12 text-[clamp(56px,15vw,236px)] leading-[0.8] font-semibold tracking-[-0.05em] text-white/[0.07] select-none">District Five</p>
      </footer>
    </div>
  );
}
