import Link from 'next/link';
import { Empty } from '@/components/ui';
import { DiscordLink, Panel, ResourceGrid, WorkspaceHeader } from '@/components/ops/kit';
import { dateOnly, hours } from '@/lib/format';
import type { Session } from '@/lib/session';
import { SITE } from '@/lib/site';
import { createClient } from '@/lib/supabase/server';
import type { MemberCertification, ShiftLog } from '@/lib/types';

export async function TrainingOverview({ s }: { s: Session }) {
  const supabase = await createClient();
  const me = s.active.find((m) => m.department_key === SITE.department) ?? s.active[0];
  const [{ data: certs }, { data: logs }, { data: offered }] = await Promise.all([
    supabase.from('member_certifications').select('*').eq('membership_id', me.id).is('revoked_at', null).order('name').returns<MemberCertification[]>(),
    supabase.from('shift_logs').select('duration_minutes,started_at,status').eq('profile_id', s.userId).eq('department_key', SITE.department)
      .eq('activity_type', 'training').in('status', ['approved', 'submitted', 'under_review']).returns<Pick<ShiftLog, 'duration_minutes' | 'started_at' | 'status'>[]>(),
    supabase.from('department_options').select('name,description').eq('department_key', SITE.department).eq('kind', 'certification').order('sort_order').returns<{ name: string; description: string | null }[]>(),
  ]);
  const approved = (logs ?? []).filter((l) => l.status === 'approved').reduce((n, l) => n + l.duration_minutes, 0);
  const waiting = (logs ?? []).filter((l) => l.status !== 'approved').reduce((n, l) => n + l.duration_minutes, 0);
  const held = new Set((certs ?? []).map((c) => c.name));

  return (
    <>
      <WorkspaceHeader title="Training & Range" description="Examinations, qualification trainings and availability for HCSO members.">
        <Link href="/hub/shifts/new" className="btn">Log training time</Link>
      </WorkspaceHeader>

      <section className="mb-5 rounded-[14px] border border-line-strong p-5 md:min-h-[160px] md:p-7" style={{ background: 'linear-gradient(120deg, #101f35 0%, #173d32 100%)' }}>
        <div className="max-w-3xl">
          <h2 className="text-[20px] font-semibold md:text-[22px]">Start with the BLS examination</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink/80">Examinations and qualification trainings are run in the HCSO Discord. Results and certifications are recorded by trainers, never by this page. Post your availability so a trainer can schedule you.</p>
          <div className="mt-5 flex flex-wrap gap-3"><DiscordLink channel="bls-exam" className="btn-primary" label="Open the BLS exam channel" /><DiscordLink channel="qualification-trainings" className="btn" label="Qualification trainings" /></div>
        </div>
      </section>

      <ResourceGrid items={[
        { title: 'BLS Examination', desc: 'Take or schedule the Basic Life Support exam.', icon: 'cap', channel: 'bls-exam', tag: 'Discord · all members' },
        { title: 'Qualification Trainings', desc: 'See upcoming trainings and sign-ups.', icon: 'list', channel: 'qualification-trainings', tag: 'Discord · all members' },
        { title: 'Miscellaneous Availability', desc: 'Tell trainers when you are free for training.', icon: 'clock', channel: 'misc-availability', tag: 'Discord · all members' },
      ]} />

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Panel title="Your training record">
          <dl className="grid grid-cols-2 gap-3 text-[14px]">
            <div className="rounded-xl border border-line p-4"><dt className="text-[12px] text-muted">Approved training hours</dt><dd className="tnum mt-1 text-[22px] font-semibold">{hours(approved)}</dd></div>
            <div className="rounded-xl border border-line p-4"><dt className="text-[12px] text-muted">Waiting for review</dt><dd className="tnum mt-1 text-[22px] font-semibold">{hours(waiting)}</dd></div>
          </dl>
          <h3 className="mt-5 mb-2 text-[13px] text-muted">Certifications held</h3>
          {certs?.length ? (
            <ul className="grid gap-2">{certs.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 text-[14px]"><span className="tag tag-gold">{c.name}</span><span className="text-[12px] text-faint">{dateOnly(c.granted_at)}{c.granted_by_name ? ` · ${c.granted_by_name}` : ''}</span></li>
            ))}</ul>
          ) : <Empty>No certifications are recorded for you yet.</Empty>}
        </Panel>
        <Panel title="Certifications the department offers">
          {offered?.length ? (
            <ul className="divide-y divide-line">{offered.map((o) => (
              <li key={o.name} className="flex items-start justify-between gap-3 py-3 text-[14px]">
                <span className="min-w-0"><span className="block font-medium">{o.name}</span>{o.description && <span className="text-[12px] text-muted">{o.description}</span>}</span>
                <span className={`tag ${held.has(o.name) ? 'tag-ok' : ''}`}>{held.has(o.name) ? 'Held' : 'Not held'}</span>
              </li>
            ))}</ul>
          ) : <p className="body-sm">Command has not listed certifications in the hub yet. Qualification trainings are announced in Discord.</p>}
        </Panel>
      </div>
    </>
  );
}
