export function Logo({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff3b44" />
          <stop offset="1" stopColor="#b0141c" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#lg)" />
      <rect x="12" y="20" width="40" height="26" rx="5" fill="none" stroke="#fff" strokeWidth="3.5" />
      <rect x="12" y="26" width="40" height="5" fill="#fff" />
      <path d="M34 34 l-5 8 h5 l-3 7 l9 -10 h-5 l3 -5 z" fill="#f5c542" stroke="#7a1218" strokeWidth="1" />
    </svg>
  );
}
