import Link from 'next/link';
import { Arrow, DiscordIcon } from '@/components/site/icons';
import { JoinBanner, Photo } from '@/components/site/Photo';
import { SectionHeading } from '@/components/site/Section';
import { relative } from '@/lib/format';
import { getSession } from '@/lib/session';
import { CHAIN_OF_COMMAND, LEADERSHIP, MASS_SHIFT_REWARDS, SITE, SOP_TITLES } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';
import type { Announcement } from '@/lib/types';

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true"><path d="m5 12 5 5L20 7" /></svg>
);

type Option = { id: string; name: string; description: string | null; is_open: boolean };

const ICON = {
  join: 'M15 19v-1a4 4 0 0 0-8 0v1M11 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 8v6M22 11h-6',
  hub: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z',
  shield: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6Z',
  game: 'M6 12h4M8 10v4M15 13h.01M18 11h.01M17.3 5H6.7a4 4 0 0 0-3.9 3.2l-1 5A3 3 0 0 0 6.7 17l1.8-2h7l1.8 2a3 3 0 0 0 4.9-3.8l-1-5A4 4 0 0 0 17.3 5Z',
};

function Glyph({ d }: { d: string }) {
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-brand/30 bg-brand-soft text-brand-strong">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
    </span>
  );
}

export default async function Home() {
  const supabase = await createClient();
  const [session, { data: divisions }, { data: news }] = await Promise.all([
    getSession(),
    supabase.from('department_options').select('id,name,description,is_open').eq('department_key', SITE.department)
      .eq('kind', 'subdivision').eq('active', true).order('sort_order').returns<Option[]>(),
    // Row-level security returns only posts that command approved for the public.
    supabase.from('announcements').select('id,title,body,published_at').eq('status', 'published').eq('is_public', true)
      .eq('department_key', SITE.department).order('published_at', { ascending: false }).limit(3).returns<Announcement[]>(),
  ]);
  // Signed-out visitors sign in with Discord first, then land on the join form.
  const joinHref = session ? '/hub/join' : `/login?next=${encodeURIComponent('/hub/join')}`;
  const hubHref = session ? '/hub' : '/login';

  // Every number here is counted from the same data the pages below show.
  const stats = [
    { value: CHAIN_OF_COMMAND.reduce((n, g) => n + g.ranks.length, 0), label: 'Ranks' },
    { value: CHAIN_OF_COMMAND.length, label: 'Command levels' },
    { value: divisions?.length ?? 0, label: 'Divisions' },
    { value: SOP_TITLES.length, label: 'SOP policies' },
  ];

  const actions = [
    { icon: ICON.join, title: 'Join the department', href: joinHref, cta: 'Request to join',
      body: 'Sign in with Discord and send a roster request with your roleplay name. Command reviews every request.' },
    { icon: ICON.hub, title: session ? 'Open the member hub' : 'Member sign in', href: hubHref, cta: session ? 'Open the hub' : 'Sign in',
      body: 'Clock in and out, file shift logs and reports, and read the department SOP.' },
    SITE.discordInvite
      ? { icon: '', discord: true, title: 'Join the Discord', href: SITE.discordInvite, cta: 'Join Discord', external: true,
          body: `Announcements, mass shifts, training and support for ${SITE.shortName} all run through Discord.` }
      : { icon: ICON.game, title: `Join ${SITE.community.shortName} on Roblox`, href: SITE.community.robloxGroup, cta: 'Open the Roblox group', external: true,
          body: `${SITE.community.name} runs on ${SITE.community.game}. Join the community group to get into sessions.` },
  ];

  return (
    <>
      {/* Hero: the photo runs edge to edge and slides up under the floating header. */}
      <section aria-labelledby="hero-title" className="relative -mt-[68px] overflow-hidden sm:-mt-[72px]">
        <Photo name="explorer" w={1359} h={621} priority sizes="100vw" alt={`A white and green ${SITE.shortName} Ford Explorer patrol vehicle`}
          className="absolute inset-x-0 top-0 h-[400px] w-full object-cover object-[62%_center] md:inset-0 md:h-full md:object-[80%_center]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(9_11_16/0.96)_0%,rgb(9_11_16/0.85)_38%,rgb(9_11_16/0.25)_75%,rgb(9_11_16/0.1)_100%)] max-md:bg-[linear-gradient(180deg,rgb(9_11_16/0.15)_0%,rgb(9_11_16/0.1)_120px,rgb(9_11_16/0.85)_340px,var(--color-bg)_400px)]" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" aria-hidden="true" />
        <div className="container-page relative flex flex-col justify-end pt-[260px] pb-28 md:min-h-[680px] md:justify-center md:pt-36 md:pb-32 lg:min-h-[760px]">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-black/40 py-1 pr-3.5 pl-1 text-[13px] text-ink backdrop-blur">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SITE.community.logo} alt="" width={24} height={24} className="h-6 w-6 rounded-full" />
            {SITE.community.name} · {SITE.community.game}
          </p>
          <h1 id="hero-title" className="mt-6 max-w-3xl text-[clamp(2.6rem,1.6rem+4.4vw,5rem)] leading-[1.02] font-bold tracking-[-0.03em]">
            Hillsborough County <span className="text-gold">Sheriff&apos;s Office</span>
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-[#dfe4ec]">
            {SITE.welcome} {SITE.shortName} is a law enforcement department on {SITE.community.name}.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            <Link href={joinHref} className="btn btn-brand btn-lg h-12 px-4 text-[15px] sm:px-7 shadow-[0_10px_30px_rgb(34_120_74/0.45)]">Request to join <Arrow /></Link>
            <Link href="/team" className="btn btn-lg h-12 border-white/25 bg-black/30 px-4 text-[15px] backdrop-blur sm:px-7">Chain of command</Link>
          </div>
        </div>
      </section>

      {/* Stats ride up over the bottom of the hero. */}
      <section aria-label="At a glance" className="container-page relative z-10 -mt-20">
        <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10 bg-surface md:grid-cols-4">
          {stats.map((st, i) => (
            <div key={st.label} className={`px-5 py-5 sm:px-8 sm:py-8 ${i % 2 ? 'border-l border-white/10' : ''} ${i > 1 ? 'border-t border-white/10 md:border-t-0' : ''} ${i === 2 ? 'md:border-l' : ''}`}>
              <dt className="text-[13px] text-muted">{st.label}</dt>
              <dd className="mt-1 text-[34px] leading-none font-semibold tracking-tight sm:text-[40px]">{st.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="start" className="container-page section">
        <SectionHeading id="start" title="Get started" intro="Three direct ways in, whether you are new to the department or already on the roster." />
        <ul className="grid gap-4 md:grid-cols-3">
          {actions.map((a, i) => (
            <li key={a.title} className={`card relative grid grid-cols-[auto_1fr] gap-x-4 overflow-hidden p-5 md:flex md:flex-col md:p-7 `}>
              {'discord' in a && a.discord
                ? <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#5865f2]/30 bg-[#5865f2]/10 text-[#8b95f7]"><DiscordIcon size={20} /></span>
                : <Glyph d={a.icon} />}
              <h3 className="self-center text-[18px] font-semibold md:mt-5 md:text-[19px]">{a.title}</h3>
              <p className="col-span-2 mt-3 flex-1 body-sm md:mt-2">{a.body}</p>
              {'external' in a && a.external ? (
                <a href={a.href} target="_blank" rel="noreferrer" className={`col-span-2 mt-5 w-full md:mt-6 md:w-fit ${i === 0 ? 'btn btn-brand' : 'btn'}`}>{a.cta} <Arrow /><span className="sr-only"> (opens in a new tab)</span></a>
              ) : (
                <Link href={a.href} className={`col-span-2 mt-5 w-full md:mt-6 md:w-fit ${i === 0 ? 'btn btn-brand' : 'btn'}`}>{a.cta} <Arrow /></Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Feature rows alternate photo and text, in the style of the reference site. */}
      <section aria-labelledby="divisions" className="container-page pb-14 sm:pb-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-14">
          <div className="relative">
            <Photo name="night-stop" w={1600} h={725} sizes="(min-width: 1024px) 50vw, 100vw"
              alt="Two sheriff's deputies and a state trooper at a night traffic stop"
              className="aspect-[16/10] w-full rounded-2xl sm:aspect-[4/3] sm:rounded-3xl border border-white/10 object-cover shadow-[0_30px_80px_rgb(0_0_0/0.55)]" />
            <span className="absolute -bottom-4 left-6 rounded-full border border-white/10 bg-bg/90 px-4 py-2 text-[13px] font-medium backdrop-blur">Night shift</span>
          </div>
          <div>
            <h2 id="divisions" className="h2 text-[clamp(1.75rem,1.4rem+1.4vw,2.5rem)]">Divisions</h2>
            <p className="mt-3 body-sm sm:text-[16px]">Specialist units inside the office. Deputies on the roster apply from the member hub.</p>
            {divisions?.length ? (
              <ul className="mt-7 grid gap-3">
                {divisions.map((d) => (
                  <li key={d.id} className="card card-hover flex items-start gap-4 p-5">
                    <Glyph d={ICON.shield} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="h3">{d.name}</h3>
                        <span className={`tag ${d.is_open ? 'tag-ok' : ''}`}>{d.is_open ? 'Applications open' : 'Applications closed'}</span>
                      </div>
                      {d.description && <p className="mt-1 body-sm">{d.description}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-7 body-sm">No divisions are listed yet.</p>}
            <Link href="/divisions" className="link-arrow mt-6">All divisions <Arrow /></Link>
          </div>
        </div>

        <div className="mt-16 grid items-center gap-12 sm:mt-24 lg:grid-cols-2 lg:gap-14">
          <div className="lg:order-2 relative">
            <Photo name="day-patrol" w={1600} h={630} sizes="(min-width: 1024px) 50vw, 100vw"
              alt="A Hillsborough County Sheriff patrol car parked behind a State Trooper car, with officers standing in the grass"
              className="aspect-[16/10] w-full rounded-2xl sm:aspect-[4/3] sm:rounded-3xl border border-white/10 object-cover object-[65%_center] shadow-[0_30px_80px_rgb(0_0_0/0.55)]" />
            <span className="absolute -bottom-4 right-6 rounded-full border border-white/10 bg-bg/90 px-4 py-2 text-[13px] font-medium backdrop-blur">Day shift</span>
          </div>
          <div>
            <h2 id="standards" className="h2 text-[clamp(1.75rem,1.4rem+1.4vw,2.5rem)]">Standards we work by</h2>
            <p className="mt-3 body-sm sm:text-[16px]">Every deputy works under the {SITE.shortName} Master SOP. Members read and acknowledge each policy in the hub.</p>
            <ul className="mt-6 grid grid-cols-2 gap-2 sm:gap-2.5">
              {SOP_TITLES.map((t, i) => (
                <li key={t} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-[13px] font-medium sm:gap-3 sm:px-4 sm:py-3 sm:text-[14px]">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[0.06] font-mono text-[12px] text-muted">{String(i + 1).padStart(2, '0')}</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Chain of command as a ladder from the top of the office down. */}
      <section aria-labelledby="org" className="relative overflow-hidden border-y border-line bg-bg-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SITE.logo} alt="" width={256} height={256} aria-hidden="true" className="pointer-events-none absolute -right-24 -top-16 w-[420px] opacity-[0.06]" />
        <div className="container-page section relative">
          <SectionHeading id="org" title="How the office is organized"
            intro="Every rank sits in one of five levels. Callsigns follow the level: 1S for administration and command, 2S for supervisors, 3S for field staff."
            action={<Link href="/team" className="link-arrow">Full chain of command <Arrow /></Link>} />
          <ol className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {CHAIN_OF_COMMAND.map((g, i) => (
              <li key={g.group} className={`card relative overflow-hidden p-4 sm:p-5 ${i === 0 ? 'col-span-2 lg:col-span-1' : ''}`}>
                <span className="absolute inset-x-0 top-0 h-1" style={{ background: ['#c9a96a', '#7d8794', '#7d8794', '#7d8794', '#5a626d'][i] }} aria-hidden="true" />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[30px] leading-none font-bold text-white/15">{i + 1}</span>
                  {g.callsign && <span className="tag tag-gold font-mono">{g.callsign}</span>}
                </div>
                <h3 className="h3 mt-3">{g.group}</h3>
                <ul className={`mt-3 grid gap-1.5 text-[13px] text-muted sm:text-[14px] ${i === 0 ? 'grid-cols-2 lg:grid-cols-1' : ''}`}>
                  {g.ranks.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </li>
            ))}
          </ol>
          <h3 className="mt-12 mb-4 text-[18px] font-semibold">Office of the Sheriff</h3>
          <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
            {LEADERSHIP[0].leaders.map((l) => (
              <li key={l.callsign} className="card flex flex-col p-3.5 sm:p-5">
                <span className="tag tag-gold w-fit font-mono">{l.callsign}</span>
                <p className="mt-3 text-[17px] leading-tight font-semibold sm:mt-4 sm:text-[19px]">{l.name}</p>
                <p className="mt-1 text-[14px] text-gold">{l.rank}</p>
                {l.duty && <p className="mt-3 body-sm">{l.duty}</p>}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="mass" className="container-page section">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-center lg:gap-10">
          <div>
            <h2 id="mass" className="h2 text-[clamp(1.75rem,1.4rem+1.4vw,2.5rem)]">Mass shifts</h2>
            <p className="mt-3 body-sm sm:text-[16px]">Command calls mass shifts to get deputies in game together. Taking part can earn:</p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {MASS_SHIFT_REWARDS.map((r) => (
              <li key={r} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-[13px] font-medium sm:flex-col sm:items-start sm:p-4 sm:text-[14px]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-strong/20 text-brand-strong"><Check /></span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {!!news?.length && (
        <section aria-labelledby="news" className="container-page pb-20">
          <SectionHeading id="news" title="Press releases" intro={`The latest public statements from ${SITE.shortName} command.`} />
          <ul className="grid gap-4 md:grid-cols-3">
            {news.map((a) => (
              <li key={a.id} className="card p-6">
                <h3 className="h3">{a.title}</h3>
                <p className="mt-2 line-clamp-4 body-sm">{a.body}</p>
                {a.published_at && <p className="mt-4 text-[12px] text-faint">{relative(a.published_at)}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <JoinBanner href={joinHref} />
    </>
  );
}
