import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PrintHeader, SaveRecord } from '@/components/SaveRecord';
import { Empty, PageHead, StatusTag } from '@/components/ui';
import { dateOnly, relative } from '@/lib/format';
import { KIND, KINDS } from '@/lib/kinds';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Submission } from '@/lib/types';

export const metadata = { title: 'Records' };

const STATUSES = ['submitted', 'under_review', 'approved', 'returned', 'denied', 'archived', 'withdrawn'];

// Every report and request filed in a department, for supervisors and command. Searchable.
export default async function Records({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const depts = s.supervised;
  if (!depts.length) redirect('/hub/reports');
  const dept = depts.find((d) => d.key === sp.dept) ?? depts.find((d) => d.key === s.current?.department_key) ?? depts[0];
  const kinds = KINDS.filter((k) => k.divisions.includes(dept.division));
  const kind = kinds.some((k) => k.key === sp.kind) ? sp.kind : undefined;
  const status = STATUSES.includes(sp.status ?? '') ? sp.status : undefined;
  const q = (sp.q ?? '').trim().slice(0, 60);

  const supabase = await createClient();
  let query = supabase.from('submissions').select('*').eq('department_key', dept.key).neq('status', 'draft');
  if (kind) query = query.eq('kind', kind);
  if (status) query = query.eq('status', status);
  if (q) {
    const safe = q.replace(/[%_,()]/g, ' ');
    query = query.or(`title.ilike.%${safe}%,ref.ilike.%${safe}%,snapshot_name.ilike.%${safe}%`);
  }
  const { data: rows } = await query.order('created_at', { ascending: false }).limit(100).returns<Submission[]>();
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { dept: dept.key, kind, status, q: q || undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/hub/records?${p.toString()}`;
  };

  return (
    <>
      <PageHead eyebrow={`${dept.short_name} · Supervisors`} title="Records">
        {!!rows?.length && <SaveRecord title={`${dept.short_name} records`} />}
        {depts.length > 1 && (
          <div className="no-print flex flex-wrap gap-1">
            {depts.map((d) => (
              <Link key={d.key} href={`/hub/records?dept=${d.key}`}
                className={`rounded-full px-3 py-1.5 text-[13px] ${d.key === dept.key ? 'bg-white/[0.08] text-ink' : 'text-muted hover:text-ink'}`}>{d.short_name}</Link>
            ))}
          </div>
        )}
      </PageHead>

      <PrintHeader title={`${dept.name} records`} sub={[kind && KIND[kind]?.label, status, q && `“${q}”`].filter(Boolean).join(' · ') || 'All records'} />
      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="dept" value={dept.key} />
        <label className="field"><span>Search</span>
          <input name="q" className="input" defaultValue={q} placeholder="Reference, title or member name" />
        </label>
        <label className="field"><span>Type</span>
          <select name="kind" className="input" defaultValue={kind ?? ''}>
            <option value="">All types</option>
            {kinds.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        </label>
        <label className="field"><span>Status</span>
          <select name="status" className="input" defaultValue={status ?? ''}>
            <option value="">Any status</option>
            {STATUSES.map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}
          </select>
        </label>
        <button className="btn-primary">Filter</button>
      </form>
      {(kind || status || q) && <Link href={link({ kind: undefined, status: undefined, q: undefined })} className="mb-4 inline-block text-[13px] text-muted hover:text-ink">Clear filters</Link>}

      {rows?.length ? (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Ref</th><th>What</th><th>Filed by</th><th>Date</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-[12px] whitespace-nowrap"><Link href={`/hub/reports/${r.id}`} className="hover:text-gold">{r.ref}</Link></td>
                  <td>
                    <Link href={`/hub/reports/${r.id}`} className="hover:text-gold">{r.title}</Link>
                    <div className="text-[12px] text-faint">{KIND[r.kind]?.label ?? r.kind}</div>
                  </td>
                  <td>{r.snapshot_callsign && <span className="mr-1.5 font-mono text-[12px] text-muted">{r.snapshot_callsign}</span>}{r.snapshot_name}</td>
                  <td className="whitespace-nowrap text-muted">{r.occurred_on ? dateOnly(r.occurred_on) : relative(r.created_at)}</td>
                  <td><StatusTag status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>No records match.</Empty>}
      {rows?.length === 100 && <p className="mt-3 text-[12px] text-faint">Showing the latest 100. Narrow the search to find older records.</p>}
    </>
  );
}
