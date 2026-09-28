/** Significance table (McNemar / paired t / Wilcoxon) and generalization (O6): gaps, learning curves, fold spread, external validation, input noise. */
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ExperimentResults } from '@/types/api';
import { useSelection } from '@/store';
import { Card, CardHeader, Tip, cn } from '@/components/common/ui';
import { ChartCard, AXIS, tooltipStyle } from '@/components/charts/ChartCard';
import type { Styles } from '@/components/charts/charts';
import { pValue } from '@/lib/format';

export function SignificanceTable({ r }: { r: ExperimentResults }) {
  const name = (id: string) => r.models.find((m) => m.modelId === id)?.label ?? id;
  if (!r.significance.length) return null;
  return (
    <Card data-tour="results-significance">
      <CardHeader title="Statistical significance" subtitle="McNemar on paired out-of-fold predictions · paired t-test and Wilcoxon on CV-fold accuracies. With 5 folds the smallest possible Wilcoxon p is 0.0625." />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-surface-2 text-left text-muted"><tr>{['Quantum / hybrid', 'vs classical', 'McNemar χ² (b/c)', 'p', 'Paired t', 'p', 'Wilcoxon W', 'p', 'Verdict'].map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {r.significance.map((s, i) => (
              <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="border-t border-line">
                <td className="px-3 py-2 font-medium text-quantum">{name(s.modelA)}</td>
                <td className="px-3 py-2 text-classical">{name(s.modelB)}</td>
                <td className="tnum px-3 py-2">{s.mcnemar?.statistic.toFixed(2)} <span className="text-muted">({s.mcnemar?.b}/{s.mcnemar?.c})</span></td>
                <td className={cn('tnum px-3 py-2 font-semibold', (s.mcnemar?.pValue ?? 1) < 0.05 ? 'text-danger' : 'text-muted')}>{pValue(s.mcnemar?.pValue ?? 1)}</td>
                <td className="tnum px-3 py-2">{s.pairedT.statistic.toFixed(2)}</td>
                <td className={cn('tnum px-3 py-2 font-semibold', s.pairedT.pValue < 0.05 ? 'text-danger' : 'text-muted')}>{pValue(s.pairedT.pValue)}</td>
                <td className="tnum px-3 py-2">{s.wilcoxon.statistic}</td>
                <td className="tnum px-3 py-2 text-muted">{pValue(s.wilcoxon.pValue)}</td>
                <td className="max-w-md px-3 py-2 text-fg-2">{s.verdict}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function FoldBoxes({ r, styles }: { r: ExperimentResults; styles: Styles }) {
  const hl = useSelection((s) => s.highlightedModelId);
  const all = r.models.flatMap((m) => (m.metrics ? m.metrics.accuracy.folds : m.regression!.rmse.folds));
  const lo = Math.min(...all) - 0.01, hi = Math.max(...all) + 0.01;
  const sc = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="space-y-2" role="img" aria-label="Per-fold accuracy spread per model">
      {r.models.map((m) => {
        const f = [...(m.metrics ? m.metrics.accuracy.folds : m.regression!.rmse.folds)].sort((a, b) => a - b);
        return (
          <Tip key={m.modelId} text={`${m.label}: folds ${f.map((v) => v.toFixed(3)).join(', ')}`}>
            <div className={cn('flex items-center gap-2 text-[11px] transition-opacity', hl && hl !== m.modelId && 'opacity-30')}>
              <span className="w-40 truncate text-fg-2">{m.label}</span>
              <div className="relative h-5 flex-1 rounded bg-surface-2">
                <div className="absolute top-1/2 h-px -translate-y-1/2" style={{ left: sc(f[0]), right: `calc(100% - ${sc(f[f.length - 1])})`, background: styles[m.modelId]?.color }} />
                <div className="absolute inset-y-1 rounded-sm opacity-40" style={{ left: sc(f[1]), width: `calc(${sc(f[f.length - 2])} - ${sc(f[1])})`, background: styles[m.modelId]?.color }} />
                {f.map((v, i) => <motion.div key={i} className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-surface" style={{ background: styles[m.modelId]?.color }} initial={{ left: '50%' }} animate={{ left: sc(v) }} transition={{ delay: i * 0.05 }} />)}
              </div>
            </div>
          </Tip>
        );
      })}
      <div className="flex justify-between pl-[168px] font-mono text-[9px] text-muted"><span>{lo.toFixed(3)}</span><span>{r.taskType === 'regression' ? 'RMSE per fold' : 'accuracy per fold'}</span><span>{hi.toFixed(3)}</span></div>
    </div>
  );
}

export function Generalization({ r, styles }: { r: ExperimentResults; styles: Styles }) {
  const hl = useSelection((s) => s.highlightedModelId);
  const gaps = r.models.map((m) => ({ name: m.label, id: m.modelId, train: m.trainTestGap.train, test: m.trainTestGap.test }));
  const reg = r.taskType === 'regression';
  const lcModels = r.models.filter((m) => !hl || m.modelId === hl).slice(0, hl ? 1 : 4);
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-tour="results-generalization">
      <ChartCard title={`Train vs test ${reg ? 'RMSE' : 'accuracy'}`} info="A large gap signals overfitting. Tree ensembles typically show the biggest gap." table={{ columns: ['Model', 'Train', 'Test'], rows: gaps.map((g) => [g.name, g.train, g.test]) }}>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={gaps} margin={{ left: -10, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" {...AXIS} tick={{ fontSize: 9, fill: 'var(--muted)' }} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis domain={reg ? [0, 'auto'] : [0.7, 1]} {...AXIS} />
            <Tooltip {...tooltipStyle()} formatter={(v: number) => v.toFixed(3)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="train" name="Train" radius={[3, 3, 0, 0]}>{gaps.map((g) => <Cell key={g.id} fill="var(--line-strong)" fillOpacity={hl && hl !== g.id ? 0.3 : 1} />)}</Bar>
            <Bar dataKey="test" name="Test" radius={[3, 3, 0, 0]}>{gaps.map((g) => <Cell key={g.id} fill={styles[g.id]?.color} fillOpacity={hl && hl !== g.id ? 0.3 : 1} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Learning curves" info="Validation metric vs training-set size (solid) and training metric (dashed). Hover a leaderboard row to isolate a model.">
        <ResponsiveContainer width="100%" height={250}>
          <LineChart margin={{ left: -10, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="n" type="number" domain={['dataMin', 'dataMax']} {...AXIS} />
            <YAxis domain={['auto', 'auto']} {...AXIS} />
            <Tooltip {...tooltipStyle()} formatter={(v: number) => v.toFixed(3)} />
            {lcModels.map((m) => <Line key={`${m.modelId}v`} data={m.learningCurve} dataKey="val" name={`${m.label} val`} stroke={styles[m.modelId]?.color} strokeWidth={2} dot={{ r: 2.5 }} />)}
            {lcModels.map((m) => <Line key={`${m.modelId}t`} data={m.learningCurve} dataKey="train" name={`${m.label} train`} stroke={styles[m.modelId]?.color} strokeDasharray="4 3" strokeWidth={1.2} dot={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold text-fg">CV fold variance</h3>
        <FoldBoxes r={r} styles={styles} />
      </Card>
      {r.externalValidation.length > 0 ? (
        <ChartCard title="External validation (held-out site)" info="Same models evaluated on an independent cohort — the performance drop measures generalization." table={{ columns: ['Model', 'Internal', 'External'], rows: r.externalValidation.map((e) => [e.modelId, e.internal, e.external]) }}>
          <div className="space-y-2.5">
            {r.externalValidation.map((e, i) => {
              const m = r.models.find((x) => x.modelId === e.modelId)!;
              return (
                <div key={e.modelId} className="text-xs">
                  <div className="mb-1 flex justify-between"><span className="text-fg-2">{m.label}</span><span className="tnum text-muted">{e.internal.toFixed(3)} → <b className="text-fg">{e.external.toFixed(3)}</b> <span className="text-danger">({((e.external - e.internal) * 100).toFixed(1)} pts)</span></span></div>
                  <div className="relative h-2.5 rounded-full bg-surface-3">
                    <motion.div className="absolute inset-y-0 left-0 rounded-full opacity-30" style={{ background: styles[m.modelId]?.color }} initial={{ width: 0 }} whileInView={{ width: `${((e.internal - 0.85) / 0.15) * 100}%` }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} />
                    <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ background: styles[m.modelId]?.color }} initial={{ width: 0 }} whileInView={{ width: `${((e.external - 0.85) / 0.15) * 100}%` }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.05 }} />
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-muted">{r.externalValidation[0].site} · metric {r.externalValidation[0].metric}. Faded bar = internal CV.</p>
          </div>
        </ChartCard>
      ) : <Card className="flex items-center justify-center p-6 text-sm text-muted">No external validation dataset configured for this experiment.</Card>}
      {r.inputNoise.length > 0 && (
        <ChartCard title="Robustness to input noise" info="Accuracy as Gaussian noise (σ in standardised units) is added to test features." className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={r.inputNoise.map((p) => ({ sigma: p.sigma, ...p.series }))} margin={{ left: -10, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sigma" {...AXIS} label={{ value: 'noise σ', position: 'insideBottomRight', offset: -2, fontSize: 10, fill: 'var(--muted)' }} />
              <YAxis domain={[0.6, 1]} {...AXIS} />
              <Tooltip {...tooltipStyle()} formatter={(v: number) => v.toFixed(3)} />
              {r.models.map((m) => <Line key={m.modelId} dataKey={m.modelId} name={m.label} stroke={styles[m.modelId]?.color} strokeDasharray={styles[m.modelId]?.dash} strokeWidth={hl === m.modelId ? 3 : 1.8} strokeOpacity={hl && hl !== m.modelId ? 0.15 : 1} dot={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
