// A simple department mark: a shield for law enforcement, a roundel for Fire/EMS and dispatch.
export function Emblem({ label, accent, division, size = 56 }: { label: string; accent: string; division: string; size?: number }) {
  const text = label.length > 4 ? 9 : 11;
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
      <defs>
        <linearGradient id={`em-${label}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} stopOpacity="0.28" />
          <stop offset="1" stopColor={accent} stopOpacity="0.04" />
        </linearGradient>
      </defs>
      {division === 'leo' ? (
        <path d="M28 4 47 11v15c0 12.5-8 21.5-19 26C17 47.5 9 38.5 9 26V11Z" fill={`url(#em-${label})`} stroke={accent} strokeOpacity="0.75" strokeWidth="1.5" />
      ) : (
        <>
          <circle cx="28" cy="28" r="23" fill={`url(#em-${label})`} stroke={accent} strokeOpacity="0.75" strokeWidth="1.5" />
          <circle cx="28" cy="28" r="18" fill="none" stroke={accent} strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 3" />
        </>
      )}
      <text x="28" y={division === 'leo' ? 31 : 32} textAnchor="middle" fontSize={text} fontWeight="700" letterSpacing="0.06em" fill={accent}>{label}</text>
    </svg>
  );
}
