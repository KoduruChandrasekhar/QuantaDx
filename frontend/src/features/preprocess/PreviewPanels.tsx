/** Right-hand live panels: split config, feature engineering charts, before/after preview, summary + leakage guard. */
import { motion } from 'framer-motion';
import { CheckCircle2, Download, ShieldCheck, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import type { PreprocessConfig, PreprocessPreview } from '@/types/api';
import { Card, CardHeader, NumberField, Segmented, Slider, Switch } from '@/components/common/ui';
import { CopyButton, CountUp } from '@/components/common/misc';
import { AXIS, tooltipStyle } from '@/components/charts/ChartCard';
import { download } from '@/lib/export';

export function SplitConfig({ split, onChange, counts }: { split: PreprocessConfig['split']; onChange: (s: PreprocessConfig['split']) => void; counts?: PreprocessPreview['splitCounts'] }) {
  const setTrain = (t: number) => {
    const rest = 100 - t;
    const val = Math.round((split.val / (split.val + split.test || 1)) * rest);
    onChange({ ...split, train: t, val, test: rest - val });
  };
  const parts = [['Train', split.train, 'var(--blue)', counts?.train], ['Val', split.val, 'var(--purple)', counts?.val], ['Test', split.test, 'var(--green)', counts?.test]] as const;
  return (
    <Card>
      <CardHeader title="Train / validation / test split" subtitle="Untouched test split for the final benchmark" />
      <div className="space-y-3 p-4">
        <div className="flex h-7 overflow-hidden rounded-lg">
          {parts.map(([l, v, c, n]) => (
            <motion.div key={l} className="flex items-center justify-center text-[10px] font-semibold text-white" style={{ background: c }} animate={{ width: `${v}%` }} transition={{ type: 'spring', stiffness: 200, damping: 25 }}>
              {v >= 10 && `${l} ${v}%${n !== undefined ? ` · ${n}` : ''}`}
            </motion.div>
          ))}
        </div>
        <Slider label="Train %" value={split.train} min={50} max={90} onChange={setTrain} />
        <Slider label="Validation share of the rest" value={split.val} min={0} max={100 - split.train} onChange={(v) => onChange({ ...split, val: v, test: 100 - split.train - v })} accent="var(--purple)" />
        <div className="flex items-end gap-3">
          <Switch checked={split.stratified} onChange={(v) => onChange({ ...split, stratified: v })} label="Stratified" />
          <NumberField className="ml-auto w-28" label="Seed" value={split.seed} onChange={(v) => onChange({ ...split, seed: v })} />
        </div>
      </div>
    </Card>
  );
}

export function FeatureEngineering({ p, k }: { p: PreprocessPreview; k: number }) {
  const [tab, setTab] = useState<'imp' | 'scree' | 'pca'>('imp');
  const scree = p.explainedVariance.map((v, i) => ({ pc: `PC${i + 1}`, var: v, cum: p.explainedVariance.slice(0, i + 1).reduce((s, x) => s + x, 0) }));
  return (
    <Card>
      <CardHeader title="Feature engineering" subtitle="Computed on the training split" actions={
        <Segmented size="sm" value={tab} onChange={setTab} options={[{ value: 'imp', label: 'Importance' }, { value: 'scree', label: 'Scree' }, { value: 'pca', label: 'PCA 2D' }]} />
      } />
      <div className="p-3">
        {tab === 'imp' && (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={p.featureScores.slice(0, 20)} layout="vertical" margin={{ left: 40, right: 12 }}>
              <XAxis type="number" domain={[0, 1]} {...AXIS} />
              <YAxis type="category" dataKey="name" width={110} {...AXIS} tick={{ fontSize: 9, fill: 'var(--muted)' }} interval={0} />
              <Tooltip {...tooltipStyle()} formatter={(v: number) => v.toFixed(3)} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]} animationDuration={600}>
                {p.featureScores.slice(0, 20).map((f, i) => <Cell key={f.name} fill={f.selected ? 'var(--blue)' : 'var(--line-strong)'} fillOpacity={i < k || f.selected ? 1 : 0.4} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {tab === 'scree' && (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={scree} margin={{ left: -15, right: 12, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="pc" {...AXIS} />
              <YAxis domain={[0, 1]} {...AXIS} />
              {[0.8, 0.9, 0.95].map((y) => <ReferenceLine key={y} y={y} stroke="var(--saffron)" strokeDasharray="4 3" label={{ value: `${y * 100}%`, fontSize: 9, fill: 'var(--saffron)', position: 'right' }} />)}
              <Tooltip {...tooltipStyle()} formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
              <Line dataKey="cum" name="Cumulative" stroke="var(--purple)" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line dataKey="var" name="Per component" stroke="var(--blue)" strokeWidth={1.5} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
        {tab === 'pca' && (
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ left: -15, right: 12, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="x" type="number" name="PC1" {...AXIS} domain={['auto', 'auto']} />
              <YAxis dataKey="y" type="number" name="PC2" {...AXIS} domain={['auto', 'auto']} />
              <ZAxis range={[16, 16]} />
              <Tooltip {...tooltipStyle()} />
              <Scatter data={p.pcaScatter} fillOpacity={0.65} animationDuration={700}>
                {p.pcaScatter.map((d, i) => <Cell key={i} fill={d.label === 1 ? 'var(--red)' : 'var(--blue)'} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

function MiniHist({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-12 items-end gap-px">
      {values.map((v, i) => <motion.div key={i} className="flex-1 rounded-t-sm" style={{ background: color }} initial={false} animate={{ height: `${(v / max) * 100}%` }} />)}
    </div>
  );
}

export function BeforeAfter({ p }: { p: PreprocessPreview }) {
  const fmt = (v: number | null) => (v === null ? 'NaN' : Math.abs(v) < 0.01 && v !== 0 ? v.toExponential(1) : Number(v.toFixed(3)));
  return (
    <Card data-tour="pp-preview">
      <CardHeader title="Before / after preview" subtitle="POST /preprocess/preview · nothing is persisted" />
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['Missing values imputed', p.missingHandled, 'var(--red)'], ['Outlier values clipped', p.outliersHandled, 'var(--saffron)'], ['Duplicates removed', p.duplicatesRemoved, 'var(--blue)']].map(([l, v, c]) => (
            <div key={l as string} className="rounded-lg bg-surface-2 p-2">
              <div className="metric text-xl font-bold" style={{ color: c as string }}><CountUp value={v as number} /></div>
              <div className="text-[10px] text-muted">{l as string}</div>
            </div>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {p.distributions.slice(0, 4).map((d) => (
            <div key={d.feature} className="rounded-lg border border-line p-2">
              <div className="mb-1 truncate text-[11px] font-semibold text-fg-2">{d.feature}</div>
              <div className="grid grid-cols-2 gap-2">
                <div><MiniHist values={d.before} color="var(--line-strong)" /><div className="mt-0.5 text-center text-[9px] text-muted">raw</div></div>
                <div><MiniHist values={d.after} color="var(--blue)" /><div className="mt-0.5 text-center text-[9px] text-muted">cleaned + scaled</div></div>
              </div>
            </div>
          ))}
        </div>
        {[['Before', p.before], ['After', p.after]].map(([label, t]) => {
          const tab = t as PreprocessPreview['before'];
          return (
            <div key={label as string}>
              <div className="mb-1 text-[11px] font-semibold text-muted">{label as string}</div>
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full font-mono text-[10px]">
                  <thead className="bg-surface-2"><tr>{tab.columns.map((c) => <th key={c} className="whitespace-nowrap px-2 py-1 text-left font-semibold text-fg-2">{c}</th>)}</tr></thead>
                  <tbody>{tab.rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((v, j) => <td key={j} className={v === null ? 'bg-tint-red px-2 py-1 text-danger' : 'tnum px-2 py-1 text-fg-2'}>{fmt(v)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function PipelineSummary({ p, config }: { p: PreprocessPreview; config: PreprocessConfig }) {
  const json = JSON.stringify(config, null, 2);
  const [showJson, setShowJson] = useState(false);
  return (
    <Card>
      <CardHeader title="Pipeline summary" icon={<ShieldCheck size={16} />} actions={<>
        <CopyButton text={json} label="Copy JSON" />
        <button className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-3 hover:text-fg" onClick={() => download('preprocess-config.json', json, 'application/json')}><Download size={13} /> Export</button>
      </>} />
      <div className="space-y-3 p-4">
        <ol className="space-y-1.5">
          {p.summary.map((s, i) => (
            <motion.li key={s} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex gap-2 text-xs text-fg-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-tint-blue text-[9px] font-bold text-classical">{i + 1}</span>{s}
            </motion.li>
          ))}
        </ol>
        <div className="rounded-lg border border-ok/30 bg-tint-green p-3">
          <div className="mb-1.5 text-xs font-semibold text-ok">Leakage guard</div>
          {p.leakageGuard.map((g) => (
            <div key={g.check} className="flex items-center gap-2 text-xs text-fg-2">{g.ok ? <CheckCircle2 size={13} className="text-ok" /> : <XCircle size={13} className="text-danger" />}{g.check}</div>
          ))}
        </div>
        <button className="text-xs font-medium text-classical hover:underline" onClick={() => setShowJson((s) => !s)}>{showJson ? 'Hide' : 'Show'} JSON config</button>
        {showJson && <pre className="max-h-60 overflow-auto rounded-lg bg-[#0f1b2d] p-3 font-mono text-[10px] text-[#c3cfdf]">{json}</pre>}
      </div>
    </Card>
  );
}
