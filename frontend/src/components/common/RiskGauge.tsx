/** Animated risk gauge (dynamic element #16): needle sweeps to the probability over coloured risk bands with a threshold marker. */
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { RiskBands } from '@/lib/risk';
import { useReducedMotion } from '@/hooks';

export function RiskGauge({ value, bands, threshold, size = 260, label = 'Estimated probability' }: { value: number; bands: RiskBands; threshold: number; size?: number; label?: string }) {
  const reduced = useReducedMotion();
  const mv = useMotionValue(reduced ? value : 0);
  const angle = useTransform(mv, (v) => -90 + v * 180);
  const [txt, setTxt] = useState(0);
  useEffect(() => mv.on('change', (v) => setTxt(v)), [mv]);
  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { type: 'spring', stiffness: 60, damping: 11 });
    return () => c.stop();
  }, [value, mv, reduced]);
  const cx = size / 2, cy = size * 0.56, R = size * 0.4;
  const pt = (p: number, r = R) => {
    const a = Math.PI * (1 - p);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const arc = (a: number, b: number) => {
    const [x1, y1] = pt(a), [x2, y2] = pt(b);
    return `M${x1},${y1} A${R},${R} 0 0 1 ${x2},${y2}`;
  };
  const [tx1, ty1] = pt(threshold, R - 18), [tx2, ty2] = pt(threshold, R + 18);
  return (
    <svg width={size} height={size * 0.68} viewBox={`0 0 ${size} ${size * 0.68}`} role="img" aria-label={`${label}: ${(value * 100).toFixed(1)}%, decision threshold ${(threshold * 100).toFixed(0)}%`}>
      <defs>
        <filter id="gglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <path d={arc(0, 1)} stroke="var(--surface-3)" strokeWidth={22} fill="none" strokeLinecap="round" />
      <path d={arc(bands.low[0], bands.low[1])} stroke="var(--green)" strokeWidth={18} fill="none" opacity={0.85} />
      <path d={arc(bands.moderate[0], bands.moderate[1])} stroke="var(--saffron)" strokeWidth={18} fill="none" opacity={0.85} />
      <path d={arc(bands.high[0], bands.high[1])} stroke="var(--red)" strokeWidth={18} fill="none" opacity={0.85} />
      {Array.from({ length: 11 }, (_, i) => {
        const [a1, b1] = pt(i / 10, R - 14), [a2, b2] = pt(i / 10, R - 22);
        return <line key={i} x1={a1} y1={b1} x2={a2} y2={b2} stroke="var(--muted)" strokeWidth={1.2} />;
      })}
      <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="var(--fg)" strokeWidth={2.5} strokeDasharray="3 2" />
      <text x={tx2} y={ty2 - 4} textAnchor="middle" fontSize={10} fill="var(--fg-2)" fontWeight={600}>t = {threshold.toFixed(2)}</text>
      <motion.g style={{ rotate: angle, originX: `${cx}px`, originY: `${cy}px` }}>
        <line x1={cx} y1={cy} x2={cx} y2={cy - R + 6} stroke="var(--fg)" strokeWidth={3.5} strokeLinecap="round" filter="url(#gglow)" />
      </motion.g>
      <circle cx={cx} cy={cy} r={9} fill="var(--fg)" />
      <circle cx={cx} cy={cy} r={4} fill="var(--surface)" />
      <text x={cx} y={cy + 34} textAnchor="middle" fontSize={size * 0.12} fontWeight={800} fill="var(--fg)" className="tnum">{(txt * 100).toFixed(1)}%</text>
      <text x={cx} y={cy + 50} textAnchor="middle" fontSize={10} fill="var(--muted)">{label}</text>
    </svg>
  );
}
