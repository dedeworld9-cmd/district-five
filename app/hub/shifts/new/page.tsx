import { redirect } from 'next/navigation';
import { ShiftForm, type ShiftDept } from '@/components/ShiftForm';
import { PageHead } from '@/components/ui';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Log a shift' };

export default async function NewShift({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const depts: ShiftDept[] = s.departments.filter((d) => s.active.some((m) => m.department_key === d.key));
  if (!depts.length) redirect('/hub');
  const ended = sp.ended === '1' && !!sp.start && !!sp.end;
  const mins = ended ? Math.floor((new Date(sp.end!).getTime() - new Date(sp.start!).getTime()) / 60000) : null;
  const preferred = depts.find((d) => d.key === sp.dept) ?? depts.find((d) => d.key === s.current?.department_key) ?? depts[0];
  return (
    <div className="max-w-3xl">
      <PageHead title={ended ? 'Shift ended' : 'Log a shift'} />
      {ended && (
        <div className="card mb-4 border-ok/30 p-5">
          <div className="text-[15px] font-medium">You were on shift for {mins !== null && mins >= 0 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : 'a while'}.</div>
          <p className="mt-1 text-[13px] text-muted">
            Your start and end times are filled in. Add your bodycam link{preferred.division === 'leo' ? ' (your proof)' : ''} and a short summary, then submit it for review.
            Nothing is sent until you press Submit.
          </p>
        </div>
      )}
      <ShiftForm depts={depts} initial={{
        department: preferred.key, started_at: sp.start, ended_at: sp.end,
        bodycam_status: ended && (preferred.division === 'leo' || preferred.bodycam_required) ? 'recorded' : undefined,
      }} />
      <p className="mt-4 text-[13px] text-faint">
        Time can only be counted once. If these hours overlap another of your entries, in any department, the hub will ask you to adjust one.
      </p>
    </div>
  );
}
