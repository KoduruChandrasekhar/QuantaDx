/** Pseudo-3D SVG Bloch sphere: drag to orbit, geodesic (slerp) arrow animation, optional trail, mixed-state shortening. */
import { useEffect, useRef, useState } from 'react';
import type { BlochVector } from '@/types/quantum';
import { useReducedMotion } from '@/hooks';
import { cn } from '../common/ui';

const len = (v: BlochVector) => Math.hypot(v.x, v.y, v.z);

function slerp(a: BlochVector, b: BlochVector, t: number): BlochVector {
  const la = len(a), lb = len(b);
  const L = la + (lb - la) * t;
  if (la < 1e-6 || lb < 1e-6) return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
  const ua = { x: a.x / la, y: a.y / la, z: a.z / la };
  const ub = { x: b.x / lb, y: b.y / lb, z: b.z / lb };
  const dot = Math.max(-1, Math.min(1, ua.x * ub.x + ua.y * ub.y + ua.z * ub.z));
  const om = Math.acos(dot);
  if (om < 1e-4) return { x: ub.x * L, y: ub.y * L, z: ub.z * L };
  let s0 = Math.sin((1 - t) * om) / Math.sin(om), s1 = Math.sin(t * om) / Math.sin(om);
  if (Math.abs(Math.PI - om) < 1e-3) {
    // antipodal: rotate through an orthogonal axis
    const ortho = Math.abs(ua.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const ang = t * Math.PI;
    s0 = Math.cos(ang);
    s1 = Math.sin(ang);
    return { x: (ua.x * s0 + ortho.x * s1) * L, y: (ua.y * s0 + ortho.y * s1) * L, z: (ua.z * s0 + ortho.z * s1) * L };
  }
  return { x: (ua.x * s0 + ub.x * s1) * L, y: (ua.y * s0 + ub.y * s1) * L, z: (ua.z * s0 + ub.z * s1) * L };
}

export function useAnimatedVector(target: BlochVector, ms = 420): BlochVector {
  const reduced = useReducedMotion();
  const [cur, setCur] = useState(target);
  const from = useRef(target);
  const curRef = useRef(target);
  useEffect(() => {
    if (reduced) {
      curRef.current = target;
      setCur(target);
      return;
    }
    from.current = curRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const e = 1 - (1 - t) ** 3;
      const v = slerp(from.current, target, e);
      curRef.current = v;
      setCur(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target.x, target.y, target.z, ms, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  return cur;
}

export interface BlochProps {
  vector: BlochVector;
  size?: number;
  label?: string;
  sublabel?: string;
  readout?: boolean;
  trail?: boolean;
  color?: string;
  interactive?: boolean;
  compact?: boolean;
  highlight?: boolean;
  className?: string;
}

export function Bloch({ vector, size = 160, label, sublabel, readout, trail, color = 'var(--purple)', interactive = true, compact, highlight, className }: BlochProps) {
  const v = useAnimatedVector(vector);
  const [az, setAz] = useState(-0.62);
  const [el, setEl] = useState(-0.32);
  const drag = useRef<{ x: number; y: number; az: number; el: number } | null>(null);
  const trailPts = useRef<BlochVector[]>([]);
  if (trail) {
    const last = trailPts.current[trailPts.current.length - 1];
    if (!last || Math.hypot(last.x - v.x, last.y - v.y, last.z - v.z) > 0.03) {
      trailPts.current = [...trailPts.current.slice(-40), v];
    }
  }
  const R = size * 0.36;
  const cx = size / 2, cy = size / 2 + (compact ? 0 : 2);
  const P = (x: number, y: number, z: number) => {
    const x1 = x * Math.cos(az) - y * Math.sin(az);
    const y1 = x * Math.sin(az) + y * Math.cos(az);
    return { sx: cx + x1 * R, sy: cy - (z * Math.cos(el) - y1 * Math.sin(el)) * R, depth: y1 * Math.cos(el) + z * Math.sin(el) };
  };
  const circle = (fn: (t: number) => [number, number, number]) => {
    const pts = Array.from({ length: 73 }, (_, i) => P(...fn((i / 72) * Math.PI * 2)));
    let front = '', back = '';
    let prev: boolean | null = null;
    for (const p of pts) {
      const isFront = p.depth <= 0;
      const seg = `${prev === isFront ? 'L' : 'M'}${p.sx.toFixed(1)},${p.sy.toFixed(1)}`;
      if (isFront) front += seg;
      else back += seg;
      prev = isFront;
    }
    return { front, back };
  };
  const eq = circle((t) => [Math.cos(t), Math.sin(t), 0]);
  const mer1 = circle((t) => [Math.cos(t), 0, Math.sin(t)]);
  const mer2 = circle((t) => [0, Math.cos(t), Math.sin(t)]);
  const tip = P(v.x, v.y, v.z);
  const o = P(0, 0, 0);
  const r = len(vector);
  const theta = Math.acos(Math.max(-1, Math.min(1, v.z / (len(v) || 1))));
  const phi = Math.atan2(v.y, v.x);
  const axisLabels: [string, number, number, number][] = compact
    ? [['|0⟩', 0, 0, 1.28], ['|1⟩', 0, 0, -1.3]]
    : [['|0⟩', 0, 0, 1.28], ['|1⟩', 0, 0, -1.3], ['|+⟩', 1.32, 0, 0], ['|−⟩', -1.32, 0, 0], ['|+i⟩', 0, 1.32, 0], ['|−i⟩', 0, -1.34, 0]];
  const gid = `bl-${label ?? 'q'}-${size}`.replace(/\W/g, '');

  return (
    <figure className={cn('flex flex-col items-center', className)} role="img" aria-label={`Bloch sphere${label ? ` for ${label}` : ''}: x=${vector.x.toFixed(2)}, y=${vector.y.toFixed(2)}, z=${vector.z.toFixed(2)}, length ${r.toFixed(2)}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        className={cn('touch-none select-none', interactive && 'cursor-grab active:cursor-grabbing', highlight && 'drop-shadow-[0_0_10px_rgba(123,63,160,0.45)]')}
        onPointerDown={(e) => {
          if (!interactive) return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, az, el };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setAz(drag.current.az + (e.clientX - drag.current.x) * 0.012);
          setEl(Math.max(-1.2, Math.min(1.2, drag.current.el + (e.clientY - drag.current.y) * 0.01)));
        }}
        onPointerUp={() => (drag.current = null)}
        onDoubleClick={() => { setAz(-0.62); setEl(-0.32); }}>
        <defs>
          <radialGradient id={gid} cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="var(--surface)" stopOpacity="0.95" />
            <stop offset="70%" stopColor="var(--tint-purple)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--purple)" stopOpacity="0.28" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={R} fill={`url(#${gid})`} stroke="var(--line-strong)" strokeWidth={1} />
        {[eq, mer1, mer2].map((c, i) => (
          <g key={i} fill="none" stroke="var(--muted)" strokeWidth={0.8}>
            <path d={c.back} strokeDasharray="2 3" opacity={0.35} />
            <path d={c.front} opacity={i === 0 ? 0.7 : 0.4} />
          </g>
        ))}
        {[[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(([x, y, z], i) => {
          const a = P(-x, -y, -z), b = P(x, y, z);
          return <line key={i} x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke="var(--muted)" strokeWidth={0.6} opacity={0.45} />;
        })}
        {axisLabels.map(([t, x, y, z]) => {
          const p = P(x, y, z);
          return <text key={t} x={p.sx} y={p.sy + 3} textAnchor="middle" fontSize={compact ? 9 : 10} className="fill-muted font-mono" opacity={p.depth > 0.3 ? 0.45 : 0.9}>{t}</text>;
        })}
        {trail && trailPts.current.length > 1 && (
          <g>
            {trailPts.current.map((q, i) => {
              if (i === 0) return null;
              const a = P(trailPts.current[i - 1].x, trailPts.current[i - 1].y, trailPts.current[i - 1].z), b = P(q.x, q.y, q.z);
              return <line key={i} x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke={color} strokeWidth={2} strokeLinecap="round" opacity={(i / trailPts.current.length) * 0.5} />;
            })}
          </g>
        )}
        <line x1={o.sx} y1={o.sy} x2={tip.sx} y2={tip.sy} stroke={color} strokeWidth={compact ? 2.2 : 2.8} strokeLinecap="round" />
        <circle cx={tip.sx} cy={tip.sy} r={compact ? 3.5 : 4.5} fill={color} stroke="var(--surface)" strokeWidth={1.5} />
        <circle cx={o.sx} cy={o.sy} r={1.8} fill="var(--fg-2)" />
        {r < 0.97 && (
          <text x={size - 4} y={size - 4} textAnchor="end" fontSize={10} className="fill-saffron font-mono font-semibold">|r| = {r.toFixed(2)}</text>
        )}
      </svg>
      {(label || sublabel) && (
        <figcaption className="mt-0.5 text-center leading-tight">
          {label && <div className="font-mono text-xs font-semibold text-fg">{label}</div>}
          {sublabel && <div className="max-w-[160px] truncate text-[10px] text-muted">{sublabel}</div>}
        </figcaption>
      )}
      {readout && (
        <div className="mt-2 grid w-full grid-cols-3 gap-1 text-center font-mono text-[10px]">
          {[['θ', `${(theta / Math.PI).toFixed(2)}π`], ['φ', `${(phi / Math.PI).toFixed(2)}π`], ['|r|', r.toFixed(2)], ['⟨X⟩', vector.x.toFixed(2)], ['⟨Y⟩', vector.y.toFixed(2)], ['⟨Z⟩', vector.z.toFixed(2)]].map(([k, val]) => (
            <div key={k} className="rounded bg-surface-3 px-1 py-0.5"><span className="text-muted">{k} </span><span className="tnum text-fg">{val}</span></div>
          ))}
        </div>
      )}
    </figure>
  );
}

export function BlochGrid({ vectors, size = 120, labels, sublabels, highlight, className }: { vectors: BlochVector[]; size?: number; labels?: string[]; sublabels?: string[]; highlight?: number | null; className?: string }) {
  return (
    <div className={cn('flex flex-wrap justify-center gap-x-2 gap-y-3', className)}>
      {vectors.map((v, i) => (
        <Bloch key={i} vector={v} size={size} compact label={labels?.[i] ?? `q${i}`} sublabel={sublabels?.[i]} highlight={highlight === i} />
      ))}
    </div>
  );
}
