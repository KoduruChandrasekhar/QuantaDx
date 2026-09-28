/** Model-comparison charts with linked highlighting via selectionStore. */
import { motion } from 'framer-motion';
import { CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ModelResult } from '@/types/api';
import { useSelection } from '@/store';
import { metricsFromConfusion } from '@/lib/metrics';
import { pct1 } from '@/lib/format';
import { cn } from '../common/ui';
import { AXIS, tooltipStyle } from './ChartCard';

export type Styles = Record<string, { color: string; dash: string }>;

export function ModelLegend({ models, styles, className }: { models: { modelId: string; label: string }[]; styles: Styles; className?: string }) {
  const hl = useSelection((s) => s.highlightedModelId);
  const setHl = useSelection((s) => s.setHighlighted);
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {models.map((m) => (
        <button key={m.modelId} onMouseEnter={() => setHl(m.modelId)} onMouseLeave={() => setHl(null)} onFocus={() => setHl(m.modelId)} onBlur={() => setHl(null)}
          className={cn('flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition', hl && hl !== m.modelId ? 'border-line opacity-40' : 'border-line bg-surface')}>
          <svg width="18" height="6" aria-hidden><line x1="0" y1="3" x2="18" y2="3" stroke={styles[m.modelId]?.color} strokeWidth="2.5" strokeDasharray={styles[m.modelId]?.dash} /></svg>
          {m.label}
        </button>
      ))}
    </div>
  );
}

const opacityFor = (hl: string | null, id: string) => (hl && hl !== id ? 0.12 : 1);

export function RocChart({ models, styles, height = 280, operatingPoint, mini }: { models: ModelResult[]; styles: Styles; height?: number; operatingPoint?: { fpr: number; tpr: number }; mini?: boolean }) {
  const hl = useSelection((s) => s.highlightedModelId);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart margin={{ top: 8, right: 12, bottom: mini ? 0 : 18, left: mini ? -20 : 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" dataKey="fpr" domain={[0, 1]} {...AXIS} label={mini ? undefined : { value: 'False positive rate (1 − specificity)', position: 'insideBottom', offset: -10, fontSize: 11, fill: 'var(--muted)' }} />
        <YAxis type="number" domain={[0, 1]} {...AXIS} label={mini ? undefined : { value: 'Sensitivity', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--muted)' }} />
        <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="var(--muted)" strokeDasharray="4 4" />
        <Tooltip {...tooltipStyle()} formatter={(v: number) => v.toFixed(3)} labelFormatter={(l: number) => `FPR ${Number(l).toFixed(3)}`} />
        {models.map((m) => (
          <Line key={m.modelId} data={m.roc} dataKey="tpr" name={m.label} type="stepAfter" dot={false} isAnimationActive={!mini}
            stroke={styles[m.modelId]?.color} strokeDasharray={styles[m.modelId]?.dash} strokeWidth={hl === m.modelId ? 3.2 : 2} strokeOpacity={opacityFor(hl, m.modelId)} />
        ))}
        {operatingPoint && <ReferenceDot x={operatingPoint.fpr} y={operatingPoint.tpr} r={6} fill="var(--saffron)" stroke="var(--surface)" strokeWidth={2} />}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PrChart({ models, styles, height = 280, prevalence }: { models: ModelResult[]; styles: Styles; height?: number; prevalence: number }) {
  const hl = useSelection((s) => s.highlightedModelId);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" dataKey="recall" domain={[0, 1]} {...AXIS} label={{ value: 'Recall (sensitivity)', position: 'insideBottom', offset: -10, fontSize: 11, fill: 'var(--muted)' }} />
        <YAxis type="number" domain={[0, 1]} {...AXIS} label={{ value: 'Precision (PPV)', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--muted)' }} />
        <ReferenceLine y={prevalence} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: `chance = prevalence ${pct1(prevalence)}`, fontSize: 10, fill: 'var(--muted)', position: 'insideBottomLeft' }} />
        <Tooltip {...tooltipStyle()} formatter={(v: number) => v.toFixed(3)} labelFormatter={(l: number) => `Recall ${Number(l).toFixed(3)}`} />
        {models.map((m) => (
          <Line key={m.modelId} data={m.pr} dataKey="precision" name={m.label} type="monotone" dot={false}
            stroke={styles[m.modelId]?.color} strokeDasharray={styles[m.modelId]?.dash} strokeWidth={hl === m.modelId ? 3.2 : 2} strokeOpacity={opacityFor(hl, m.modelId)} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CalibrationChart({ models, styles, height = 260 }: { models: ModelResult[]; styles: Styles; height?: number }) {
  const hl = useSelection((s) => s.highlightedModelId);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" dataKey="predicted" domain={[0, 1]} {...AXIS} label={{ value: 'Mean predicted probability', position: 'insideBottom', offset: -10, fontSize: 11, fill: 'var(--muted)' }} />
        <YAxis type="number" domain={[0, 1]} {...AXIS} label={{ value: 'Observed frequency', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--muted)' }} />
        <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke="var(--muted)" strokeDasharray="4 4" label={{ value: 'perfect', fontSize: 10, fill: 'var(--muted)', position: 'insideTopLeft' }} />
        <Tooltip {...tooltipStyle()} formatter={(v: number) => v.toFixed(3)} />
        {models.map((m) => (
          <Line key={m.modelId} data={m.calibration} dataKey="observed" name={m.label} type="linear" dot={{ r: 3 }}
            stroke={styles[m.modelId]?.color} strokeDasharray={styles[m.modelId]?.dash} strokeWidth={hl === m.modelId ? 3 : 1.8} strokeOpacity={opacityFor(hl, m.modelId)} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ConfusionMatrix({ cm, label, color = 'var(--blue)', compact, positive = 'Positive', negative = 'Negative' }: { cm: { tp: number; fp: number; tn: number; fn: number }; label?: string; color?: string; compact?: boolean; positive?: string; negative?: string }) {
  const m = metricsFromConfusion(cm);
  const rowPos = cm.tp + cm.fn, rowNeg = cm.tn + cm.fp;
  const max = Math.max(cm.tp, cm.fp, cm.tn, cm.fn, 1);
  const cell = (v: number, row: number, good: boolean, name: string, note?: string) => (
    <motion.div layout className={cn('relative flex flex-col items-center justify-center rounded-lg', compact ? 'p-1.5' : 'p-3')}
      style={{ background: `color-mix(in srgb, ${good ? color : 'var(--red)'} ${Math.round(8 + (v / max) * 55)}%, var(--surface))` }}
      aria-label={`${name}: ${v}`}>
      <span className={cn('tnum font-bold text-fg', compact ? 'text-base' : 'text-2xl')}>{v}</span>
      {!compact && <span className="tnum text-[10px] text-fg-2">{((v / (row || 1)) * 100).toFixed(1)}% of row</span>}
      <span className={cn('font-semibold uppercase tracking-wide', compact ? 'text-[8px] text-fg-2' : 'text-[10px] text-fg-2')}>{name}</span>
      {note && !compact && <span className="mt-0.5 rounded bg-danger px-1.5 py-px text-[9px] font-semibold text-white">{note}</span>}
    </motion.div>
  );
  return (
    <div>
      {label && <div className="mb-1.5 truncate text-xs font-semibold text-fg-2">{label}</div>}
      <div className={cn('grid gap-1', compact ? 'grid-cols-[auto_1fr_1fr]' : 'grid-cols-[auto_1fr_1fr]')}>
        <span />
        <span className="text-center text-[10px] font-medium text-muted">Pred. {positive}</span>
        <span className="text-center text-[10px] font-medium text-muted">Pred. {negative}</span>
        <span className="flex items-center text-[10px] font-medium text-muted [writing-mode:vertical-rl] rotate-180">Actual {positive}</span>
        {cell(cm.tp, rowPos, true, 'TP')}
        {cell(cm.fn, rowPos, false, 'FN', 'missed patients')}
        <span className="flex items-center text-[10px] font-medium text-muted [writing-mode:vertical-rl] rotate-180">Actual {negative}</span>
        {cell(cm.fp, rowNeg, false, 'FP', 'false alarms')}
        {cell(cm.tn, rowNeg, true, 'TN')}
      </div>
      {!compact && (
        <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px]">
          {[['Sens', m.sensitivity], ['Spec', m.specificity], ['PPV', m.precision], ['NPV', m.npv]].map(([k, v]) => (
            <div key={k as string} className="rounded bg-surface-3 py-1"><div className="text-muted">{k}</div><div className="tnum font-semibold text-fg">{pct1(v as number)}</div></div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RadarCompare({ a, b, height = 280 }: { a: { label: string; color: string; values: Record<string, number> }; b: { label: string; color: string; values: Record<string, number> }; height?: number }) {
  const data = Object.keys(a.values).map((k) => ({ metric: k, A: a.values[k], B: b.values[k] }));
  const min = Math.max(0, Math.floor((Math.min(...data.flatMap((d) => [d.A, d.B])) - 0.05) * 20) / 20);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="var(--line)" />
        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'var(--fg-2)' }} />
        <PolarRadiusAxis domain={[min, 1]} tick={{ fontSize: 9, fill: 'var(--muted)' }} angle={90} tickCount={4} />
        <Radar name={a.label} dataKey="A" stroke={a.color} fill={a.color} fillOpacity={0.18} strokeWidth={2} />
        <Radar name={b.label} dataKey="B" stroke={b.color} fill={b.color} fillOpacity={0.18} strokeWidth={2} strokeDasharray="5 3" />
        <Tooltip {...tooltipStyle()} formatter={(v: number) => v.toFixed(3)} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
