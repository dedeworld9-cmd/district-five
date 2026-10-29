import Link from 'next/link';
import { Empty } from '@/components/ui';
import { Arrow } from '@/components/site/icons';
import { JoinBanner, PhotoIntro } from '@/components/site/Photo';
import { getSession } from '@/lib/session';
import { SITE } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Divisions' };

type Option = { id: string; name: string; description: string | null; is_open: boolean };

const SHIELD = 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6Z';

export default async function Divisions() {
  const supabase = await createClient();
  const [session, { data }] = await Promise.all([
    getSession(),
    // Department administrators edit this list on the hub's Administration panel.
    supabase.from('department_options').select('id,name,description,is_open').eq('department_key', SITE.department)
      .eq('kind', 'subdivision').eq('active', true).order('sort_order').returns<Option[]>(),
  ]);
  const member = !!session?.active.length;
  const joinHref = session ? '/hub/join' : `/login?next=${encodeURIComponent('/hub/join')}`;
  // Members apply with the subdivision request form; everyone else joins the department first.
  const applyHref = member ? '/hub/reports/new?kind=subdivision' : joinHref;

  return (
    <>
      <PhotoIntro title="Divisions" photo="explorer" w={1359} h={621} position="80% 40%" alt={`A white and green ${SITE.shortName} Ford Explorer patrol vehicle`}>
        Specialist units inside the {SITE.name}. Deputies on the roster can apply to join one from the member hub.
      </PhotoIntro>
      <section aria-label="Division list" className="container-page pb-20">
        {data?.length ? (
          <ul className="grid gap-3 sm:gap-5 md:grid-cols-2">
            {data.map((d, i) => (
              <li key={d.id} className="card relative flex flex-col overflow-hidden p-5 sm:p-9">
                <span className={`absolute inset-x-0 top-0 h-1 ${i % 2 ? 'bg-gold' : 'bg-brand-strong'}`} aria-hidden="true" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={SITE.logo} alt="" width={256} height={256} aria-hidden="true" className="pointer-events-none absolute -right-10 -bottom-10 w-48 opacity-[0.06]" />
                <div className="flex items-center justify-between gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-brand/30 bg-brand-soft text-brand-strong">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={SHIELD} /></svg>
                  </span>
                  <span className={`tag ${d.is_open ? 'tag-ok' : ''}`}>{d.is_open ? 'Applications open' : 'Applications closed'}</span>
                </div>
                <h2 className="mt-5 text-[clamp(1.4rem,1.2rem+0.8vw,1.75rem)] font-semibold tracking-tight">{d.name}</h2>
                {d.description && <p className="mt-2 flex-1 body-sm sm:text-[15px]">{d.description}</p>}
                <div className="relative mt-6 sm:mt-8">
                  {d.is_open
                    ? <Link href={applyHref} className="btn btn-brand btn-lg w-full sm:w-auto">{member ? `Apply to ${d.name}` : 'Join the department first'} <Arrow /></Link>
                    : <span className="text-[14px] text-muted">Not taking applications right now.</span>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No divisions are listed yet.</Empty>
        )}
      </section>
      {!member && <JoinBanner href={joinHref} />}
    </>
  );
}
