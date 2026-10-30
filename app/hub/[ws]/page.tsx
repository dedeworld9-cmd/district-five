import { notFound } from 'next/navigation';
import { AccessDenied } from '@/components/ops/kit';
import { requireSession } from '@/lib/session';
import { WS, can } from '@/lib/workspaces';
import { DepartmentOverview } from '../_ops/department';
import { LoggingOverview } from '../_ops/logging';
import { TrainingOverview } from '../_ops/training';
import { HighRankingOverview } from '../_ops/high-ranking';

export async function generateMetadata({ params }: { params: Promise<{ ws: string }> }) {
  const { ws } = await params;
  return { title: WS[ws]?.label ?? 'Hub' };
}

// Workspace overviews. /hub/patrol has its own page. Gates are checked here on the server.
export default async function Overview({ params, searchParams }: { params: Promise<{ ws: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { ws } = await params;
  const w = WS[ws];
  if (!w || ws === 'patrol') notFound();
  const s = await requireSession();
  if (!can(s, w.gate)) return <AccessDenied gate={w.gate} />;
  switch (ws) {
    case 'department': return <DepartmentOverview s={s} />;
    case 'logging': return <LoggingOverview s={s} sp={await searchParams} />;
    case 'training': return <TrainingOverview s={s} />;
    case 'high-ranking': return <HighRankingOverview s={s} />;
  }
  notFound();
}
