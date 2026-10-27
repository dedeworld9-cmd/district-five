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
  const { cfg, depts: filing, options, subjects } = await formContext(s, sp.kind ?? '');
  // Command and admins without a department membership see the form read-only.
  const preview = !filing.length;
  const depts = preview && cfg
    ? s.departments.filter((d) => d.kind === 'department' && cfg.divisions.includes(d.division) && (s.isAdmin || s.oversees(d.key)))
    : filing;
  if (!cfg || !depts.length) redirect('/hub/reports');
  const preferred = depts.find((d) => d.key === sp.dept) ?? depts.find((d) => d.key === s.current?.department_key) ?? depts[0];

  return (
    <div className="max-w-3xl">
      <Link href="/hub/reports" className="text-[13px] text-muted hover:text-ink">← Reports &amp; requests</Link>
      <PageHead eyebrow={cfg.group === 'report' ? 'Report' : cfg.group === 'training' ? 'Training' : cfg.group === 'office' ? 'Office' : 'Request'} title={cfg.label} />
      <p className="-mt-4 mb-6 text-[14px] text-muted">{cfg.blurb}</p>
      {preview && (
        <p className="mb-4 rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-[14px] text-muted">
          Preview only. You&apos;re not on a department roster, so this form can&apos;t be submitted from your account.
        </p>
      )}
      <SubmissionForm preview={preview} kind={cfg.key} depts={depts} options={options} subjects={subjects} initial={{ department: preferred.key }} />
    </div>
  );
}
