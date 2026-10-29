import { JoinBanner, PhotoIntro } from '@/components/site/Photo';
import { getSession } from '@/lib/session';
import { CHAIN_OF_COMMAND, SITE } from '@/lib/site';

export const metadata = { title: 'Team' };

// Top bar colour per level, from badge gold at the top to HCSO green at the bottom.
const LEVEL_COLORS = ['#e3c15a', '#c9b45a', '#8fc46a', '#4fd18a', '#3a8f63'];

export default async function Team() {
  const session = await getSession();
  const joinHref = session ? '/hub/join' : `/login?next=${encodeURIComponent('/hub/join')}`;
  return (
    <>
      <PhotoIntro title="Chain of command" photo="day-patrol" h={630} position="70% 45%"
        alt="A Hillsborough County Sheriff patrol car parked behind a State Trooper car, with officers standing in the grass">
        The {SITE.shortName} chain of command, from the Sheriff down to deputies in training. Follow it when you need a decision or support.
      </PhotoIntro>

      <section aria-label="Ranks by level" className="container-page pb-14 sm:pb-20">
        <ol className="relative grid gap-3 sm:gap-5">
          {CHAIN_OF_COMMAND.map((g, i) => (
            <li key={g.group} className="card relative grid gap-4 overflow-hidden p-4 pl-5 sm:grid-cols-[240px_1fr] sm:items-start sm:gap-5 sm:p-8">
              <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: LEVEL_COLORS[i] }} aria-hidden="true" />
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 text-[20px] font-bold"
                  style={{ color: LEVEL_COLORS[i], background: `${LEVEL_COLORS[i]}1f` }}>{i + 1}</span>
                <div>
                  <h2 className="text-[20px] font-semibold">{g.group}</h2>
                  {g.callsign
                    ? <p className="mt-1 text-[13px] text-muted">Callsigns <span className="font-mono text-gold">{g.callsign}-xx</span></p>
                    : <p className="mt-1 text-[13px] text-muted">No callsign yet</p>}
                </div>
              </div>
              <ol className="grid grid-cols-2 gap-2 sm:gap-2.5">
                {g.ranks.map((r) => (
                  <li key={r} className="flex items-center gap-2 rounded-xl border border-line bg-bg/50 px-3 py-3 text-[13px] font-medium sm:gap-3 sm:px-4 sm:py-3.5 sm:text-[15px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={SITE.logo} alt="" width={22} height={22} className="h-[18px] w-[18px] shrink-0 opacity-80 sm:h-[22px] sm:w-[22px]" />
                    {r}
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
        <p className="mt-6 body-sm">Ranks are listed from highest to lowest within each level.</p>
      </section>

      <JoinBanner href={joinHref} />
    </>
  );
}
