import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Emblem } from '@/components/Emblem';
import { PageHead } from '@/components/ui';
import { EQUIPMENT, EQUIPMENT_LABEL, EQUIPMENT_NOTE, equipmentKinds, type EquipmentKind } from '@/lib/equipment';
import { requireSession } from '@/lib/session';

export const metadata = { title: 'Equipment' };

// Uniform, vehicle and weapon standards for one department, one item at a time.
export default async function Equipment({ params, searchParams }: {
  params: Promise<{ kind: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ kind }, sp] = await Promise.all([params, searchParams]);
  if (!(kind in EQUIPMENT_LABEL)) notFound();
  const s = await requireSession();
  if (!s.active.length && !s.isAdmin) redirect('/hub');
  const withContent = s.departments.filter((d) => equipmentKinds(d.key).length);
  const mine = withContent.filter((d) => s.active.some((m) => m.department_key === d.key) || s.oversees(d.key) || s.isAdmin);
  const dept = mine.find((d) => d.key === sp.dept) ?? mine.find((d) => d.key === s.current?.department_key) ?? mine[0];
  if (!dept) redirect('/hub/resources');
  const kinds = equipmentKinds(dept.key);
  const list = EQUIPMENT[dept.key]?.[kind as EquipmentKind] ?? [];
  if (!list.length) redirect(`/hub/equipment/${kinds[0]}?dept=${dept.key}`);
  const i = Math.min(Math.max(Number(sp.item) || 0, 0), list.length - 1);
  const item = list[i];
  const groups = [...new Set(list.map((x) => x.group ?? ''))];

  return (
    <div style={{ '--accent': dept.accent } as React.CSSProperties}>
      <PageHead eyebrow={`${dept.short_name} · Standards`} title={EQUIPMENT_LABEL[kind as EquipmentKind]}>
        <div className="flex flex-wrap gap-1">
          {kinds.map((k) => (
            <Link key={k} href={`/hub/equipment/${k}?dept=${dept.key}`}
              className={`rounded-full px-3 py-1.5 text-[13px] ${k === kind ? 'bg-white/[0.08] text-ink' : 'text-muted hover:text-ink'}`}>{EQUIPMENT_LABEL[k]}</Link>
          ))}
        </div>
      </PageHead>

      {mine.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-1">
          {mine.map((d) => (
            <Link key={d.key} href={`/hub/equipment/${kind}?dept=${d.key}`}
              className={`rounded-full px-3 py-1 text-[12px] ${d.key === dept.key ? 'bg-white/[0.08]' : 'text-muted'}`}>{d.short_name}</Link>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <nav className="grid content-start gap-5">
          {groups.map((g) => (
            <div key={g}>
              {g && <div className="label mb-2">{g}</div>}
              <div className="grid gap-1.5">
                {list.map((x, n) => (x.group ?? '') === g && (
                  <Link key={n} href={`/hub/equipment/${kind}?dept=${dept.key}&item=${n}`} scroll={false}
                    className={`card px-4 py-3 ${n === i ? 'border-[color:var(--accent)]/60 bg-white/[0.05]' : 'hover:border-line-strong'}`}>
                    <div className="text-[14px] font-medium">{x.title}</div>
                    <div className="text-[12px] text-muted">{x.subtitle}</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <article className="card overflow-hidden">
          {item.img && (
            <a href={item.img} target="_blank" rel="noreferrer noopener" className="block bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.img} alt={`${item.title} reference`} className="max-h-[460px] w-full object-contain" />
            </a>
          )}
          <div className="accent-line" />
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              <Emblem dept={dept.key} label={dept.short_name} accent={dept.accent} division={dept.division} size={40} />
              <div>
                {item.group && <div className="label">{item.group}</div>}
                <h2 className="text-[22px] font-semibold tracking-tight">{item.title}</h2>
                <div className="text-[13px] text-muted">{item.subtitle}</div>
              </div>
            </div>
            {item.notes?.map((n) => <p key={n} className="mt-4 text-[14px] text-muted">{n}</p>)}
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {item.sections.map((sec) => (
                <section key={sec.h}>
                  <h3 className={`label mb-2 ${sec.h === 'Not permitted' ? '!text-bad' : ''}`}>{sec.h}</h3>
                  <dl className="divide-y divide-line rounded-xl border border-line">
                    {sec.items.map((it, n) => Array.isArray(it) ? (
                      <div key={n} className="flex justify-between gap-4 px-3 py-2 text-[13px]">
                        <dt className="text-muted">{it[0]}</dt><dd className="text-right">{it[1]}</dd>
                      </div>
                    ) : (
                      <div key={n} className="px-3 py-2 text-[13px]">{it}</div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
            <p className="mt-6 text-[12px] text-faint">{EQUIPMENT_NOTE[kind as EquipmentKind]}</p>
          </div>
        </article>
      </div>
    </div>
  );
}
