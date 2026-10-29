import Link from 'next/link';
import { PUBLIC_NAV, SITE } from '@/lib/site';

export function SiteFooter({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-[1fr_auto]">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SITE.logo} alt="" width={40} height={40} className="h-10 w-10 shrink-0" />
          <div>
            <div className="text-[14px] font-semibold">{SITE.name}</div>
            <p className="mt-1 max-w-sm text-[13px] text-muted">{SITE.welcome}</p>
          </div>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-muted">
            {PUBLIC_NAV.map((i) => <li key={i.href}><Link href={i.href} className="hover:text-ink">{i.label}</Link></li>)}
            <li><Link href={signedIn ? '/hub' : '/login'} className="hover:text-ink">{signedIn ? 'Member hub' : 'Member sign in'}</Link></li>
            {SITE.discordInvite && <li><a href={SITE.discordInvite} target="_blank" rel="noreferrer" className="hover:text-ink">Discord</a></li>}
            <li><a href={SITE.community.robloxGroup} target="_blank" rel="noreferrer" className="hover:text-ink">Roblox group</a></li>
          </ul>
        </nav>
      </div>
      <div className="container-page">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-6 text-[12px] leading-relaxed text-faint">
        <p className="max-w-3xl">
          {SITE.shortName} is a roleplay department on {SITE.community.name} ({SITE.community.game}). Everyone and everything here is part of the game.
          It is not the real Hillsborough County Sheriff&apos;s Office or any government agency. Do not enter real-world personal information.
        </p>
        <span className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SITE.community.logo} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded" />
          {SITE.community.name} · {SITE.community.shortName}
        </span>
      </div>
      </div>
    </footer>
  );
}
