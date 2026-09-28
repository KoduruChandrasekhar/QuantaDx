/** Streaming training charts: loss (smoothed), train/val metric, gradient norm (log) with barren-plateau warning, iteration time, circuit executions. */
import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ModelRun, TrainingEvent } from '@/types/api';
import { ChartCard, AXIS, tooltipStyle } from '@/components/charts/ChartCard';
import { Slider } from '@/components/common/ui';
import { stylesFor } from '@/content/models';
import { compact } from '@/lib/format';

function smooth(xs: number[], a: number): number[] {
  let s = xs[0] ?? 0;
  return xs.map((v) => (s = a * s + (1 - a) * v));
}

export function TrainCharts({ models, progress, selected }: { models: ModelRun[]; progress: Record<string, TrainingEvent[]>; selected: string | 'all' }) {
  const [alpha, setAlpha] = useState(0.6);
  const shown = selected === 'all' ? models : models.filter((m) => m.modelId === selected);
  const styles = stylesFor(models);
  const series = useMemo(() => shown.map((m) => {
    const ev = progress[m.modelId] ?? [];
    const sl = smooth(ev.map((e) => e.loss ?? 0), alpha);
    let cum = 0;
    return { m, data: ev.map((e, i) => {
      cum = e.circuitExecutions ?? cum;
      return { step: i + 1, iter: e.iteration, loss: sl[i], raw: e.loss, train: e.trainMetric, val: e.valMetric, grad: Math.max(1e-5, e.gradNorm ?? 1e-5), t: e.iterTimeMs, execs: cum, shots: e.shotsUsed };
    }) };
  }), [shown, progress, alpha]);
  const plateau = series.some(({ m, data }) => m.family !== 'classical' && data.length > 8 && data.slice(-5).every((d) => d.grad < 1e-3));
  const lines = (key: string, name?: (l: string) => string, dashed?: boolean) =>
    series.map(({ m, data }) => (
      <Line key={`${m.modelId}-${key}`} data={data} dataKey={key} name={name ? name(m.label) : m.label} stroke={styles[m.modelId]?.color} strokeDasharray={dashed ? '5 3' : styles[m.modelId]?.dash} dot={false} strokeWidth={2} isAnimationActive={false} />
    ));
  const common = (children: React.ReactNode, y?: React.ReactNode) => (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart margin={{ left: -10, right: 10, top: 6 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="step" type="number" domain={['dataMin', 'dataMax']} {...AXIS} allowDuplicatedCategory={false} />
        {y ?? <YAxis {...AXIS} />}
        <Tooltip {...tooltipStyle()} formatter={(v: number) => (typeof v === 'number' ? (Math.abs(v) < 0.01 ? v.toExponential(2) : v.toFixed(3)) : v)} />
        {children}
      </LineChart>
    </ResponsiveContainer>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-tour="train-charts">
      <ChartCard title="Loss vs iteration" info="Exponential smoothing applied; raw values in the tooltip." actions={<div className="mr-2 w-28"><Slider value={alpha} min={0} max={0.95} step={0.05} onChange={setAlpha} format={(v) => `smooth ${v.toFixed(2)}`} /></div>}>
        {common(lines('loss'))}
      </ChartCard>
      <ChartCard title="Train / validation accuracy" info="Solid = validation, dashed = training.">
        {common(<>{lines('val', (l) => `${l} · val`)}{lines('train', (l) => `${l} · train`, true)}</>, <YAxis domain={[0.45, 1]} {...AXIS} />)}
      </ChartCard>
      <ChartCard title="Gradient norm (log scale)" info="Vanishing gradients (‖∇θ‖ < 10⁻³) for several iterations indicate a barren plateau.">
        {plateau && (
          <div className="mb-2 flex gap-2 rounded-lg border border-saffron/40 bg-tint-saffron p-2 text-xs text-fg-2">
            <AlertTriangle size={14} className="shrink-0 text-saffron" />
            <span><b>Possible barren plateau.</b> Try fewer layers, a local cost (single-qubit ⟨Z⟩), identity-block initialisation or layer-wise training.</span>
          </div>
        )}
        {common(lines('grad'), <YAxis scale="log" domain={[1e-4, 2]} allowDataOverflow {...AXIS} tickFormatter={(v: number) => v.toExponential(0)} />)}
      </ChartCard>
      <ChartCard title="Time per iteration & circuit executions" info="Quantum models: cumulative circuit executions (parameter-shift needs 2 per parameter per sample).">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart margin={{ left: -10, right: 10, top: 6 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="step" type="number" domain={['dataMin', 'dataMax']} {...AXIS} />
            <YAxis yAxisId="t" {...AXIS} unit=" ms" />
            <YAxis yAxisId="e" orientation="right" {...AXIS} tickFormatter={(v: number) => compact(v)} />
            <Tooltip {...tooltipStyle()} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            {series.map(({ m, data }) => <Line key={`${m.modelId}-t`} yAxisId="t" data={data} dataKey="t" name={`${m.label} ms/iter`} stroke={styles[m.modelId]?.color} strokeOpacity={0.45} dot={false} isAnimationActive={false} />)}
            {series.filter(({ m }) => m.family !== 'classical').map(({ m, data }) => <Line key={`${m.modelId}-e`} yAxisId="e" data={data} dataKey="execs" name={`${m.label} execs`} stroke={styles[m.modelId]?.color} strokeWidth={2.5} dot={false} isAnimationActive={false} />)}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
