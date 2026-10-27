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
