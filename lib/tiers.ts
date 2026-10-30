import type { Tier } from './types';

export const TIERS: Tier[] = ['probationary', 'patrol', 'supervisor', 'high_command', 'department_head', 'dps'];

export const TIER_LABEL: Record<Tier, string> = {
  probationary: 'Probationary',
  patrol: 'Patrol',
  supervisor: 'Supervisor',
  high_command: 'High command',
  department_head: 'Department head',
  dps: 'Division command',
};

export const tierRank = (t: Tier | null | undefined) => (t ? TIERS.indexOf(t) + 1 : 0);
export const atLeast = (t: Tier | null | undefined, min: Tier) => tierRank(t) >= tierRank(min);

// Mirrors public.can_grant_rank. The database enforces it; this only decides which ranks to offer.
// In HCSO the Office of the Sheriff may grant any rank below their own; elsewhere a rank must be a
// lower tier than the granter's.
export function canGrantRank(
  who: { unrestricted: boolean; dept: string; tier: Tier | null; rankSort: number | null },
  rank: { tier: Tier; sort_order: number },
): boolean {
  if (who.unrestricted) return true;
  if (who.dept === 'hcso' && atLeast(who.tier, 'department_head')) return who.rankSort !== null && who.rankSort > rank.sort_order;
  return tierRank(rank.tier) < tierRank(who.tier ?? 'probationary');
}
