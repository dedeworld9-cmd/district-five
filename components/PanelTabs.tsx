import Link from 'next/link';
import { canOpen, PANELS, type PanelKey } from '@/lib/panels';
import type { Session } from '@/lib/session';
import type { Department } from '@/lib/types';

// Panel switcher and department switcher shown at the top of every panel.
export function PanelTabs({ s, panel, dept, depts }: { s: Session; panel: PanelKey; dept: Department; depts: Department[] }) {
  const href = PANELS.find((p) => p.key === panel)!.href;
  return (
    <div className="mb-8 grid gap-3">
      <div className="flex flex-wrap gap-1">
        {PANELS.filter((p) => canOpen(s, p.key, dept.key)).map((p) => (
          <Link key={p.key} href={`${p.href}?dept=${dept.key}`} aria-current={p.key === panel ? 'page' : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] ${p.key === panel ? 'border-[var(--theme-a)]/50 bg-[var(--theme-a)]/15 text-ink' : 'border-line text-muted hover:text-ink'}`}>
            {p.label}
          </Link>
        ))}
      </div>
      {depts.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {depts.map((d) => (
            <Link key={d.key} href={`${href}?dept=${d.key}`}
              className={`rounded-full px-3 py-1 text-[12px] ${d.key === dept.key ? 'bg-white/[0.08] text-ink' : 'text-muted hover:text-ink'}`}>{d.short_name}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
