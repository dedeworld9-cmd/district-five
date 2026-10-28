import Link from 'next/link';
import { JoinForm } from '@/components/JoinForm';
import { Empty, Flash, PageHead } from '@/components/ui';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Join a department' };

export default async function Join({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const s = await requireSession();
  const taken = new Set(s.mine.filter((m) => ['pending', 'active', 'suspended'].includes(m.status)).map((m) => m.department_key));
  const joinable = s.departments.filter((d) => d.kind === 'department' && !taken.has(d.key));
  const pending = s.mine.filter((m) => m.status === 'pending');
  const want = s.departments.find((d) => d.key === sp.dept);
  const back = `/hub/join${sp.dept ? `?dept=${encodeURIComponent(sp.dept)}` : ''}`;

  return (
    <div className="max-w-2xl">
      <Flash searchParams={sp} />
      <PageHead title={want && joinable.includes(want) ? `Join ${want.short_name}` : 'Join a department'} />
      {pending.length > 0 && (
        <div className="mb-6 grid gap-2">
          {pending.map((m) => (
            <p key={m.id} className="card px-4 py-3 text-[14px] text-muted">
              Your request to join {s.departments.find((d) => d.key === m.department_key)?.name} is waiting for command review.
            </p>
          ))}
        </div>
      )}
      {want && taken.has(want.key) && !pending.some((m) => m.department_key === want.key) && (
        <p className="mb-6 card px-4 py-3 text-[14px] text-muted">You are already on the {want.short_name} roster. <Link href="/hub" className="text-gold">Go to your dashboard</Link></p>
      )}
      {joinable.length
        ? <JoinForm joinable={joinable} preselect={sp.dept} name={s.profile.display_name} back={back} />
        : <Empty>You have a membership or request in every department.</Empty>}
    </div>
  );
}
