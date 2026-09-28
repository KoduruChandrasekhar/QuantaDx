/** KernelHeatmap (Section 8.8): class-sort animation, alignment, concentration diagnostic, raw vs tuned vs RBF. */
import { AlertTriangle, ArrowDownUp, CheckCircle2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CONCENTRATION_VAR_THRESHOLD, fidelityKernel, kernelTargetAlignment, offDiagonal, rbfKernel, variance } from '@/lib/quantum/kernel';
import { histogram } from '@/lib/metrics';
import type { EncodingKind } from '@/types/quantum';
import { Switch, Tip, cn } from '../common/ui';
import { Tex } from '../common/misc';

const STOPS = ['#fbf9fd', '#e2d6ef', '#b89ad6', '#8a5bb8', '#5b2a7a', '#2d0f45'];
export function kernelColor(v: number): string {
  const t = Math.max(0, Math.min(1, v)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(t));
  const f = t - i;
  const a = STOPS[i], b = STOPS[i + 1];
  const ch = (s: string, k: number) => parseInt(s.slice(1 + k * 2, 3 + k * 2), 16);
  const mix = [0, 1, 2].map((k) => Math.round(ch(a, k) + (ch(b, k) - ch(a, k)) * f));
  return `rgb(${mix.join(',')})`;
}

export function KernelHeatmap({ matrix, labels, sorted, size = 260, title, compact }: { matrix: number[][]; labels: number[]; sorted: boolean; size?: number; title?: string; compact?: boolean }) {
  const n = matrix.length;
  const cs = size / n;
  const pos = useMemo(() => {
    const order = labels.map((l, i) => ({ l, i }));
    if (sorted) order.sort((a, b) => a.l - b.l || a.i - b.i);
    const p = new Array<number>(n);
    order.forEach((o, k) => (p[o.i] = k));
    return p;
  }, [labels, sorted, n]);
  const nNeg = labels.filter((l) => l === 0).length;
  return (
    <figure className="flex flex-col items-center">
      {title && <figcaption className="mb-1 text-[11px] font-semibold text-fg-2">{title}</figcaption>}
      <div className="relative">
        <svg width={size + (compact ? 0 : 8)} height={size + (compact ? 0 : 8)} viewBox={`-4 -4 ${size + 8} ${size + 8}`} role="img" aria-label={`${title ?? 'Kernel'} matrix ${n}×${n}${sorted ? ', sorted by class' : ''}`}>
          {matrix.map((row, i) =>
            row.map((v, j) => (
              <rect key={`${i}-${j}`} className="kcell" width={cs + 0.3} height={cs + 0.3} fill={kernelColor(v)} style={{ transform: `translate(${pos[j] * cs}px, ${pos[i] * cs}px)` }}>
                <title>{`k(x${i}, x${j}) = ${v.toFixed(3)} · classes ${labels[i]}/${labels[j]}`}</title>
              </rect>
            )),
          )}
          {sorted && !compact && (
            <g stroke="var(--saffron)" strokeWidth={1.5} fill="none">
              <rect x={0} y={0} width={nNeg * cs} height={nNeg * cs} />
              <rect x={nNeg * cs} y={nNeg * cs} width={(n - nNeg) * cs} height={(n - nNeg) * cs} />
            </g>
          )}
        </svg>
        {sorted && !compact && (
          <div className="pointer-events-none absolute -left-1 top-0 flex h-full -translate-x-full flex-col text-[9px] font-semibold text-muted">
            <span className="flex items-center" style={{ height: `${(nNeg / n) * 100}%` }}>neg</span>
            <span className="flex items-center text-danger" style={{ height: `${((n - nNeg) / n) * 100}%` }}>pos</span>
          </div>
        )}
      </div>
    </figure>
  );
}

export function Colorbar({ width = 200 }: { width?: number }) {
  return (
    <div className="flex items-center gap-2 text-[10px] text-muted" aria-hidden>
      0<div className="h-2 rounded-full" style={{ width, background: `linear-gradient(90deg, ${STOPS.join(',')})` }} />1
    </div>
  );
}

export function ConcentrationHist({ values, height = 70 }: { values: number[]; height?: number }) {
  const h = histogram(values, 20, 0, 1);
  const max = Math.max(...h.map((b) => b.count), 1);
  return (
    <div className="flex items-end gap-px" style={{ height }} role="img" aria-label="Histogram of off-diagonal kernel values">
      {h.map((b, i) => (
        <div key={i} className="flex-1 rounded-t bg-quantum/70 transition-all duration-300" style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count ? 2 : 0 }} title={`${b.x0.toFixed(2)}–${b.x1.toFixed(2)}: ${b.count}`} />
      ))}
    </div>
  );
}

export interface KernelStats {
  matrix: number[][];
  offVar: number;
  offMean: number;
  alignment: number;
  concentrated: boolean;
}

export function kernelStats(K: number[][], labels: number[]): KernelStats {
  const off = offDiagonal(K);
  const v = variance(off);
  return { matrix: K, offVar: v, offMean: off.reduce((s, x) => s + x, 0) / (off.length || 1), alignment: kernelTargetAlignment(K, labels), concentrated: v < CONCENTRATION_VAR_THRESHOLD };
}

/** Full kernel panel computed in-browser from encoded patients. */
export function KernelPanel({ xs, labels, bandwidth, encoding = 'zz_feature_map', showComparison = true, size = 250 }: { xs: number[][]; labels: number[]; bandwidth: number; encoding?: EncodingKind; showComparison?: boolean; size?: number }) {
  const [sorted, setSorted] = useState(true);
  const tuned = useMemo(() => kernelStats(fidelityKernel(xs, encoding, bandwidth), labels), [xs, labels, bandwidth, encoding]);
  const raw = useMemo(() => (showComparison ? kernelStats(fidelityKernel(xs, encoding, 1), labels) : null), [xs, labels, encoding, showComparison]);
  const rbf = useMemo(() => (showComparison ? kernelStats(rbfKernel(xs, 0.35), labels) : null), [xs, labels, showComparison]);
  const off = useMemo(() => offDiagonal(tuned.matrix), [tuned]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Switch checked={sorted} onChange={setSorted} label={<span className="flex items-center gap-1"><ArrowDownUp size={13} /> Sort by class</span>} color="var(--purple)" />
        <Colorbar width={140} />
        <span className="ml-auto font-mono text-xs text-muted">k(x,x′) = |⟨φ(x)|φ(x′)⟩|²</span>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[auto_1fr]">
        <KernelHeatmap matrix={tuned.matrix} labels={labels} sorted={sorted} size={size} title={`Quantum kernel · bandwidth ${bandwidth.toFixed(2)}`} />
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Off-diag mean" value={tuned.offMean.toFixed(3)} />
            <Stat label="Off-diag variance" value={tuned.offVar.toFixed(4)} warn={tuned.concentrated} />
            <Tip text="Kernel-target alignment: similarity between K and the ideal label kernel yyᵀ. Higher = patients of the same class look more alike.">
              <div tabIndex={0}><Stat label="Alignment" value={tuned.alignment.toFixed(3)} /></div>
            </Tip>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-medium text-muted">Off-diagonal kernel values</div>
            <ConcentrationHist values={off} />
            <div className="mt-0.5 flex justify-between text-[9px] text-muted"><span>0</span><span>0.5</span><span>1</span></div>
          </div>
          {tuned.concentrated ? (
            <div role="alert" className="flex gap-2 rounded-lg border border-saffron/40 bg-tint-saffron p-2.5 text-xs text-fg-2">
              <AlertTriangle size={16} className="shrink-0 text-saffron" />
              <span><b>Kernel concentration:</b> off-diagonal values ≈ 0 — the model cannot separate patients. Reduce the bandwidth (try 0.1–0.2).</span>
            </div>
          ) : (
            <div className="flex gap-2 rounded-lg border border-ok/30 bg-tint-green p-2.5 text-xs text-fg-2">
              <CheckCircle2 size={16} className="shrink-0 text-ok" />
              <span>Kernel values are spread out (variance {tuned.offVar.toFixed(4)}) — class blocks are visible when sorted.</span>
            </div>
          )}
        </div>
      </div>
      {showComparison && raw && rbf && (
        <div>
          <div className="mb-2 text-xs font-semibold text-fg-2">Side by side</div>
          <div className="grid grid-cols-3 gap-3">
            {[['Raw ZZ (bw 1.0)', raw], [`Tuned (bw ${bandwidth.toFixed(2)})`, tuned], ['Classical RBF', rbf]].map(([t, s]) => {
              const st = s as KernelStats;
              return (
                <div key={t as string} className={cn('flex flex-col items-center rounded-lg border p-2', st.concentrated ? 'border-saffron/40' : 'border-line')}>
                  <KernelHeatmap matrix={st.matrix} labels={labels} sorted={sorted} size={110} title={t as string} compact />
                  <div className="mt-1 font-mono text-[10px] text-muted">var {st.offVar.toFixed(4)} · A {st.alignment.toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="rounded-lg border border-line bg-surface-2 p-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">How one entry is computed</div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {['|0…0⟩', `U_φ(${bandwidth.toFixed(2)}·x)`, `U_φ†(${bandwidth.toFixed(2)}·x′)`, 'measure', 'P(|0…0⟩) = k(x,x′)'].map((s, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted">→</span>}
              <span className={cn('rounded-md px-2 py-1', i === 1 || i === 2 ? 'bg-tint-purple text-quantum' : i === 3 ? 'bg-tint-green text-ok' : 'bg-surface-3 text-fg-2')}>{s}</span>
            </span>
          ))}
        </div>
        <div className="mt-2 text-xs text-muted"><Tex>{'k(x,x\')=|\\langle 0|U_\\phi^\\dagger(bx\')\\,U_\\phi(bx)|0\\rangle|^2'}</Tex> — small bandwidth <Tex>b</Tex> keeps encoded states close, so kernel values stay informative.</div>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn('rounded-lg border px-2 py-1.5', warn ? 'border-saffron/50 bg-tint-saffron' : 'border-line bg-surface')}>
      <div className="text-[10px] text-muted">{label}</div>
      <div className={cn('tnum font-mono text-sm font-semibold', warn ? 'text-saffron' : 'text-fg')}>{value}</div>
    </div>
  );
}
