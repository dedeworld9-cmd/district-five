import type { PostgrestError } from '@supabase/supabase-js';

// Workflow functions raise D54xx codes with messages written for members, so those pass through.
export function friendly(error: PostgrestError | { code?: string; message: string } | null | undefined): string {
  if (!error) return 'Something went wrong.';
  const code = error.code ?? '';
  if (code.startsWith('D54')) return error.message;
  if (code === '42501') return 'You do not have permission to do that.';
  if (code === '23505') return 'That already exists.';
  if (code === '23514' || code === '22001') return 'One of the fields is too long or has an invalid value. Shorten it and try again.';
  if (code === '23P01') return 'Those hours overlap another entry.';
  console.error('[d5] unexpected database error', error);
  return 'Something went wrong. Try again, and tell an administrator if it keeps happening.';
}
