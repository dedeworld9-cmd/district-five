'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PUBLIC_NAV, SITE } from '@/lib/site';
import { DiscordIcon } from './icons';
import { isCurrent, MobileMenu } from './MobileMenu';

// Public header: badge and name, the page links, and one call to action for members.
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const path = usePathname();
  const members = signedIn ? { href: '/hub', label: 'Member hub' } : { href: '/login', label: 'Member sign in' };
  const discord = SITE.discordInvite;
  return (
    <header className="sticky top-0 z-40 pt-3 sm:pt-4">
      <div className="container-page">
        <div className="relative flex h-14 items-center gap-2 rounded-full border border-line bg-bg/80 pr-2 pl-2 backdrop-blur-md">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-full py-1 pr-3 pl-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={SITE.logo} alt="" width={36} height={36} className="h-9 w-9 shrink-0" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[14px] font-semibold tracking-tight">
                <span className="lg:hidden">{SITE.shortName}</span>
                <span className="hidden lg:inline">{SITE.name}</span>
              </span>
              <span className="block truncate text-[12px] text-muted">{SITE.community.name}</span>
            </span>
          </Link>
          <nav aria-label="Main" className="mx-auto hidden md:block">
            <ul className="flex items-center gap-1">
              {PUBLIC_NAV.map((i) => {
                const on = isCurrent(path, i.href);
                return (
                  <li key={i.href}>
                    <Link href={i.href} aria-current={on ? 'page' : undefined}
                      className={`flex h-9 items-center rounded-full px-3.5 text-[14px] transition-colors ${on ? 'bg-white/[0.09] text-ink' : 'text-muted hover:bg-white/[0.05] hover:text-ink'}`}>
                      {i.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="ml-auto hidden items-center gap-1.5 md:flex">
            {discord && (
              <a href={discord} target="_blank" rel="noreferrer" aria-label="Join the Discord (opens in a new tab)"
                className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-white/[0.06] hover:text-ink"><DiscordIcon size={17} /></a>
            )}
            <Link href={members.href} className="btn btn-brand h-9 px-4 text-[13px] font-semibold">{members.label}</Link>
          </div>
          <MobileMenu className="ml-auto md:hidden"
            items={[...PUBLIC_NAV, ...(discord ? [{ href: discord, label: 'Discord', external: true }] : [])]}
            footer={<Link href={members.href} className="btn btn-brand btn-lg w-full">{members.label}</Link>} />
        </div>
      </div>
    </header>
  );
}
