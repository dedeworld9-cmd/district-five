import type { NextConfig } from 'next';

// Next.js needs inline scripts and styles for hydration, so the policy cannot drop 'unsafe-inline'
// without nonces; it still blocks framing, foreign scripts, plugins and foreign form targets.
const supabaseOrigin = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin; } catch { return ''; }
})();
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}`.trim(),
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        { key: 'Content-Security-Policy', value: csp },
      ],
    }];
  },
};

export default nextConfig;
