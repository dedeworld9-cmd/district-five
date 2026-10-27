import type { Session } from './session';
import { atLeast } from './tiers';
import type { Tier } from './types';

// Mirrors public.can_decide in the database. The database is the authority; this only hides buttons.
export function canDecide(s: Session, dept: string, required: Tier, submitter: string) {
  if (submitter === s.userId) return false;
  if (s.oversees(dept)) return true;
  return required !== 'dps' && atLeast(s.tierIn(dept), required);
}
