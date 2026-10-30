import Link from 'next/link';
import { Brand } from '@/components/ui';
import { Frame } from '@/components/ops/Frame';
import { ShiftClock } from '@/components/ShiftClock';
import { requireSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { navFor } from '@/lib/workspaces';
import { TIER_LABEL } from '@/lib/tiers';

// The member hub shell. Navigation only lists what this member may open; every page still checks
// its own gate on the server.
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const supabase = await createClient();
  const { count: unread } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  const nav = navFor(s);
  const c = s.current;
  const onShift = s.active.find((m) => m.duty_status === 'on_duty' && m.duty_changed_at);
  const name = s.profile.display_name;

  const right = (
    <div className="flex shrink-0 items-center gap-2">
      {onShift ? (
        <Link href="/hub/patrol" title="Patrol in progress" className="flex h-10 items-center gap-2 rounded-full border border-ok/40 bg-ok/10 px-3 text-[13px] font-medium text-ok">
          <span className="on-duty-ring h-1.5 w-1.5 rounded-full bg-ok" />
          <ShiftClock since={onShift.duty_changed_at!} className="tnum font-mono" />
        </Link>
      ) : s.active.length > 0 ? (
        <Link href="/hub/patrol" className="btn-primary hidden h-10 px-4 text-[13px] sm:inline-flex">Start patrol</Link>
      ) : null}
      <details className="group relative">
        <summary aria-label={`Account menu for ${name}`} className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] pr-2 pl-1.5 marker:hidden [&::-webkit-details-marker]:hidden">
          <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-brand-soft px-1.5 text-[11px] font-semibold text-gold">{c?.callsign ?? name.slice(0, 1).toUpperCase()}</span>
          <span className="hidden max-w-[140px] truncate text-[13px] font-medium md:block">{name}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-faint" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div className="glass pop absolute top-full right-0 z-30 mt-2 w-60 rounded-xl border p-2 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)]">
          <div className="px-3 py-2">
            <div className="truncate text-[14px] font-medium">{name}</div>
            <div className="truncate text-[12px] text-muted">{c ? [c.rank_name, c.callsign, TIER_LABEL[c.tier]].filter(Boolean).join(' · ') : 'Not on the roster yet'}</div>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link href="/hub/profile" className="flex min-h-10 items-center rounded-lg px-3 text-[14px] text-muted hover:bg-white/[0.05] hover:text-ink">Profile</Link>
          <Link href="/hub/notifications" className="flex min-h-10 items-center justify-between rounded-lg px-3 text-[14px] text-muted hover:bg-white/[0.05] hover:text-ink">
            Notifications{!!unread && <span className="tag">{unread}</span>}
          </Link>
          <Link href="/" className="flex min-h-10 items-center rounded-lg px-3 text-[14px] text-muted hover:bg-white/[0.05] hover:text-ink">Public site</Link>
          <form action="/auth/signout" method="post">
            <button className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-[14px] text-muted hover:bg-white/[0.05] hover:text-ink">Sign out</button>
          </form>
        </div>
      </details>
    </div>
  );

  return (
    <Frame nav={nav} brand={<Brand href="/hub" />} headerRight={right}>
      {children}
      <footer className="mt-16 border-t border-line pt-6 text-[12px] leading-relaxed text-faint">
        HCSO is a roleplay department on Florida State Roleplay (Roblox ER:LC). It is not the real Hillsborough County Sheriff&apos;s Office or any government agency.
        Do not enter real-world personal information.
      </footer>
    </Frame>
  );
}
