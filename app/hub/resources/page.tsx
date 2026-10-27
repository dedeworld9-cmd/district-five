import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Empty, Flash, PageHead } from '@/components/ui';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Membership, Policy, Rank } from '@/lib/types';
import { acknowledgePolicy, savePolicy } from '../actions';
import { EQUIPMENT, EQUIPMENT_LABEL, equipmentKinds } from '@/lib/equipment';
import bcsoCommand from '@/content/bcso/command.json';

// Command staff as posted by each department, shown alongside the live roster.
const COMMAND: Record<string, typeof bcsoCommand> = { bcso: bcsoCommand };

export const metadata = { title: 'Resources' };

const CATEGORIES: Record<string, string> = {
  sop: 'Policies & SOPs', guide: 'Guides', reference: 'Reference', personnel: 'Personnel', training: 'Training material', agreement: 'Agreements', form: 'Forms', other: 'Other',
};

export default async function Resources({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  if (!s.active.length && !s.isAdmin) redirect('/hub');
  const supabase = await createClient();

  const myDepts = s.active.map((m) => s.departments.find((d) => d.key === m.department_key))
    .filter((d) => d?.kind === 'department').map((d) => d!);
  const dept = myDepts.find((d) => d.key === sp.dept) ?? myDepts.find((d) => d.key === s.current?.department_key) ?? myDepts[0];

  const [{ data: policies }, { data: acks }, { data: ranks }, { data: members }] = await Promise.all([
    supabase.from('policies').select('id,ref,title,category,department_key,version,summary,source_url,status,requires_acknowledgment')
      .eq('status', 'approved').order('title').returns<Policy[]>(),
    supabase.from('policy_acknowledgments').select('policy_id,policy_version').eq('profile_id', s.userId)
      .returns<{ policy_id: string; policy_version: string }[]>(),
    dept ? supabase.from('ranks').select('*').eq('department_key', dept.key).eq('active', true).order('sort_order', { ascending: false }).returns<Rank[]>()
      : Promise.resolve({ data: [] as Rank[] }),
    dept ? supabase.from('memberships').select('id,display_name,callsign,rank_id,tier').eq('department_key', dept.key).eq('status', 'active')
      .order('display_name').returns<Pick<Membership, 'id' | 'display_name' | 'callsign' | 'rank_id' | 'tier'>[]>()
      : Promise.resolve({ data: [] as Pick<Membership, 'id' | 'display_name' | 'callsign' | 'rank_id' | 'tier'>[] }),
  ]);

  const acked = new Set((acks ?? []).map((a) => `${a.policy_id}:${a.policy_version}`));
  const short = (k: string | null) => (k ? s.departments.find((d) => d.key === k)?.short_name ?? k : 'District');
  const groups = Object.entries(CATEGORIES)
    .map(([key, label]) => ({ key, label, list: (policies ?? []).filter((p) => (CATEGORIES[p.category] ? p.category : 'other') === key) }))
    .filter((g) => g.list.length);
  const pending = (policies ?? []).filter((p) => p.requires_acknowledgment && !acked.has(`${p.id}:${p.version}`));

  // Where the caller can add material: departments they head or oversee, and district-wide for division command.
  const manageable = s.departments.filter((d) => d.kind === 'department' && (s.tierIn(d.key) === 'department_head' || s.tierIn(d.key) === 'dps' || s.oversees(d.key)));
  const canDistrict = s.isDps;
  const standards = s.departments.filter((d) => equipmentKinds(d.key).length && (s.active.some((m) => m.department_key === d.key) || s.oversees(d.key)));

  // Chain of command: active ranks top-down, with members holding each; unranked members last.
  const chain = (ranks ?? []).map((r) => ({ r, list: (members ?? []).filter((m) => m.rank_id === r.id) })).filter((g) => g.list.length);
  const unranked = (members ?? []).filter((m) => !m.rank_id || !(ranks ?? []).some((r) => r.id === m.rank_id));

  return (
    <>
      <Flash searchParams={sp} />
      <PageHead eyebrow="Reference" title="Resources" />

      <div className="grid gap-12">
        {pending.length > 0 && (
          <section className="rounded-xl border border-warn/30 px-5 py-4">
            <div className="text-[14px] font-medium text-warn">{pending.length === 1 ? 'One document needs' : `${pending.length} documents need`} your acknowledgment</div>
            <p className="mt-1 text-[13px] text-muted">Read each one, then confirm below.</p>
          </section>
        )}

        {standards.length > 0 && (
          <section>
            <h2 className="label mb-3">Uniforms, vehicles and weapons</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {standards.flatMap((d) => equipmentKinds(d.key).map((k) => {
                const first = EQUIPMENT[d.key]?.[k]?.find((x) => x.img);
                return (
                  <Link key={d.key + k} href={`/hub/equipment/${k}?dept=${d.key}`} className="card group relative overflow-hidden">
                    {first?.img && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={first.img} alt="" className="h-36 w-full object-cover opacity-70 transition-opacity group-hover:opacity-100" />
                    )}
                    <div className="p-4">
                      <div className="text-[15px] font-medium">{d.short_name} {EQUIPMENT_LABEL[k].toLowerCase()}</div>
                      <div className="text-[12px] text-muted">{EQUIPMENT[d.key]?.[k]?.length} standards with pictures</div>
                    </div>
                  </Link>
                );
              }))}
            </div>
          </section>
        )}

        <section>
          <h2 className="label mb-3">Library</h2>
          {groups.length ? (
            <div className="grid gap-8">
              {groups.map((g) => (
                <div key={g.key}>
                  <h3 className="mb-2 text-[13px] font-medium text-muted">{g.label}</h3>
                  <div className="card divide-y divide-line">
                    {g.list.map((p) => {
                      const needs = p.requires_acknowledgment && !acked.has(`${p.id}:${p.version}`);
                      return (
                        <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-medium">
                              {p.source_url
                                ? <a href={p.source_url} target="_blank" rel="noreferrer noopener" className="hover:text-gold">{p.title} ↗</a>
                                : p.title}
                            </div>
                            <div className="text-[12px] text-faint">{short(p.department_key)} · v{p.version}{p.summary ? ` · ${p.summary}` : ''}</div>
                          </div>
                          {p.requires_acknowledgment && (needs ? (
                            <form action={acknowledgePolicy}>
                              <input type="hidden" name="id" value={p.id} />
                              <button className="btn btn-sm">I have read this</button>
                            </form>
                          ) : <span className="tag">Acknowledged</span>)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : <Empty>Nothing in the library yet.{manageable.length || canDistrict ? ' Add the first document below.' : ''}</Empty>}
        </section>

        {dept && (
          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="label">Chain of command · {dept.short_name}</h2>
              {myDepts.length > 1 && (
                <div className="flex gap-1">
                  {myDepts.map((d) => (
                    <Link key={d.key} href={`/hub/resources?dept=${d.key}`}
                      className={`rounded-full px-3 py-1 text-[12px] ${d.key === dept.key ? 'bg-white/[0.08]' : 'text-muted'}`}>{d.short_name}</Link>
                  ))}
                </div>
              )}
            </div>
            {COMMAND[dept.key] && (
              <div className="mb-4 grid gap-4">
                {COMMAND[dept.key].groups.map((g) => (
                  <div key={g.title} className="card divide-y divide-line">
                    <div className="px-4 py-2.5 text-[12px] font-medium uppercase tracking-wider text-faint">{g.title}</div>
                    {g.tiers.map((t, i) => (
                      <div key={g.title + i} className="grid gap-2 px-4 py-3 sm:grid-cols-[220px_1fr] sm:gap-4">
                        <div>
                          <div className="text-[14px] font-medium text-[var(--theme-a)]">{t.rank}</div>
                          <div className="text-[12px] text-faint">{t.role}{'duty' in t && t.duty ? ` · ${t.duty}` : ''}</div>
                        </div>
                        <div className="grid gap-1.5">
                          {t.people.map((m, j) => (
                            <div key={j} className="text-[14px]">
                              {m.callsign && <span className="mr-1.5 font-mono text-[13px] text-gold">{m.callsign}</span>}
                              <span className={m.name === 'Vacant' ? 'text-faint italic' : ''}>{m.name}</span>
                              {'duty' in m && m.duty && <div className="text-[12px] text-muted">{m.duty}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                <p className="text-[12px] text-faint">
                  From the {dept.short_name} chain-of-command post. Full chain on the{' '}
                  <a href={COMMAND[dept.key].roster} target="_blank" rel="noreferrer noopener" className="text-muted underline hover:text-ink">main roster ↗</a>.
                  Members signed in to the hub are listed below.
                </p>
              </div>
            )}
            {chain.length || unranked.length ? (
              <div className="card divide-y divide-line">
                {chain.map(({ r, list }) => (
                  <div key={r.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[220px_1fr] sm:gap-4">
                    <div className="text-[13px] text-muted">{r.name}{r.abbreviation ? <span className="text-faint"> · {r.abbreviation}</span> : ''}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[14px]">
                      {list.map((m) => (
                        <span key={m.id}>{m.callsign && <span className="mr-1.5 font-mono text-[13px] text-gold">{m.callsign}</span>}{m.display_name}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {unranked.length > 0 && (
                  <div className="grid gap-1 px-4 py-3 sm:grid-cols-[220px_1fr] sm:gap-4">
                    <div className="text-[13px] text-faint">No rank set</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-muted">{unranked.map((m) => <span key={m.id}>{m.display_name}</span>)}</div>
                  </div>
                )}
              </div>
            ) : <Empty>No active members yet.</Empty>}
            {(ranks ?? []).some((r) => r.is_sample) && <p className="mt-2 text-[12px] text-faint">Some rank names are samples until command confirms the ladder.</p>}
          </section>
        )}

        {(manageable.length > 0 || canDistrict) && (
          <section>
            <h2 className="label mb-3">Add to the library</h2>
            <form action={savePolicy} className="card grid gap-4 p-6 sm:grid-cols-2">
              <label className="field sm:col-span-2"><span>Title</span>
                <input name="title" className="input" required maxLength={200} placeholder="e.g. SAHP Standard Operating Procedures" />
              </label>
              <label className="field"><span>Category</span>
                <select name="category" className="input" defaultValue="sop">
                  {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="field"><span>Applies to</span>
                <select name="department" className="input" defaultValue={manageable[0]?.key ?? 'district'}>
                  {canDistrict && <option value="district">Whole district</option>}
                  {manageable.map((d) => <option key={d.key} value={d.key}>{d.short_name}</option>)}
                </select>
              </label>
              <label className="field sm:col-span-2"><span>Link</span>
                <input name="source_url" type="url" className="input" required placeholder="https://docs.google.com/…" />
              </label>
              <label className="field"><span>Version</span>
                <input name="version" className="input" defaultValue="1.0" maxLength={20} />
              </label>
              <label className="field"><span>Short description (optional)</span>
                <input name="summary" className="input" maxLength={200} />
              </label>
              <label className="flex items-center gap-2 text-[14px] sm:col-span-2">
                <input type="checkbox" name="requires_ack" /> Members must confirm they have read it
              </label>
              <div className="sm:col-span-2"><button className="btn-primary">Add</button></div>
            </form>
          </section>
        )}
      </div>
    </>
  );
}
