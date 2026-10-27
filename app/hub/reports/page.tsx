import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PrintHeader, SaveRecord } from '@/components/SaveRecord';
import { Empty, Flash, PageHead, StatusTag } from '@/components/ui';
import { relative } from '@/lib/format';
import { GROUP_LABEL, KIND, KINDS } from '@/lib/kinds';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Submission } from '@/lib/types';

export const metadata = { title: 'Reports & requests' };

export default async function Reports({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  if (!s.active.length) redirect('/hub');
  const supabase = await createClient();
  const { data: mine } = await supabase.from('submissions').select('*').eq('profile_id', s.userId)
    .order('created_at', { ascending: false }).limit(50).returns<Submission[]>();

  // Kinds the caller can file in at least one of their departments.
  const myDivisions = new Set<string>(s.active.map((m) => s.departments.find((d) => d.key === m.department_key))
    .filter((d) => d?.kind === 'department').map((d) => d!.division));
  const available = KINDS.filter((k) => k.divisions.some((d) => myDivisions.has(d)));
  const short = (k: string) => s.departments.find((d) => d.key === k)?.short_name ?? k;

  return (
    <>
      <Flash searchParams={sp} />
      <PageHead eyebrow="Paperwork" title="Reports & requests" />
      <PrintHeader title="Reports and requests" sub={s.profile.display_name} />

      <div className="grid gap-8">
        {(['report', 'request', 'office', 'training'] as const).map((g) => {
          const kinds = available.filter((k) => k.group === g);
          if (!kinds.length) return null;
          return (
            <section key={g} className="no-print">
              <h2 className="label mb-3">{GROUP_LABEL[g]}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {kinds.map((k) => (
                  <Link key={k.key} href={`/hub/reports/new?kind=${k.key}`} className="card p-5 transition-colors hover:border-line-strong">
                    <div className="text-[15px] font-medium">{k.label}</div>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">{k.blurb}</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="label">My history</h2>
            {!!mine?.length && <SaveRecord title="My reports" />}
          </div>
          {mine?.length ? (
            <div className="card overflow-x-auto">
              <table className="table">
                <thead><tr><th>Ref</th><th>What</th><th>Department</th><th>Updated</th><th>Status</th></tr></thead>
                <tbody>
                  {mine.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-[13px]"><Link href={`/hub/reports/${r.id}`} className="hover:text-gold">{r.ref}</Link></td>
                      <td><Link href={`/hub/reports/${r.id}`} className="hover:text-gold">{r.title}</Link>
                        <div className="text-[12px] text-faint">{KIND[r.kind]?.label}</div></td>
                      <td className="text-muted">{short(r.department_key)}</td>
                      <td className="whitespace-nowrap text-muted">{relative(r.created_at)}</td>
                      <td><StatusTag status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty>Nothing filed yet.</Empty>}
        </section>
      </div>
    </>
  );
}
