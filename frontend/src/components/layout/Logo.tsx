export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="qdx-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2E6BB0" />
          <stop offset="1" stopColor="#7B3FA0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#qdx-logo)" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="#fff" strokeWidth="3" opacity=".92" />
      <ellipse cx="32" cy="32" rx="17" ry="6" fill="none" stroke="#fff" strokeWidth="2" opacity=".5" />
      <g>
        <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="8s" repeatCount="indefinite" />
        <line x1="32" y1="32" x2="43" y2="20" stroke="#E8770E" strokeWidth="4" strokeLinecap="round" />
        <circle cx="43" cy="20" r="3.8" fill="#E8770E" />
      </g>
      <circle cx="32" cy="32" r="2.4" fill="#fff" />
    </svg>
  );
}
