/** Profile tabs, part 2: noise & outliers, distributions, correlations, class balance, dimensionality, quality score. */
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cell, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import type { Dataset, DatasetProfile } from '@/types/api';
import { pct1 } from '@/lib/format';
import { Select, Slider, Tip, cn } from '@/components/common/ui';
import { CountUp } from '@/components/common/misc';
import { AXIS, tooltipStyle } from '@/components/charts/ChartCard';

export function NoiseView({ p }: { p: DatasetProfile }) {
  const cols = p.columns.filter((c) => c.type === 'numeric').slice(0, 16);
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]" data-tour="data-noise">
      <div>
        <div className="mb-2 text-xs font-semibold text-fg-2">Box-plot strip (standardised; whiskers = 1.5 × IQR)</div>
        <div className="space-y-1.5">
          {cols.map((c) => {
            const z = (v: number) => (v - c.mean) / (c.std || 1);
            const sc = (v: number) => `${Math.max(0, Math.min(100, ((z(v) + 4) / 8) * 100))}%`;
            const iqr = c.q3 - c.q1;
            return (
              <div key={c.name} className="flex items-center gap-2 text-[11px]">
                <span className="w-32 truncate text-fg-2" title={c.name}>{c.name}</span>
                <div className="relative h-4 flex-1 rounded bg-surface-2">
                  <div className="absolute top-1/2 h-px bg-muted" style={{ left: sc(Math.max(c.min, c.q1 - 1.5 * iqr)), right: `calc(100% - ${sc(Math.min(c.max, c.q3 + 1.5 * iqr))})` }} />
                  <div className="absolute top-0.5 bottom-0.5 rounded-sm border border-classical bg-tint-blue" style={{ left: sc(c.q1), width: `calc(${sc(c.q3)} - ${sc(c.q1)})` }} />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-classical" style={{ left: sc(c.median) }} />
                  {c.max > c.q3 + 1.5 * iqr && <div className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-danger" style={{ left: sc(c.max) }} />}
                  {c.min < c.q1 - 1.5 * iqr && <div className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-danger" style={{ left: sc(c.min) }} />}
                </div>
                <Tip text={`IQR outliers ${c.outliersIqr} · |z| > 3: ${c.outliersZ}`}><span className="tnum w-14 text-right text-muted">{c.outliersIqr} / {c.outliersZ}</span></Tip>
              </div>
            );
          })}
        </div>
        <div className="mt-1 text-right text-[10px] text-muted">count: IQR / z-score</div>
      </div>
      <div className="space-y-3">
        <div className="rounded-xl bg-surface-2 p-4">
          <div className="text-[11px] text-muted">Estimated noise level</div>
          <div className="mt-1 flex items-end gap-2">
            <span className="metric text-3xl font-bold text-fg"><CountUp value={p.noiseEstimate * 100} format={(v) => `${v.toFixed(1)}%`} /></span>
            <span className={cn('mb-1 text-xs font-semibold', p.noiseEstimate > 0.15 ? 'text-danger' : p.noiseEstimate > 0.06 ? 'text-saffron' : 'text-ok')}>{p.noiseEstimate > 0.15 ? 'high' : p.noiseEstimate > 0.06 ? 'moderate' : 'low'}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3"><motion.div className="h-full rounded-full bg-gradient-to-r from-ok via-saffron to-danger" initial={{ width: 0 }} animate={{ width: `${Math.min(100, p.noiseEstimate * 400)}%` }} /></div>
          <p className="mt-2 text-[11px] text-muted">From outlier rates and missingness. Handle with IQR clipping or winsorisation in pre-processing.</p>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold text-fg-2">Flagged suspicious rows</div>
          {p.suspiciousRows.length === 0 && <div className="text-xs text-ok">None flagged.</div>}
          <ul className="space-y-1">
            {p.suspiciousRows.map((r) => (
              <li key={r.row} className="flex items-center gap-2 rounded-md bg-tint-saffron px-2 py-1 text-xs"><AlertTriangle size={12} className="text-saffron" /><span className="font-mono">row {r.row}</span><span className="text-muted">{r.reason}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function DistributionView({ p, ds }: { p: DatasetProfile; ds: Dataset }) {
  const [col, setCol] = useState(p.columns[0]?.name ?? '');
  const c = p.columns.find((x) => x.name === col) ?? p.columns[0];
  const cls = !!c?.histByClass;
  const max = Math.max(...(cls ? [...c.histByClass!.neg, ...c.histByClass!.pos] : c.histogram), 1);
  return (
    <div>
      <Select className="mb-3 w-64" label="Feature" value={col} onChange={setCol} options={p.columns.map((x) => ({ value: x.name, label: x.name }))} />
      <div className="flex h-56 items-end gap-1" role="img" aria-label={`Histogram of ${c.name}${cls ? ' by class' : ''}`}>
        {c.histogram.map((_, i) => (
          <div key={i} className="relative flex h-full flex-1 items-end">
            {cls ? (
              <>
                <motion.div className="absolute bottom-0 w-full rounded-t bg-classical/55" initial={{ height: 0 }} animate={{ height: `${(c.histByClass!.neg[i] / max) * 100}%` }} transition={{ delay: i * 0.015 }} />
                <motion.div className="absolute bottom-0 w-full rounded-t bg-danger/50" initial={{ height: 0 }} animate={{ height: `${(c.histByClass!.pos[i] / max) * 100}%` }} transition={{ delay: i * 0.015 }} />
              </>
            ) : (
              <motion.div className="w-full rounded-t bg-hybrid/70" initial={{ height: 0 }} animate={{ height: `${(c.histogram[i] / max) * 100}%` }} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted"><span>{Number(c.min.toFixed(3))}</span><span>{c.name}{c.unit ? ` (${c.unit})` : ''}</span><span>{Number(c.max.toFixed(3))}</span></div>
      {cls && (
        <div className="mt-2 flex gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-classical/55" /> {ds.classBalance?.negativeLabel}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-danger/50" /> {ds.classBalance?.positiveLabel}</span>
        </div>
      )}
    </div>
  );
}

export function CorrelationView({ p }: { p: DatasetProfile }) {
  const [thr, setThr] = useState(0);
  const [pair, setPair] = useState<[number, number] | null>(null);
  const { names, matrix } = p.correlation;
  const n = names.length;
  const cs = Math.min(18, 460 / n);
  const color = (v: number) => (v >= 0 ? `color-mix(in srgb, var(--blue) ${Math.round(Math.abs(v) * 100)}%, var(--surface))` : `color-mix(in srgb, var(--red) ${Math.round(Math.abs(v) * 100)}%, var(--surface))`);
  const scatter = useMemo(() => {
    if (!pair) return [];
    const a = p.previewColumns.indexOf(names[pair[0]]), b = p.previewColumns.indexOf(names[pair[1]]);
    return p.previewRows.slice(0, 800).filter((r) => typeof r[a] === 'number' && typeof r[b] === 'number').map((r) => ({ x: r[a] as number, y: r[b] as number, cls: r[0] }));
  }, [pair, p, names]);
  return (
    <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
      <div>
        <Slider className="mb-3 w-60" label="Hide |r| below" value={thr} min={0} max={0.95} step={0.05} onChange={setThr} format={(v) => v.toFixed(2)} />
        <svg width={n * cs + 90} height={n * cs + 90} role="img" aria-label="Correlation heatmap">
          {names.map((nm, i) => <text key={nm} x={86} y={90 + i * cs + cs * 0.7} fontSize={Math.min(9, cs * 0.6)} textAnchor="end" fill="var(--muted)">{nm.slice(0, 16)}</text>)}
          {names.map((nm, j) => <text key={nm} x={90 + j * cs + cs * 0.6} y={86} fontSize={Math.min(9, cs * 0.6)} fill="var(--muted)" transform={`rotate(-60 ${90 + j * cs + cs * 0.6} 86)`}>{nm.slice(0, 16)}</text>)}
          {matrix.map((row, i) => row.map((v, j) => (
            <rect key={`${i}-${j}`} x={90 + j * cs} y={90 + i * cs} width={cs - 1} height={cs - 1} rx={2} fill={Math.abs(v) < thr && i !== j ? 'var(--surface-3)' : color(v)}
              stroke={pair && pair[0] === i && pair[1] === j ? 'var(--saffron)' : 'none'} strokeWidth={2} style={{ cursor: 'pointer' }} onClick={() => setPair([i, j])}>
              <title>{`${names[i]} × ${names[j]}: r = ${v.toFixed(2)}`}</title>
            </rect>
          )))}
        </svg>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted">−1<div className="h-2 w-40 rounded-full" style={{ background: 'linear-gradient(90deg, var(--red), var(--surface), var(--blue))' }} />+1 · click a cell for the scatter</div>
      </div>
      <div className="min-h-[280px] rounded-lg border border-line p-3">
        {pair ? (
          <>
            <div className="mb-1 text-xs font-semibold text-fg-2">{names[pair[0]]} × {names[pair[1]]} · r = {matrix[pair[0]][pair[1]].toFixed(3)}</div>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ left: -10, right: 10, top: 10 }}>
                <XAxis dataKey="x" type="number" name={names[pair[0]]} {...AXIS} domain={['auto', 'auto']} />
                <YAxis dataKey="y" type="number" name={names[pair[1]]} {...AXIS} domain={['auto', 'auto']} />
                <ZAxis range={[14, 14]} />
                <Tooltip {...tooltipStyle()} />
                <Scatter data={scatter} fillOpacity={0.6}>
                  {scatter.map((d, i) => <Cell key={i} fill={d.cls === 'neg' || d.cls === 'B' || d.cls === '0' ? 'var(--blue)' : typeof d.cls === 'number' ? 'var(--teal)' : 'var(--red)'} />)}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </>
        ) : <div className="flex h-full items-center justify-center text-sm text-muted">Click a heatmap cell to see the scatter plot.</div>}
      </div>
    </div>
  );
}

export function BalanceView({ p, ds }: { p: DatasetProfile; ds: Dataset }) {
  if (!p.classBalance) return <div className="text-sm text-muted">Regression target — class balance does not apply. Target range {ds.targetRange?.join('–')}.</div>;
  const data = [{ name: ds.classBalance?.negativeLabel ?? 'Negative', value: p.classBalance.negative }, { name: ds.classBalance?.positiveLabel ?? 'Positive', value: p.classBalance.positive }];
  const r = p.classBalance.ratio;
  return (
    <div className="grid items-center gap-5 md:grid-cols-2">
      <div className="relative">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={70} outerRadius={100} paddingAngle={3} animationDuration={900}>
              <Cell fill="var(--blue)" />
              <Cell fill="var(--red)" />
            </Pie>
            <Tooltip {...tooltipStyle()} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="metric text-2xl font-bold text-fg">{r.toFixed(2)}:1</span>
          <span className="text-[11px] text-muted">imbalance ratio</span>
        </div>
      </div>
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={d.name} className="flex items-center gap-2 text-sm"><span className="h-3 w-3 rounded-sm" style={{ background: i ? 'var(--red)' : 'var(--blue)' }} /><span className="flex-1 text-fg-2">{d.name}</span><span className="tnum font-semibold">{d.value}</span><span className="tnum w-14 text-right text-muted">{pct1(d.value / p.rows)}</span></div>
        ))}
        {r > 1.5 ? (
          <div className="mt-2 flex gap-2 rounded-lg border border-saffron/40 bg-tint-saffron p-2.5 text-xs text-fg-2"><AlertTriangle size={15} className="shrink-0 text-saffron" />Imbalance above 1.5:1. Use class weights or SMOTE (training split only) in pre-processing, and report balanced accuracy, sensitivity and PR-AUC.</div>
        ) : <div className="mt-2 rounded-lg bg-tint-green p-2.5 text-xs text-fg-2">Classes are reasonably balanced.</div>}
      </div>
    </div>
  );
}

export function DimensionalityView({ p, ds }: { p: DatasetProfile; ds: Dataset }) {
  const high = ds.features > ds.rows / 5;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-xl bg-surface-2 p-4"><div className="text-[11px] text-muted">Features : samples</div><div className="metric text-2xl font-bold">{ds.features.toLocaleString()} : {ds.rows.toLocaleString()}</div><div className="text-xs text-muted">ratio {p.featureSampleRatio.toFixed(3)}</div></div>
      <div className="rounded-xl bg-surface-2 p-4"><div className="text-[11px] text-muted">Qubits needed without reduction</div><div className="metric text-2xl font-bold text-quantum">{ds.features.toLocaleString()} <span className="text-sm font-medium text-muted">angle</span></div><div className="text-xs text-muted">{Math.ceil(Math.log2(Math.max(2, ds.features)))} with amplitude encoding</div></div>
      <div className={cn('rounded-xl border p-4', high ? 'border-danger/40 bg-tint-red' : 'border-ok/30 bg-tint-green')}>
        <div className="text-sm font-semibold text-fg">{high ? 'High-dimensional' : 'Manageable dimensionality'}</div>
        <p className="mt-1 text-xs text-fg-2">{high ? `${ds.features.toLocaleString()} features for ${ds.rows} samples — reduce before encoding (variance filter → LASSO → PCA to 6–8 qubits).` : 'Still, PCA to 6 components keeps the circuit NISQ-friendly.'}</p>
        <Link to="/preprocess?spotlight=pp-step-reduce" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-classical">Go to the reduction step <ArrowRight size={12} /></Link>
      </div>
    </div>
  );
}

export function QualityView({ p }: { p: DatasetProfile }) {
  const s = p.qualityScore;
  const color = s >= 80 ? 'var(--green)' : s >= 60 ? 'var(--saffron)' : 'var(--red)';
  const R = 62, C = 2 * Math.PI * R;
  return (
    <div className="grid items-center gap-6 md:grid-cols-[220px_1fr]">
      <div className="relative mx-auto">
        <svg width={180} height={180} viewBox="0 0 180 180" role="img" aria-label={`Data quality score ${s} out of 100`}>
          <circle cx={90} cy={90} r={R} fill="none" stroke="var(--surface-3)" strokeWidth={14} />
          <motion.circle cx={90} cy={90} r={R} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" transform="rotate(-90 90 90)"
            strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - s / 100) }} transition={{ duration: 1.2, ease: 'easeOut' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="metric text-4xl font-bold" style={{ color }}><CountUp value={s} /></span><span className="text-xs text-muted">/ 100</span></div>
      </div>
      <div className="space-y-2">
        {p.qualityBreakdown.map((b, i) => (
          <div key={b.label} className="flex items-center gap-3 text-sm">
            <span className="w-48 text-fg-2">{b.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3"><motion.div className="h-full rounded-full" style={{ background: b.score / b.max > 0.75 ? 'var(--green)' : b.score / b.max > 0.4 ? 'var(--saffron)' : 'var(--red)' }} initial={{ width: 0 }} animate={{ width: `${(b.score / b.max) * 100}%` }} transition={{ delay: i * 0.08 }} /></div>
            <span className="tnum w-14 text-right text-muted">{b.score}/{b.max}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
