export function supabaseUrl() {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set. Copy .env.example to .env.local.');
  return v;
}

export function supabaseKey() {
  const v = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!v) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Copy .env.example to .env.local.');
  return v;
}

// The persona sign-in only exists when explicitly enabled AND pointed at a local backend.
export function devLoginEnabled() {
  return process.env.NEXT_PUBLIC_D5_DEV_LOGIN === '1' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
}
