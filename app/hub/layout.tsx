import Link from 'next/link';
import { Brand, Footer } from '@/components/ui';
import { AutoSubmitSelect } from '@/components/AutoSubmitSelect';
import { Emblem } from '@/components/Emblem';
import { NavLinks } from '@/components/NavLinks';
import { ShiftClock } from '@/components/ShiftClock';
import { canDecide } from '@/lib/queue';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Tier } from '@/lib/types';
import { DEFAULT_THEME, PHOTOS, THEMES } from '@/lib/brand';
import { setActiveDepartment } from './actions';

export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const supabase = await createClient();
  const reviewer = s.supervised.length > 0 || s.isDps;
  type Open = { id: string; department_key: string; required_tier: Tier; profile_id: string };
  const none = Promise.resolve({ data: [] as Open[] });
  const [{ count: unread }, { data: open }, { data: subs }] = await Promise.all([
    supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
    reviewer ? supabase.from('shift_logs').select('id,department_key,required_tier,profile_id').in('status', ['submitted', 'under_review']).returns<Open[]>() : none,
    reviewer ? supabase.from('submissions').select('id,department_key,required_tier,profile_id').in('status', ['submitted', 'under_review']).returns<Open[]>() : none,
  ]);
  const queue = [...(open ?? []), ...(subs ?? [])].filter((l) => canDecide(s, l.department_key, l.required_tier, l.profile_id)).length;
  const member = s.active.length > 0;
  const patrol = s.currentDept?.kind === 'oversight';

  const items = [
    // Division command's home is its patrol panel: the shift clock, logs and paperwork in one place.
    patrol ? { href: '/hub/patrol', label: 'Patrol' } : { href: '/hub', label: 'Dashboard' },
    ...(!member ? [{ href: '/hub/join', label: 'Join a department' }] : []),
    ...(member && !patrol ? [{ href: '/hub/shifts', label: 'Shifts' }] : []),
    ...(member ? [{ href: '/hub/reports', label: 'Reports' }, { href: '/hub/board', label: 'Board' }] : []),
    // Division command reaches each department's panels from its oversight panel.
    ...(s.isDps ? [{ href: '/hub/oversight', label: 'Oversight' }] : s.supervised.length ? [{ href: '/hub/command', label: 'Panels' }] : []),
    ...(reviewer ? [{ href: '/hub/approvals', label: 'Approvals', count: queue }] : []),
    ...(member || s.isAdmin ? [{ href: '/hub/roster', label: 'Roster' }] : []),
    ...(member ? [{ href: '/hub/announcements', label: 'News' }] : []),
    // DPS has no resources of its own yet.
    ...(member && !patrol ? [{ href: '/hub/resources', label: 'Resources' }] : []),
    ...(s.isAdmin ? [{ href: '/hub/admin', label: 'Admin' }] : []),
  ];
  const c = s.current;
  const onShift = s.active.find((m) => m.duty_status === 'on_duty' && m.duty_changed_at);
  const theme = (c && THEMES[c.department_key]) || DEFAULT_THEME;
  const photo = c ? PHOTOS[c.department_key] : undefined;

  return (
    <div className="min-h-screen" style={{ '--accent': s.currentDept?.accent ?? '#cfae5a', '--theme-a': theme.a, '--theme-b': theme.b, '--theme-bg': theme.bg } as React.CSSProperties}>
      <div className="app-bg" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo} alt="" className="app-photo" />}
        <div className="app-grid" />
      </div>
      <div className="lightbar fixed inset-x-0 top-0 z-30 opacity-70" aria-hidden="true" />
      <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="mx-auto flex max-w-6xl items-center gap-3 rounded-full border border-line bg-surface/85 py-1.5 pr-1.5 pl-4 backdrop-blur-md">
          <Brand />
          <div className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <div className="hidden min-w-0 flex-1 md:block"><NavLinks items={items} /></div>
          <div className="flex-1 md:hidden" />
          {c && (
            <span className="hidden shrink-0 md:block" title={s.currentDept?.name}>
              <Emblem dept={c.department_key} label={s.currentDept?.short_name ?? ''} accent={s.currentDept?.accent ?? '#cfae5a'} division={s.currentDept?.division ?? 'leo'} size={26} />
            </span>
          )}
          {s.active.length > 1 && (
            <form action={setActiveDepartment} className="hidden md:block">
              <input type="hidden" name="back" value="/hub" />
              <label className="sr-only" htmlFor="dept-switch">Department</label>
              <AutoSubmitSelect id="dept-switch" name="department" defaultValue={c?.department_key}
                className="h-8 cursor-pointer rounded-full border border-line-strong bg-transparent px-3 text-[12px] font-medium text-ink">
                {s.active.map((m) => (
                  <option key={m.id} value={m.department_key} className="bg-surface">
                    {s.departments.find((d) => d.key === m.department_key)?.short_name ?? m.department_key}
                  </option>
                ))}
              </AutoSubmitSelect>
              <button className="sr-only">Switch</button>
            </form>
          )}
          {onShift && (
            <Link href="/hub" title="On shift" className="flex h-8 shrink-0 items-center gap-2 rounded-full border border-ok/40 bg-ok/10 px-3 text-[12px] font-medium text-ok">
              <span className="on-duty-ring h-1.5 w-1.5 rounded-full bg-ok" />
              <ShiftClock since={onShift.duty_changed_at!} className="font-mono" />
            </Link>
          )}
          <Link href="/hub/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
            className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:text-ink">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            {!!unread && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-gold" />}
          </Link>
          <Link href="/hub/profile" className="flex h-8 shrink-0 items-center gap-2 rounded-full border border-gold/30 pr-3 pl-1">
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-gold/15 px-1.5 text-[11px] font-semibold text-gold">
              {c?.callsign ?? s.profile.display_name.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-[120px] truncate text-[12px] font-medium lg:block">{s.profile.display_name}</span>
          </Link>
        </div>
        <div className="mx-auto mt-2 max-w-6xl rounded-full border border-line bg-surface/85 p-1 backdrop-blur-md md:hidden">
          <NavLinks items={items} />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14">{children}</main>
      <Footer />
    </div>
  );
}
