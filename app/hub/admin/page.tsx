import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Flash, PageHead } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { TIERS, TIER_LABEL } from '@/lib/tiers';
import type { Rank, Tier } from '@/lib/types';
import { RankEditor } from '@/components/DeptAdmin';
import { adminAddSelf, adminDemo, adminImportRoster, adminSaveRoute, adminSetSetting } from '../actions';

export const metadata = { title: 'Admin' };

// Site-wide only. Each department's own settings, ranks, certifications and routing live in its Administration panel.
const TABS = [['settings', 'Settings'], ['ranks', 'Command ranks'], ['routing', 'District routing'], ['import', 'Roster import'], ['audit', 'Audit log']] as const;

interface Route { id: string; record_type: string; department_key: string | null; submitter_tier: Tier; required_tier: Tier }
interface Audit { id: number; actor_name: string | null; action: string; entity_ref: string | null; department_key: string | null; created_at: string }

export default async function Admin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  if (!s.isAdmin) redirect('/hub');
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab! : 'settings';
  const supabase = await createClient();
  const [{ data: ranks }, { data: routes }, { data: settings }, { data: audit }, { count: demoCount }] = await Promise.all([
    supabase.from('ranks').select('*').order('department_key').order('sort_order').returns<Rank[]>(),
    supabase.from('approval_routes').select('*').eq('record_type', 'shift_log').returns<Route[]>(),
    supabase.from('app_settings').select('*').returns<{ key: string; value: unknown }[]>(),
    tab === 'audit' ? supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(100).returns<Audit[]>() : Promise.resolve({ data: [] as Audit[] }),
    supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('is_demo', true),
  ]);
  const setting = (k: string) => settings?.find((x) => x.key === k)?.value;
  const departments = s.departments.filter((d) => d.kind === 'department');

  return (
    <>
      <Flash searchParams={sp} />
      <PageHead title="Admin" />
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
          <section className="card divide-y divide-line">
            <div className="px-6 py-4">
              <h2 className="text-[16px] font-medium">Departments</h2>
              <p className="mt-1 text-[13px] text-muted">Quota, bodycam rules, ranks, certifications and review routing are set in each department&apos;s Administration panel.</p>
            </div>
            {departments.map((d) => (
              <Link key={d.key} href={`/hub/command/admin?dept=${d.key}&tab=settings`} className="flex items-center justify-between px-6 py-3 text-[14px] hover:bg-white/[0.02]">
                <span>{d.name}</span><span className="text-[13px] text-muted">Administration panel →</span>
              </Link>
            ))}
          </section>

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
            Ranks for division command. Department ladders are edited in each department&apos;s Administration panel.
            Saving a rank confirms it.
          </p>
          {s.departments.filter((d) => d.kind === 'oversight').map((d) => (
            <section key={d.key}>
              <h2 className="label mb-3">{d.name}</h2>
              <RankEditor d={d} ranks={(ranks ?? []).filter((r) => r.department_key === d.key)} back="/hub/admin?tab=ranks" />
            </section>
          ))}
        </div>
      )}

      {tab === 'routing' && (
        <div className="grid max-w-3xl gap-6">
          <p className="text-[14px] text-muted">
            The default reviewer for a shift log, by the submitter&apos;s tier. A department can override it in its Administration panel.
            Division command can always review its own division, and nobody can approve their own entry.
          </p>
          <div className="card overflow-x-auto">
            <table className="table">
              <thead><tr><th>Submitter</th><th>Reviewed by</th></tr></thead>
              <tbody>
                {(routes ?? []).filter((r) => !r.department_key).sort((a, b) => TIERS.indexOf(a.submitter_tier) - TIERS.indexOf(b.submitter_tier)).map((r) => (
                  <tr key={r.id}>
                    <td>{TIER_LABEL[r.submitter_tier]}</td><td>{TIER_LABEL[r.required_tier]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={adminSaveRoute} className="card grid gap-3 p-6 sm:grid-cols-3 sm:items-end">
            <input type="hidden" name="back" value="/hub/admin?tab=routing" />
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
