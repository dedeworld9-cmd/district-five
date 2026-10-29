import Link from 'next/link';
import { Brand, Footer } from '@/components/ui';
import { NavLinks } from '@/components/NavLinks';
import { MobileMenu } from '@/components/site/MobileMenu';
import { ShiftClock } from '@/components/ShiftClock';
import { canDecide } from '@/lib/queue';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import type { Tier } from '@/lib/types';
import { DEFAULT_THEME, PHOTOS, THEMES } from '@/lib/brand';
import { SITE } from '@/lib/site';

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
    ...(!member ? [{ href: '/hub/join', label: 'Join HCSO' }] : []),
    ...(member && !patrol ? [{ href: '/hub/shifts', label: 'Shifts' }] : []),
    ...(member ? [{ href: '/hub/reports', label: 'Reports' }, { href: '/hub/board', label: 'Board' }] : []),
    ...(s.supervised.length ? [{ href: '/hub/command', label: 'Panels' }] : []),
    ...(reviewer ? [{ href: '/hub/approvals', label: 'Approvals', count: queue }] : []),
    ...(member || s.isAdmin ? [{ href: '/hub/roster', label: 'Roster' }] : []),
    ...(member ? [{ href: '/hub/announcements', label: 'News' }] : []),
    ...(member && !patrol ? [{ href: '/hub/resources', label: 'Resources' }] : []),
    ...(s.isAdmin ? [{ href: '/hub/admin', label: 'Admin' }] : []),
  ];
  const c = s.current;
  const onShift = s.active.find((m) => m.duty_status === 'on_duty' && m.duty_changed_at);
  const theme = THEMES[c?.department_key ?? SITE.department] ?? DEFAULT_THEME;
  const photo = c ? PHOTOS[c.department_key] : undefined;

  return (
    <div className="min-h-screen" style={{ '--accent': s.currentDept?.accent ?? '#cfae5a', '--theme-a': theme.a, '--theme-b': theme.b, '--theme-bg': theme.bg } as React.CSSProperties}>
      <div className="app-bg" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo} alt="" className="app-photo" />}
        <div className="app-grid" />
      </div>
      <div className="lightbar fixed inset-x-0 top-0 z-30 opacity-70" aria-hidden="true" />
      <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6 sm:pt-4 lg:px-10 min-[1440px]:px-16">
        <div className="relative mx-auto flex max-w-[1472px] items-center gap-2 rounded-full border border-line bg-surface/85 py-1.5 pr-1.5 pl-4 backdrop-blur-md sm:gap-3">
          <Brand />
          <div className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <div className="hidden min-w-0 flex-1 md:block"><NavLinks items={items} /></div>
          <div className="flex-1 md:hidden" />
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
          <Link href="/hub/profile" aria-label={`Profile: ${s.profile.display_name}`} className="flex h-8 shrink-0 items-center gap-2 rounded-full border border-gold/30 pr-1 pl-1 lg:pr-3">
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-gold/15 px-1.5 text-[11px] font-semibold text-gold">
              {c?.callsign ?? s.profile.display_name.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-[120px] truncate text-[12px] font-medium lg:block">{s.profile.display_name}</span>
          </Link>
          <MobileMenu className="md:hidden" items={[...items, { href: '/', label: 'Public site' }]} />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1600px] px-4 pt-10 sm:px-6 sm:pt-14 lg:px-10 min-[1440px]:px-16">{children}</main>
      <Footer />
    </div>
  );
}
