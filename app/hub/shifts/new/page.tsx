import { redirect } from 'next/navigation';
import { ShiftForm, type ShiftDept } from '@/components/ShiftForm';
import { PageHead } from '@/components/ui';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Log a shift' };

export default async function NewShift({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const depts: ShiftDept[] = s.departments.filter((d) => d.kind === 'department' && s.active.some((m) => m.department_key === d.key));
  if (!depts.length) redirect('/hub');
  const preferred = depts.find((d) => d.key === sp.dept) ?? depts.find((d) => d.key === s.current?.department_key) ?? depts[0];
  return (
    <div className="max-w-3xl">
      <PageHead eyebrow="Activity" title="Log a shift" />
      <ShiftForm depts={depts} initial={{ department: preferred.key, started_at: sp.start, ended_at: sp.end }} />
      <p className="mt-4 text-[13px] text-faint">
        Time can only be counted once. If these hours overlap another of your entries, in any department, the hub will ask you to adjust one.
      </p>
    </div>
  );
}
