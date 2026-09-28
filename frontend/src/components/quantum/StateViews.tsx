/** StateBars (phase-coloured probabilities), MeasurementHistogram (shots vs ideal), EntanglementMap, ResourceMeters. */
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { basisLabel, sampleShots } from '@/lib/quantum/simulator';
import { entanglementPairs } from '@/lib/quantum/circuits';
import { mulberry32 } from '@/lib/prng';
import { bytes, compact as compactNum, duration } from '@/lib/format';
import type { Entanglement } from '@/types/quantum';
import { Slider, Tip, cn } from '../common/ui';
import { CountUp } from '../common/misc';

export const phaseColor = (phi: number) => `hsl(${(((phi * 180) / Math.PI + 360) % 360).toFixed(0)} 70% 50%)`;

export function StateBars({ re, im, n, height = 150, maxBars = 16 }: { re: Float64Array | number[]; im: Float64Array | number[]; n: number; height?: number; maxBars?: number }) {
  const items = useMemo(() => {
    const all = Array.from({ length: re.length }, (_, i) => ({ i, p: re[i] ** 2 + im[i] ** 2, phi: Math.atan2(im[i], re[i]) }));
    if (all.length <= maxBars) return { bars: all, others: 0 };
    const sorted = [...all].sort((a, b) => b.p - a.p);
    const top = sorted.slice(0, maxBars).sort((a, b) => a.i - b.i);
    return { bars: top, others: sorted.slice(maxBars).reduce((s, v) => s + v.p, 0) };
  }, [re, im, maxBars]);
  const maxP = Math.max(0.05, ...items.bars.map((b) => b.p), items.others);
  return (
    <div role="img" aria-label={`Basis-state probabilities: ${items.bars.filter((b) => b.p > 0.01).map((b) => `|${basisLabel(b.i, n)}⟩ ${(b.p * 100).toFixed(1)}%`).join(', ')}`}>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {items.bars.map((b) => (
          <Tip key={b.i} text={<span className="font-mono">|{basisLabel(b.i, n)}⟩ · P = {b.p.toFixed(3)} · φ = {(b.phi / Math.PI).toFixed(2)}π</span>}>
            <div className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <span className="tnum mb-0.5 text-[9px] text-muted">{b.p > 0.005 ? b.p.toFixed(2) : ''}</span>
              <motion.div className="w-full rounded-t" initial={false} animate={{ height: `${(b.p / maxP) * 82}%`, backgroundColor: b.p > 1e-6 ? phaseColor(b.phi) : 'var(--line)' }}
                transition={{ type: 'spring', stiffness: 180, damping: 22 }} style={{ minHeight: 2 }} />
            </div>
          </Tip>
        ))}
        {items.others > 0 && (
          <div className="flex h-full flex-1 flex-col items-center justify-end">
            <span className="tnum mb-0.5 text-[9px] text-muted">{items.others.toFixed(2)}</span>
            <motion.div className="w-full rounded-t bg-line-strong" animate={{ height: `${(items.others / maxP) * 82}%` }} />
          </div>
        )}
      </div>
      <div className="mt-1 flex gap-[3px]">
        {items.bars.map((b) => (
          <span key={b.i} className="flex-1 truncate text-center font-mono text-[8.5px] text-muted" style={{ writingMode: n > 3 ? 'vertical-rl' : undefined }}>{basisLabel(b.i, n)}</span>
        ))}
        {items.others > 0 && <span className="flex-1 text-center text-[8.5px] text-muted">others</span>}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-muted">
        <span className="h-3 w-3 rounded-full" style={{ background: 'conic-gradient(from 90deg, hsl(0 70% 50%), hsl(90 70% 50%), hsl(180 70% 50%), hsl(270 70% 50%), hsl(360 70% 50%))' }} />
        bar colour = phase φ (0 → 2π); q0 is the leftmost bit
      </div>
    </div>
  );
}

export function MeasurementHistogram({ probs, n, initialShots = 1024, seed = 5 }: { probs: number[]; n: number; initialShots?: number; seed?: number }) {
  const [shots, setShots] = useState(initialShots);
  const [nonce, setNonce] = useState(0);
  const counts = useMemo(() => sampleShots(probs, shots, mulberry32(seed + nonce * 7919 + shots)), [probs, shots, seed, nonce]);
  const idx = probs.map((p, i) => ({ p, i, c: counts[i] })).filter((o) => o.p > 1e-4 || o.c > 0).slice(0, 16);
  const max = Math.max(...idx.map((o) => Math.max(o.p, o.c / shots)), 0.05);
  return (
    <div>
      <div className="flex h-32 items-end gap-1" role="img" aria-label={`Measurement histogram with ${shots} shots`}>
        {idx.map((o) => (
          <Tip key={o.i} text={<span className="font-mono">|{basisLabel(o.i, n)}⟩ · {o.c} counts ({((o.c / shots) * 100).toFixed(1)}%) · ideal {(o.p * 100).toFixed(1)}%</span>}>
            <div className="relative flex h-full flex-1 items-end">
              <motion.div className="w-full rounded-t bg-ok/80" initial={false} animate={{ height: `${((o.c / shots) / max) * 100}%` }} transition={{ type: 'spring', stiffness: 200, damping: 22 }} />
              <div className="absolute inset-x-0 border-t-2 border-dashed border-fg-2" style={{ bottom: `${(o.p / max) * 100}%` }} />
            </div>
          </Tip>
        ))}
      </div>
      <div className="mt-1 flex gap-1">{idx.map((o) => <span key={o.i} className="flex-1 truncate text-center font-mono text-[8.5px] text-muted">{basisLabel(o.i, n)}</span>)}</div>
      <div className="mt-3 flex items-end gap-3">
        <Slider className="flex-1" label="Shots" value={Math.log2(shots)} min={5} max={13} step={1} onChange={(v) => setShots(2 ** v)} format={() => shots.toLocaleString()} accent="var(--green)" />
        <button className="rounded-md border border-line px-2 py-1 text-xs text-fg-2 hover:bg-surface-3" onClick={() => setNonce((x) => x + 1)}>Re-sample</button>
      </div>
      <p className="mt-1 text-[10px] text-muted">Bars: sampled counts · dashed line: ideal probability. Error shrinks as 1/√shots.</p>
    </div>
  );
}

export function EntanglementMap({ n, pairs, kind, size = 170, animate = true }: { n: number; pairs?: [number, number][]; kind?: Entanglement; size?: number; animate?: boolean }) {
  const edges = pairs ?? entanglementPairs(n, kind ?? 'linear');
  const R = size * 0.36;
  const c = size / 2;
  const pos = (i: number) => ({ x: c + R * Math.sin((2 * Math.PI * i) / n), y: c - R * Math.cos((2 * Math.PI * i) / n) });
  const uniq = [...new Map(edges.map(([a, b]) => [`${Math.min(a, b)}-${Math.max(a, b)}`, [a, b] as [number, number]])).values()];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Entanglement map: ${uniq.length} qubit pairs connected`}>
      {uniq.map(([a, b], k) => {
        const p = pos(a), q = pos(b);
        return (
          <motion.line key={`${a}-${b}-${kind}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="var(--navy)" strokeWidth={2} strokeLinecap="round"
            initial={animate ? { pathLength: 0, opacity: 0 } : false} animate={{ pathLength: 1, opacity: 0.7 }} transition={{ delay: k * 0.05, duration: 0.35 }} />
        );
      })}
      {Array.from({ length: n }, (_, i) => {
        const p = pos(i);
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={11} fill="var(--tint-purple)" stroke="var(--purple)" strokeWidth={1.8} />
            <text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--purple)" fontFamily="JetBrains Mono">q{i}</text>
          </g>
        );
      })}
    </svg>
  );
}

export interface Resource {
  label: string;
  value: number;
  format?: (v: number) => string;
  warn: number;
  max: number;
  why: string;
}

export function ResourceMeters({ nQubits, depth, twoQubit, params, runtimeSec, backendQubits = 127, gates }: { nQubits: number; depth: number; twoQubit: number; params: number; runtimeSec: number; backendQubits?: number; gates: number }) {
  const mem = 16 * 2 ** nQubits;
  const items: Resource[] = [
    { label: 'Qubits', value: nQubits, warn: 20, max: backendQubits, why: `Each feature (angle encoding) needs a qubit. Target backend limit: ${backendQubits}.` },
    { label: 'Depth', value: depth, warn: 60, max: 150, why: 'Deeper circuits accumulate more decoherence on NISQ hardware; keep depth ≲ 100 for T2 ≈ 100 µs.' },
    { label: '2-qubit gates', value: twoQubit, warn: 40, max: 120, why: 'CNOTs are ~10× noisier than single-qubit gates (≈ 0.8% error each).' },
    { label: 'Trainable θ', value: params, warn: 80, max: 200, why: 'Parameter-shift needs 2 circuit runs per parameter per gradient step; many parameters also risk barren plateaus.' },
    { label: 'Gates', value: gates, warn: 250, max: 600, why: 'Total operations before transpilation; hardware adds SWAPs for limited connectivity.' },
    { label: 'Statevector', value: mem, format: bytes, warn: 2 ** 30, max: 2 ** 34, why: `Simulation memory = 16 B × 2ⁿ = ${bytes(mem)}. Beyond ~30 qubits, only hardware (or tensor networks) can run it.` },
    { label: 'Est. runtime', value: runtimeSec, format: duration, warn: 600, max: 3600, why: 'Estimated statevector training time for 500 samples × 100 iterations.' },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-4">
      {items.map((it) => {
        const state = it.value > it.max ? 'exceeds' : it.value > it.warn ? 'warn' : 'ok';
        const color = state === 'ok' ? 'var(--green)' : state === 'warn' ? 'var(--saffron)' : 'var(--red)';
        return (
          <Tip key={it.label} text={it.why}>
            <div tabIndex={0} className={cn('rounded-lg border border-line bg-surface px-2.5 py-2', state === 'exceeds' && 'shake')}>
              <div className="flex items-center justify-between gap-1 text-[10px] font-medium text-muted">
                {it.label}
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
              </div>
              <div className="metric text-base font-bold text-fg">
                <CountUp value={it.value} format={it.format ?? ((v) => compactNum(v))} duration={0.5} />
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3">
                <motion.div className="h-full rounded-full" style={{ background: color }} animate={{ width: `${Math.min(100, (Math.log1p(it.value) / Math.log1p(it.max)) * 100)}%` }} />
              </div>
            </div>
          </Tip>
        );
      })}
    </div>
  );
}
