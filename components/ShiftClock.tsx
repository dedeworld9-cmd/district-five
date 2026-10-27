'use client';

import { useEffect, useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');

// Live elapsed time since the member went on duty. Renders a placeholder until mounted so
// the server and browser clocks never disagree in the first paint.
export function ShiftClock({ since, className = '' }: { since: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span className={`tabular-nums ${className}`}>--:--:--</span>;
  const secs = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return (
    <span className={`tabular-nums ${className}`}>
      {pad(Math.floor(secs / 3600))}:{pad(Math.floor(secs / 60) % 60)}:{pad(secs % 60)}
    </span>
  );
}
