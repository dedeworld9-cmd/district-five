'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LOGOS, PHOTOS, THEMES } from '@/lib/brand';
import { DIVISION_LABEL } from '@/lib/format';
import type { Department } from '@/lib/types';

type Unit = Pick<Department, 'key' | 'name' | 'short_name' | 'division' | 'tagline' | 'public_blurb' | 'accent'> & {
  ranks: string[]; joinHref: string; overseenBy: string | null;
};

// Front page department switcher: one department at a time, in its own colors.
export function DeptPicker({ units }: { units: Unit[] }) {
  const [key, setKey] = useState(units[0]?.key);
  const d = units.find((u) => u.key === key) ?? units[0];
  if (!d) return null;
  const t = THEMES[d.key] ?? { a: d.accent, b: d.accent, bg: '#08090b' };

  return (
    <div>
      <div role="tablist" aria-label="Departments" className="flex gap-2 overflow-x-auto pb-1">
        {units.map((u) => {
          const on = u.key === d.key;
          return (
            <button key={u.key} role="tab" aria-selected={on} aria-controls="dept-panel" onClick={() => setKey(u.key)}
              className={`press flex shrink-0 items-center gap-2.5 rounded-full py-2 pr-4 pl-2 text-[15px] font-medium transition-colors ${on ? 'bg-white text-black' : 'bg-white/[0.06] text-zinc-300 hover:bg-white/10 hover:text-white'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {LOGOS[u.key] && <img src={LOGOS[u.key]} alt="" width={28} height={28} className="h-7 w-7 object-contain" />}
              {u.short_name}
            </button>
          );
        })}
      </div>

      <div id="dept-panel" role="tabpanel" key={d.key} className="swap mt-6 grid overflow-hidden lg:grid-cols-2" style={{ background: t.bg }}>
        <div className="relative aspect-[4/3] lg:aspect-auto lg:min-h-[480px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={PHOTOS[d.key]} alt={`${d.name} unit`} className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <div className="flex flex-col p-6 sm:p-10 lg:p-12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {LOGOS[d.key] && <img src={LOGOS[d.key]} alt="" width={72} height={72} className="h-[72px] w-[72px] object-contain" />}
          <h3 className="mt-6 text-[30px] leading-[1.08] font-semibold tracking-tight text-white sm:text-[40px]">{d.name}</h3>
          <p className="mt-3 text-[17px] leading-relaxed text-zinc-200">
            {d.public_blurb ?? `${d.tagline ?? d.name}.`}
          </p>
          <p className="mt-2 text-[15px] text-zinc-400">
            {DIVISION_LABEL[d.division]}{d.overseenBy && `, overseen by ${d.overseenBy}`}.
          </p>
          {d.ranks.length > 0 && (
            <div className="mt-8">
              <h4 className="text-[15px] font-semibold text-white">Ranks, from first day to the top</h4>
              <ol className="mt-3 flex flex-wrap gap-x-2 gap-y-1.5 text-[15px] text-zinc-300">
                {d.ranks.map((r, i) => (
                  <li key={r} className="flex items-center gap-2">
                    {r}{i < d.ranks.length - 1 && <span aria-hidden="true" style={{ color: t.b }}>›</span>}
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="mt-auto flex flex-wrap items-center gap-4 pt-10">
            <Link href={d.joinHref} className="press inline-flex h-12 items-center rounded-full px-6 text-[15px] font-semibold text-white"
              style={{ background: t.a }}>
              Request to join {d.short_name}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
