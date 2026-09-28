/** Computational efficiency (O6), qubit scaling (O4/O6), noise robustness, bandwidth sweep and calibration. */
import { useState } from 'react';
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import type { ExperimentResults } from '@/types/api';
import { useSelection } from '@/store';
import { Segmented, Switch } from '@/components/common/ui';
import { ChartCard, AXIS, tooltipStyle } from '@/components/charts/ChartCard';
import { CalibrationChart, type Styles } from '@/components/charts/charts';
import { compact, duration } from '@/lib/format';

export function Efficiency({ r, styles }: { r: ExperimentResults; styles: Styles }) {
  const [log, setLog] = useState(true);
  const [which, setWhich] = useState<'train' | 'inf'>('train');
  const hl = useSelection((s) => s.highlightedModelId);
  const data = r.models.map((m) => ({ id: m.modelId, name: m.label, train: m.efficiency.trainTimeSec, inf: m.efficiency.inferenceMsPerSample, auc: m.metrics?.rocAuc.mean ?? m.regression?.r2.mean ?? 0, execs: m.efficiency.circuitExecutions ?? 0, mem: m.efficiency.memoryMb }));
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-tour="results-efficiency">
      <ChartCard title={which === 'train' ? 'Training time' : 'Inference time per sample'} info="Quantum models are dominated by circuit executions on the simulator." actions={<div className="mr-2 flex items-center gap-2"><Segmented size="sm" value={which} onChange={setWhich} options={[{ value: 'train', label: 'Train' }, { value: 'inf', label: 'Inference' }]} /><Switch checked={log} onChange={setLog} label={<span className="text-xs">log</span>} /></div>}
        table={{ columns: ['Model', 'Train (s)', 'Inference (ms)'], rows: data.map((d) => [d.name, d.train, d.inf]) }}>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} layout="vertical" margin={{ left: 40, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" scale={log ? 'log' : 'auto'} domain={log ? [0.001, 'auto'] : [0, 'auto']} allowDataOverflow {...AXIS} tickFormatter={(v: number) => (which === 'train' ? duration(v) : `${v} ms`)} />
            <YAxis type="category" dataKey="name" width={130} {...AXIS} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
            <Tooltip {...tooltipStyle()} formatter={(v: number) => (which === 'train' ? duration(v) : `${v} ms`)} />
            <Bar dataKey={which} radius={[0, 4, 4, 0]} animationDuration={700}>{data.map((d) => <Cell key={d.id} fill={styles[d.id]?.color} fillOpacity={hl && hl !== d.id ? 0.25 : 1} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Efficiency frontier" info="x = training time (log), y = ROC-AUC. Up-and-left is better. Bubble size = memory.">
        <ResponsiveContainer width="100%" height={250}>
          <ScatterChart margin={{ left: -10, right: 16, top: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="train" scale="log" domain={['auto', 'auto']} {...AXIS} tickFormatter={(v: number) => duration(v)} name="Train time" />
            <YAxis type="number" dataKey="auc" domain={['auto', 'auto']} {...AXIS} name={r.taskType === 'regression' ? 'R²' : 'ROC-AUC'} />
            <ZAxis type="number" dataKey="mem" range={[60, 400]} />
            <Tooltip {...tooltipStyle()} formatter={(v: number, n: string) => (n === 'Train time' ? duration(v) : v.toFixed(3))} labelFormatter={() => ''} />
            <Scatter data={data} animationDuration={700}>{data.map((d) => <Cell key={d.id} fill={styles[d.id]?.color} fillOpacity={hl && hl !== d.id ? 0.2 : 0.85} />)}</Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Circuit executions & memory" info="Total circuit executions over the run (quantum models) and peak memory.">
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={data} margin={{ left: 0, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" {...AXIS} tick={{ fontSize: 9, fill: 'var(--muted)' }} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis yAxisId="e" {...AXIS} tickFormatter={(v: number) => compact(v)} />
            <YAxis yAxisId="m" orientation="right" {...AXIS} unit=" MB" />
            <Tooltip {...tooltipStyle()} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="e" dataKey="execs" name="Circuit executions" fill="var(--purple)" radius={[3, 3, 0, 0]} />
            <Line yAxisId="m" dataKey="mem" name="Memory (MB)" stroke="var(--saffron)" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
      {r.qubitScaling.length > 0 && (
        <ChartCard title="Scaling study: qubits / features" info="Same features for both families. Quantum runtime grows exponentially on a simulator; accuracy peaks around 8 qubits (kernel concentration beyond).">
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={r.qubitScaling} margin={{ left: -10, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="qubits" {...AXIS} />
              <YAxis yAxisId="a" domain={[0.9, 0.97]} {...AXIS} />
              <YAxis yAxisId="t" orientation="right" scale="log" domain={[0.1, 5000]} {...AXIS} tickFormatter={(v: number) => duration(v)} />
              <Tooltip {...tooltipStyle()} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="a" dataKey="quantumAcc" name="Quantum accuracy" stroke="var(--purple)" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line yAxisId="a" dataKey="classicalAcc" name="Classical accuracy" stroke="var(--blue)" strokeWidth={2.5} dot={{ r: 3 }} />
              <Area yAxisId="t" dataKey="quantumRuntimeSec" name="Quantum runtime" fill="var(--purple)" fillOpacity={0.12} stroke="var(--purple)" strokeDasharray="4 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

export function NoiseRobustness({ r, styles }: { r: ExperimentResults; styles: Styles }) {
  const [mit, setMit] = useState(true);
  if (!r.noiseRobustness.length) return null;
  const ids = Object.keys(r.noiseRobustness[0].series);
  const data = r.noiseRobustness.map((p) => ({ level: p.level, ...Object.fromEntries(ids.map((id) => [id, p.series[id]])), ...Object.fromEntries(ids.map((id) => [`${id}_m`, p.mitigated[id]])) }));
  const name = (id: string) => r.models.find((m) => m.modelId === id)?.label ?? id;
  return (
    <ChartCard title="Noise robustness: ideal → noisy simulator → hardware" info="Accuracy under increasing noise. Dashed = with readout mitigation + ZNE. Classical reference is flat." tourId="results-noise"
      actions={<div className="mr-2"><Switch checked={mit} onChange={setMit} label={<span className="text-xs">mitigation</span>} color="var(--green)" /></div>}>
      <div id="noise" />
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ left: -10, right: 12, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="level" {...AXIS} tick={{ fontSize: 9, fill: 'var(--muted)' }} interval={0} angle={-18} textAnchor="end" />
          <YAxis domain={['auto', 'auto']} {...AXIS} />
          <Tooltip {...tooltipStyle()} formatter={(v: number) => v.toFixed(3)} />
          <Legend wrapperStyle={{ fontSize: 10 }} verticalAlign="top" />
          {ids.map((id) => <Line key={id} dataKey={id} name={name(id)} stroke={styles[id]?.color ?? 'var(--blue)'} strokeWidth={2.2} dot={{ r: 3 }} />)}
          {mit && ids.filter((id) => r.models.find((m) => m.modelId === id)?.family !== 'classical').map((id) => <Line key={`${id}_m`} dataKey={`${id}_m`} name={`${name(id)} · mitigated`} stroke={styles[id]?.color} strokeDasharray="5 4" strokeWidth={1.5} dot={false} legendType="none" />)}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function BandwidthSweep({ r }: { r: ExperimentResults }) {
  if (!r.bandwidthSweep) return null;
  const sel = r.bandwidthSweep.find((b) => b.selected)!;
  return (
    <ChartCard title="Kernel bandwidth sweep (QSVM)" info="Mean outer-fold accuracy per bandwidth. The CV-selected value is marked. Large bandwidth → kernel concentration (all patients look alike)." tourId="results-bandwidth"
      table={{ columns: ['Bandwidth', 'Accuracy', 'Selected'], rows: r.bandwidthSweep.map((b) => [b.bandwidth, b.accuracy, b.selected ? '✓' : '']) }}>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={r.bandwidthSweep} margin={{ left: -10, right: 16, top: 16 }}>
          <defs><linearGradient id="bwg" x1="0" x2="1"><stop offset="0" stopColor="var(--purple)" /><stop offset="1" stopColor="var(--red)" /></linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="bandwidth" type="number" scale="log" domain={[0.04, 1.1]} ticks={[0.05, 0.1, 0.2, 0.3, 0.5, 1]} {...AXIS} />
          <YAxis domain={[0.78, 0.96]} {...AXIS} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
          <Tooltip {...tooltipStyle()} formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
          <ReferenceLine x={sel.bandwidth} stroke="var(--saffron)" strokeDasharray="4 3" label={{ value: `CV-selected ${sel.bandwidth}`, fontSize: 10, fill: 'var(--saffron)', position: 'top' }} />
          <Line dataKey="accuracy" stroke="url(#bwg)" strokeWidth={3} dot={{ r: 4, fill: 'var(--purple)' }} animationDuration={1200} />
          <ReferenceDot x={1} y={0.815} r={6} fill="var(--red)" stroke="var(--surface)" label={{ value: 'raw ZZ: concentrated', fontSize: 10, fill: 'var(--red)', position: 'left' }} />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-muted">Bandwidth tuning fixed kernel concentration: <b className="text-fg">81.5% → 94.0%</b>. Bandwidth is chosen by inner 3-fold CV on training data only.</p>
    </ChartCard>
  );
}

export function Calibration({ r, styles }: { r: ExperimentResults; styles: Styles }) {
  const hl = useSelection((s) => s.highlightedModelId);
  const shown = r.models.filter((m) => !hl || m.modelId === hl);
  return (
    <ChartCard title="Calibration (reliability diagram)" info="Points on the diagonal mean predicted probabilities match observed frequencies. Brier score in the table."
      table={{ columns: ['Model', 'Brier'], rows: r.models.map((m) => [m.label, m.metrics!.brier.mean]) }}>
      <CalibrationChart models={shown} styles={styles} height={260} />
    </ChartCard>
  );
}
