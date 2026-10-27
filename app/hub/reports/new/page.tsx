import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SubmissionForm } from '@/components/SubmissionForm';
import { PageHead } from '@/components/ui';
import { requireSession } from '@/lib/session';
import { formContext } from '@/lib/submissions';

export const metadata = { title: 'New report or request' };

export default async function NewSubmission({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const { cfg, depts, options, subjects } = await formContext(s, sp.kind ?? '');
  if (!cfg || !depts.length) redirect('/hub/reports');
  const preferred = depts.find((d) => d.key === sp.dept) ?? depts.find((d) => d.key === s.current?.department_key) ?? depts[0];

  return (
    <div className="max-w-3xl">
      <Link href="/hub/reports" className="text-[13px] text-muted hover:text-ink">← Reports &amp; requests</Link>
      <PageHead eyebrow={cfg.group === 'report' ? 'Report' : cfg.group === 'training' ? 'Training' : cfg.group === 'office' ? 'Office' : 'Request'} title={cfg.label} />
      <p className="-mt-4 mb-6 text-[14px] text-muted">{cfg.blurb}</p>
      <SubmissionForm kind={cfg.key} depts={depts} options={options} subjects={subjects} initial={{ department: preferred.key }} />
    </div>
  );
}
