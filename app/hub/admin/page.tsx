import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Flash, PageHead } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { TIERS, TIER_LABEL } from '@/lib/tiers';
import type { DepartmentOption, Rank, Tier } from '@/lib/types';
import { adminAddSelf, adminDemo, adminImportRoster, adminSaveOption, adminSaveRank, adminSaveRoute, adminSetSetting, adminUpdateDepartment } from '../actions';

export const metadata = { title: 'Admin' };

const TABS = [['settings', 'Settings'], ['ranks', 'Ranks'], ['options', 'Certifications'], ['routing', 'Review routing'], ['import', 'Roster import'], ['audit', 'Audit log']] as const;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'UTC'];

interface Route { id: string; record_type: string; department_key: string | null; submitter_tier: Tier; required_tier: Tier }
interface Audit { id: number; actor_name: string | null; action: string; entity_ref: string | null; department_key: string | null; created_at: string }

export default async function Admin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  if (!s.isAdmin) redirect('/hub');
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : 'settings';
  const supabase = await createClient();
  const [{ data: ranks }, { data: routes }, { data: settings }, { data: audit }, { count: demoCount }, { data: options }] = await Promise.all([
    supabase.from('ranks').select('*').order('department_key').order('sort_order').returns<Rank[]>(),
    supabase.from('approval_routes').select('*').eq('record_type', 'shift_log').returns<Route[]>(),
    supabase.from('app_settings').select('*').returns<{ key: string; value: unknown }[]>(),
    tab === 'audit' ? supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100).returns<Audit[]>() : Promise.resolve({ data: [] as Audit[] }),
    supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('is_demo', true),
    supabase.from('department_options').select('*').order('department_key').order('kind').order('sort_order').order('name').returns<DepartmentOption[]>(),
  ]);
  const setting = (k: string) => settings?.find((x) => x.key === k)?.value;
  const departments = s.departments.filter((d) => d.kind === 'department');

  return (
    <>
      <Flash searchParams={sp} />
      <PageHead eyebrow="Technical administration" title="Admin" />
      <div className="mb-8 flex flex-wrap gap-1">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/hub/admin?tab=${k}`} className={`rounded-full px-3 py-1.5 text-[13px] ${tab === k ? 'bg-white/[0.08] text-ink' : 'text-muted hover:text-ink'}`}>{l}</Link>
        ))}
      </div>

      {tab === 'settings' && !s.active.length && (
        <form action={adminAddSelf} className="card mb-8 grid max-w-3xl gap-4 border-gold/30 p-6 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <div className="sm:col-span-3">
            <h2 className="text-[16px] font-medium">Put yourself on a roster</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Admin access covers settings only. Shifts, reports, approvals and the board belong to roster members, so add yourself to a department.
              A DPS command rank oversees every division and opens every page.
            </p>
          </div>
          <label className="field"><span>Department and rank</span>
            <select name="rank" className="input" required defaultValue="">
              <option value="" disabled>Choose a rank</option>
              {s.departments.map((d) => {
                const list = (ranks ?? []).filter((r) => r.department_key === d.key && r.active).sort((a, b) => b.sort_order - a.sort_order);
                return list.length ? (
                  <optgroup key={d.key} label={d.name}>
                    {list.map((r) => <option key={r.id} value={`${d.key}|${r.id}`}>{r.name}{r.abbreviation ? ` (${r.abbreviation})` : ''}</option>)}
                  </optgroup>
                ) : null;
              })}
            </select>
          </label>
          <label className="field"><span>Callsign (optional)</span><input name="callsign" className="input" maxLength={12} /></label>
          <button className="btn-primary">Add me</button>
        </form>
      )}

      {tab === 'settings' && (
        <div className="grid gap-6">
          {departments.map((d) => (
            <form key={d.key} action={adminUpdateDepartment} className="card grid gap-4 p-6 sm:grid-cols-3">
              <input type="hidden" name="key" value={d.key} />
              <h2 className="text-[16px] font-medium sm:col-span-3">{d.name}</h2>
              <label className="field"><span>Weekly quota (hours)</span>
                <input name="quota_hours" type="number" min={0} max={168} step={0.5} className="input" defaultValue={d.quota_minutes / 60} />
              </label>
              <label className="field"><span>Week starts on</span>
                <select name="week_starts_on" className="input" defaultValue={d.week_starts_on}>
                  {DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}
                </select>
              </label>
              <label className="field"><span>Time zone for weeks</span>
                <select name="timezone" className="input" defaultValue={d.timezone}>
                  {[...new Set([d.timezone, ...ZONES])].map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 text-[14px] text-muted sm:col-span-3">
                <input type="checkbox" name="bodycam_required" defaultChecked={d.bodycam_required} /> Require a bodycam status on every submitted shift
              </label>
              <label className="field sm:col-span-2"><span>Bodycam policy text shown on the shift form (paste your department&apos;s wording)</span>
                <textarea name="bodycam_policy_text" className="input" defaultValue={d.bodycam_policy_text ?? ''} rows={3} />
              </label>
              <label className="field"><span>Policy link</span>
                <input name="bodycam_policy_url" type="url" className="input" defaultValue={d.bodycam_policy_url ?? ''} placeholder="https://" />
              </label>
              <div className="sm:col-span-3"><button className="btn-primary btn-sm">Save {d.short_name}</button></div>
            </form>
          ))}

          <form action={adminSetSetting} className="card grid gap-4 p-6 sm:grid-cols-[1fr_auto] sm:items-end">
            <input type="hidden" name="key" value="dual_membership_mode" />
            <label className="field"><span>Members in more than one department meet the quota</span>
              <select name="value" className="input" defaultValue={String(setting('dual_membership_mode') ?? 'combined')}>
                <option value="combined">Combined: all approved time counts toward one quota</option>
                <option value="per_department">Per department: each department&apos;s quota separately</option>
              </select>
            </label>
            <button className="btn-primary btn-sm">Save</button>
          </form>

          <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <h2 className="text-[16px] font-medium">Demo data</h2>
              <p className="mt-1 text-[13px] text-muted">
                {demoCount ? `${demoCount} fictional roster entries are loaded, each labeled [DEMO].` : 'Load a few fictional roster entries and a welcome post so the hub is not empty.'}
              </p>
            </div>
            <form action={adminDemo.bind(null, demoCount ? 'clear' : 'seed')}>
              {demoCount ? <button className="btn-danger btn-sm">Remove demo data</button>
                : <button className="btn btn-sm">Load demo data</button>}
            </form>
          </div>
        </div>
      )}

      {tab === 'ranks' && (
        <div className="grid gap-8">
          <p className="max-w-2xl text-[14px] text-muted">
            Ranks marked <span className="tag">sample</span> were copied from the Discord channels and need confirming.
            Saving a rank confirms it. The tier decides what that rank can review and approve.
          </p>
          {s.departments.map((d) => (
            <section key={d.key}>
              <h2 className="label mb-3">{d.name}</h2>
              <div className="card divide-y divide-line">
                {(ranks ?? []).filter((r) => r.department_key === d.key).map((r) => (
                  <form key={r.id} action={adminSaveRank} className="grid items-center gap-2 px-4 py-3 sm:grid-cols-[3rem_2fr_1fr_1.4fr_auto_auto]">
                    <input type="hidden" name="id" value={r.id} /><input type="hidden" name="department" value={d.key} />
                    <input name="sort_order" type="number" className="input !h-8" defaultValue={r.sort_order} aria-label="Order" />
                    <input name="name" className="input !h-8" defaultValue={r.name} aria-label="Rank name" />
                    <input name="abbreviation" className="input !h-8" defaultValue={r.abbreviation ?? ''} aria-label="Abbreviation" />
                    <select name="tier" className="input !h-8" defaultValue={r.tier} aria-label="Tier">
                      {TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
                    </select>
                    {r.is_sample ? <span className="tag">sample</span> : <span className="tag tag-ok">confirmed</span>}
                    <button className="btn btn-sm">Save</button>
                  </form>
                ))}
                <form action={adminSaveRank} className="grid items-center gap-2 px-4 py-3 sm:grid-cols-[3rem_2fr_1fr_1.4fr_auto]">
                  <input type="hidden" name="department" value={d.key} />
                  <input name="sort_order" type="number" className="input !h-8" placeholder="#" aria-label="Order" />
                  <input name="name" className="input !h-8" placeholder="New rank" required aria-label="Rank name" />
                  <input name="abbreviation" className="input !h-8" placeholder="Abbr." aria-label="Abbreviation" />
                  <select name="tier" className="input !h-8" defaultValue="patrol" aria-label="Tier">
                    {TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
                  </select>
                  <button className="btn btn-sm">Add</button>
                </form>
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === 'options' && (
        <div className="grid gap-8">
          <p className="max-w-2xl text-[14px] text-muted">
            What members can request on the Reports page. Approving a certification request adds it to the member&apos;s training record;
            approving a subdivision request adds the subdivision to their roster entry. Closed options stay on records but cannot be requested.
          </p>
          {departments.map((d) => (
            <section key={d.key}>
              <h2 className="label mb-3">{d.name}</h2>
              <div className="card divide-y divide-line">
                {(options ?? []).filter((o) => o.department_key === d.key).map((o) => (
                  <form key={o.id} action={adminSaveOption} className="grid items-center gap-2 px-4 py-3 sm:grid-cols-[3rem_7rem_2fr_1.4fr_auto_auto_auto]">
                    <input type="hidden" name="id" value={o.id} /><input type="hidden" name="department" value={d.key} />
                    <input type="hidden" name="kind" value={o.kind} />
                    <input name="sort_order" type="number" className="input !h-8" defaultValue={o.sort_order} aria-label="Order" />
                    <span className="text-[12px] text-faint">{o.kind === 'certification' ? 'Certification' : 'Subdivision'}</span>
                    <input name="name" className="input !h-8" defaultValue={o.name} aria-label="Name" />
                    <select name="min_tier" className="input !h-8" defaultValue={o.min_tier} aria-label="Lowest tier that may request">
                      {TIERS.map((t) => <option key={t} value={t}>From {TIER_LABEL[t].toLowerCase()}</option>)}
                    </select>
                    <label className="flex items-center gap-1.5 text-[12px] text-muted"><input type="checkbox" name="is_open" defaultChecked={o.is_open} /> Open</label>
                    <select name="active" className="input !h-8" defaultValue={o.active ? 'on' : 'off'} aria-label="Listed">
                      <option value="on">Listed</option><option value="off">Hidden</option>
                    </select>
                    <button className="btn btn-sm">Save</button>
                  </form>
                ))}
                <form action={adminSaveOption} className="grid items-center gap-2 px-4 py-3 sm:grid-cols-[3rem_7rem_2fr_1.4fr_auto_auto]">
                  <input type="hidden" name="department" value={d.key} />
                  <input name="sort_order" type="number" className="input !h-8" placeholder="#" aria-label="Order" />
                  <select name="kind" className="input !h-8" defaultValue="certification" aria-label="Kind">
                    <option value="certification">Certification</option><option value="subdivision">Subdivision</option>
                  </select>
                  <input name="name" className="input !h-8" placeholder="New option" required aria-label="Name" />
                  <select name="min_tier" className="input !h-8" defaultValue="probationary" aria-label="Lowest tier that may request">
                    {TIERS.map((t) => <option key={t} value={t}>From {TIER_LABEL[t].toLowerCase()}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 text-[12px] text-muted"><input type="checkbox" name="is_open" defaultChecked /> Open</label>
                  <button className="btn btn-sm">Add</button>
                </form>
              </div>
            </section>
          ))}
        </div>
      )}

      {tab === 'routing' && (
        <div className="grid max-w-3xl gap-6">
          <p className="text-[14px] text-muted">
            Who reviews a shift log depends on the submitter&apos;s tier. District rules apply unless a department has its own row.
            Division command can always review its own division, and nobody can approve their own entry.
          </p>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>Applies to</th><th>Submitter</th><th>Reviewed by</th></tr></thead>
              <tbody>
                {(routes ?? []).sort((a, b) => (a.department_key ?? '').localeCompare(b.department_key ?? '') || TIERS.indexOf(a.submitter_tier) - TIERS.indexOf(b.submitter_tier)).map((r) => (
                  <tr key={r.id}>
                    <td>{r.department_key ? s.departments.find((d) => d.key === r.department_key)?.short_name : 'District default'}</td>
                    <td>{TIER_LABEL[r.submitter_tier]}</td><td>{TIER_LABEL[r.required_tier]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={adminSaveRoute} className="card grid gap-3 p-6 sm:grid-cols-4 sm:items-end">
            <label className="field"><span>Applies to</span>
              <select name="department" className="input"><option value="">District default</option>
                {departments.map((d) => <option key={d.key} value={d.key}>{d.short_name}</option>)}</select>
            </label>
            <label className="field"><span>Submitter</span>
              <select name="submitter" className="input">{TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}</select>
            </label>
            <label className="field"><span>Reviewed by</span>
              <select name="required" className="input" defaultValue="supervisor">{TIERS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}</select>
            </label>
            <button className="btn-primary btn-sm">Save rule</button>
          </form>
        </div>
      )}

      {tab === 'import' && (
        <form action={adminImportRoster} className="card grid max-w-3xl gap-4 p-6">
          <div>
            <h2 className="text-[16px] font-medium">Import an existing roster</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              One member per line: <code className="text-ink">department, name, discord id, rank, callsign, badge</code>.
              Rank can be the full name or abbreviation. Each entry links to its member the first time they sign in with that Discord account.
            </p>
          </div>
          <textarea name="rows" className="input font-mono text-[13px]" rows={10} placeholder={'bcso, J. Doe, 123456789012345678, Sergeant, 1S-10, 1010\nsahp, A. Smith, 234567890123456789, Trooper, 4A-12, 2212'} />
          <div><button className="btn-primary">Import</button></div>
        </form>
      )}

      {tab === 'audit' && (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th></tr></thead>
            <tbody>
              {(audit ?? []).map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-muted">{dateTime(a.created_at, 'America/New_York')}</td>
                  <td>{a.actor_name}</td><td className="font-mono text-[13px]">{a.action}</td>
                  <td className="text-muted">{[a.department_key?.toUpperCase(), a.entity_ref].filter(Boolean).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
