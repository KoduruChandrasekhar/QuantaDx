import { motion } from 'framer-motion';
import { Atom, Boxes, Clock, Cpu, Database, FlaskConical, Play, Rocket, Server, Stethoscope, Terminal, Upload, X } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { useBackends, useCancelExperiment, useDatasets, useDeployed, useExperiments, useResults } from '@/api/hooks';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Progress } from '@/components/common/ui';
import { EmptyState, FamilyBadge, MetricCard, PageSkeleton } from '@/components/common/misc';
import { ChartCard, AXIS, tooltipStyle } from '@/components/charts/ChartCard';
import { RocChart } from '@/components/charts/charts';
import { StatusChip } from '@/features/common/StatusChip';
import { PipelineFlow } from '@/features/home/PipelineFlow';
import { HeroBanner } from '@/features/dashboard/HeroBanner';
import { stylesFor } from '@/content/models';
import { compact, countdown, dateTime, duration, pct1 } from '@/lib/format';
import { useDemo, usePipeline } from '@/store';

export default function Dashboard() {
  const { data: exps, isLoading } = useExperiments(true);
  const { data: datasets } = useDatasets();
  const { data: backends } = useBackends();
  const { data: poc } = useResults('exp-poc-001');
  const datasetId = usePipeline((s) => s.activeDatasetId);
  const setActive = usePipeline((s) => s.setActiveExperiment);
  const { data: deployed } = useDeployed(datasetId);
  const cancel = useCancelExperiment();
  const startDemo = useDemo((s) => s.start);
  const navigate = useNavigate();

  const stats = useMemo(() => {
    if (!exps || !poc) return null;
    const running = exps.filter((e) => e.status === 'running').length;
    const queued = exps.filter((e) => e.status === 'queued').length;
    const done = exps.filter((e) => e.status === 'done').length;
    const cls = poc.models.filter((m) => m.family === 'classical');
    const qm = poc.models.filter((m) => m.family !== 'classical');
    const best = (ms: typeof cls) => [...ms].sort((a, b) => b.metrics!.accuracy.mean - a.metrics!.accuracy.mean)[0];
    const avg = (ms: typeof cls) => ms.reduce((s, m) => s + m.efficiency.trainTimeSec, 0) / ms.length;
    const execs = poc.models.reduce((s, m) => s + (m.efficiency.circuitExecutions ?? 0), 0);
    return { running, queued, done, bc: best(cls), bq: best(qm), avgC: avg(cls), avgQ: avg(qm), execs };
  }, [exps, poc]);

  if (isLoading || !stats || !poc) return <PageSkeleton />;
  if (!exps?.length) return <EmptyState title="No experiments yet" description="Load a benchmark dataset to get started." action={<Button onClick={() => navigate('/data')}>Load a benchmark dataset</Button>} />;

  const active = exps.filter((e) => e.status === 'running' || e.status === 'queued');
  const pair = [stats.bc, stats.bq];
  const styles = stylesFor(pair);
  const bars = pair.map((m) => ({ name: m.label.replace('QSVM · ', 'QSVM '), Sensitivity: m.metrics!.sensitivity.mean, Specificity: m.metrics!.specificity.mean }));

  return (
    <div>
      <PageHeader title="Training & Evaluation Dashboard" trace="dashboard" description="Live view of experiments, models, backends and the deployed model." actions={
        <>
          <Button variant="outline" size="sm" icon={<Upload size={14} />} onClick={() => navigate('/data')}>Upload data</Button>
          <Button variant="quantum" size="sm" icon={<FlaskConical size={14} />} onClick={() => navigate('/models')}>New experiment</Button>
        </>
      } />

      <HeroBanner running={stats.running + stats.queued} experiments={exps.length} qubits={6} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6" data-tour="dash-kpis">
        <MetricCard label="Datasets loaded" value={datasets?.length ?? 0} icon={<Database size={15} />} sub="7 benchmarks + uploads" />
        <MetricCard label="Experiments" value={exps.length} icon={<Boxes size={15} />} color="var(--navy)" sub={<span>{stats.done} done · <b className="text-classical">{stats.running}</b> running · {stats.queued} queued</span>} />
        <MetricCard label="Best quantum AUC" value={stats.bq.metrics!.rocAuc.mean} format={(v) => v.toFixed(3)} icon={<Atom size={15} />} color="var(--purple)" sub={`sens ${pct1(stats.bq.metrics!.sensitivity.mean)} · spec ${pct1(stats.bq.metrics!.specificity.mean)}`} />
        <MetricCard label="Best classical AUC" value={stats.bc.metrics!.rocAuc.mean} format={(v) => v.toFixed(3)} icon={<Cpu size={15} />} color="var(--blue)" sub={`sens ${pct1(stats.bc.metrics!.sensitivity.mean)} · spec ${pct1(stats.bc.metrics!.specificity.mean)}`} />
        <MetricCard label="Avg train time" value={stats.avgQ} format={duration} icon={<Clock size={15} />} color="var(--saffron)" sub={`quantum · classical ${duration(stats.avgC)}`} />
        <MetricCard label="Circuit executions (week)" value={stats.execs} format={compact} icon={<Server size={15} />} color="var(--teal)" sub="statevector + shots" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2" data-tour="dash-jobs">
          <CardHeader title="Active jobs" subtitle="Live progress from the training stream" icon={<Rocket size={16} />} />
          <div className="divide-y divide-line">
            {active.length === 0 && <EmptyState title="No jobs running" description="Start one from Model Studio." action={<Button size="sm" onClick={() => navigate('/models')}>New experiment</Button>} />}
            {active.map((e) => (
              <div key={e.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/experiments/${e.id}/train`} onClick={() => setActive(e.id)} className="font-medium text-fg hover:text-classical">{e.name}</Link>
                  <StatusChip status={e.status} />
                  <Badge color="var(--navy)">{e.backend}</Badge>
                  <Button size="sm" variant="ghost" className="ml-auto" icon={<X size={13} />} onClick={() => cancel.mutate(e.id, { onSuccess: () => toast.info(`Cancelled ${e.name}`) })}>Cancel</Button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {e.models.map((m) => (
                    <div key={m.modelId} className="rounded-lg bg-surface-2 p-2.5">
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-fg-2">{m.label}</span>
                        <span className="tnum shrink-0 text-muted">{m.status === 'done' ? '✓' : m.status === 'queued' ? 'queued' : `${Math.round(m.progress * 100)}% · ETA ${countdown(m.etaSec ?? 0)}`}</span>
                      </div>
                      <Progress value={m.status === 'done' ? 1 : m.progress} color={m.family === 'classical' ? 'var(--blue)' : m.family === 'hybrid' ? 'var(--teal)' : 'var(--purple)'} striped={m.status === 'running'} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Deployed model" subtitle="Serving POST /predict" icon={<Stethoscope size={16} />} />
          {deployed?.[0] ? (
            <div className="p-4">
              <div className="flex items-center gap-2"><span className="font-semibold text-fg">{deployed[0].label}</span><FamilyBadge family={deployed[0].family} /><Badge color="var(--green)">{deployed[0].version} · {deployed[0].stage}</Badge></div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {deployed[0].metrics.rmse !== undefined ? (
                  <div className="col-span-3 rounded-lg bg-surface-2 p-2"><div className="text-[10px] text-muted">RMSE</div><div className="tnum text-lg font-bold">{deployed[0].metrics.rmse.toFixed(2)}</div></div>
                ) : (
                  [['Sensitivity', deployed[0].metrics.sensitivity], ['Specificity', deployed[0].metrics.specificity], ['AUC', deployed[0].metrics.rocAuc]].map(([k, v]) => (
                    <div key={k as string} className="rounded-lg bg-surface-2 p-2"><div className="text-[10px] text-muted">{k as string}</div><div className="tnum text-lg font-bold text-fg">{k === 'AUC' ? (v as number).toFixed(3) : pct1(v as number)}</div></div>
                  ))
                )}
              </div>
              <div className="mt-3 text-xs text-muted">Threshold {deployed[0].threshold} · {deployed[0].backend} · since {dateTime(deployed[0].deployedAt)}</div>
              <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => navigate('/predict')}>Open decision support</Button>
            </div>
          ) : <EmptyState title="No deployed model for this dataset" action={<Button size="sm" onClick={() => navigate('/experiments')}>Open registry</Button>} />}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <ChartCard title="Best quantum vs best classical · ROC" info="Out-of-fold ROC curves from the PoC experiment (5-fold CV)." summary={`ROC overlay: ${stats.bc.label} AUC ${stats.bc.metrics!.rocAuc.mean}, ${stats.bq.label} AUC ${stats.bq.metrics!.rocAuc.mean}`}
          table={{ columns: ['Model', 'AUC'], rows: pair.map((m) => [m.label, m.metrics!.rocAuc.mean]) }}>
          <RocChart models={pair} styles={styles} height={220} mini />
        </ChartCard>
        <ChartCard title="Sensitivity & specificity" info="The O3 comparison at a glance: quantum matches specificity but trails on sensitivity." table={{ columns: ['Model', 'Sensitivity', 'Specificity'], rows: bars.map((b) => [b.name, b.Sensitivity, b.Specificity]) }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bars} margin={{ left: -20, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" {...AXIS} tick={{ fontSize: 10, fill: 'var(--muted)' }} />
              <YAxis domain={[0.8, 1]} {...AXIS} />
              <Tooltip {...tooltipStyle()} formatter={(v: number) => pct1(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Sensitivity" fill="var(--blue)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Specificity" fill="var(--purple)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <Card>
          <CardHeader title="Quantum backends" subtitle="Simulators + IBM Quantum" icon={<Server size={16} />} />
          <ul className="divide-y divide-line">
            {backends?.map((b) => (
              <li key={b.id} className="flex items-center gap-2 px-4 py-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: b.status === 'online' ? 'var(--green)' : 'var(--saffron)' }} />
                <span className="flex-1 truncate font-medium text-fg-2">{b.name}</span>
                <span className="text-muted">{b.qubits}q</span>
                <motion.span key={b.queue} initial={{ scale: 1.3, color: 'var(--saffron)' }} animate={{ scale: 1, color: 'var(--muted)' }} className="tnum w-14 text-right">queue {b.queue}</motion.span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="Recent experiments" icon={<Boxes size={16} />} actions={<Link to="/experiments" className="text-xs font-medium text-classical hover:underline">Open registry →</Link>} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted"><tr><th className="px-4 py-2">Experiment</th><th className="px-4 py-2">Dataset</th><th className="px-4 py-2">Models</th><th className="px-4 py-2">Best (classical / quantum)</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Date</th></tr></thead>
            <tbody>
              {exps.slice(0, 6).map((e) => (
                <tr key={e.id} className="cursor-pointer border-t border-line hover:bg-surface-2" onClick={() => { setActive(e.id); navigate(`/experiments/${e.id}/${e.status === 'done' ? 'results' : 'train'}`); }}>
                  <td className="px-4 py-2.5"><div className="font-medium text-fg">{e.name}</div><div className="font-mono text-[10px] text-muted">{e.id}</div></td>
                  <td className="px-4 py-2.5 text-fg-2">{e.datasetName}</td>
                  <td className="px-4 py-2.5"><div className="flex flex-wrap gap-1">{e.models.slice(0, 4).map((m) => <span key={m.modelId} className="h-2 w-2 rounded-full" title={m.label} style={{ background: m.family === 'classical' ? 'var(--blue)' : m.family === 'hybrid' ? 'var(--teal)' : 'var(--purple)' }} />)}<span className="text-[10px] text-muted">{e.models.length}</span></div></td>
                  <td className="tnum px-4 py-2.5 text-xs text-fg-2">{e.bestByFamily.classical ? `${e.bestByFamily.classical.value.toFixed(3)}` : '—'} / <span className="text-quantum">{e.bestByFamily.quantum?.value.toFixed(3) ?? '—'}</span> <span className="text-muted">{e.bestByFamily.classical?.metric}</span></td>
                  <td className="px-4 py-2.5"><StatusChip status={e.status} /></td>
                  <td className="px-4 py-2.5 text-xs text-muted">{dateTime(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_280px]">
        <Card className="p-4"><PipelineFlow compact /></Card>
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-fg">Quick actions</h3>
          <div className="grid gap-2">
            <Button variant="outline" icon={<Upload size={14} />} onClick={() => navigate('/data')}>Upload data</Button>
            <Button variant="outline" icon={<FlaskConical size={14} />} onClick={() => navigate('/models')}>New experiment</Button>
            <Button variant="outline" icon={<Stethoscope size={14} />} onClick={() => navigate('/predict')}>Predict</Button>
            <Button variant="outline" icon={<Terminal size={14} />} onClick={() => navigate('/api')}>Open API console</Button>
            <Button variant="quantum" icon={<Play size={14} />} onClick={() => { navigate('/'); startDemo(); }}>Start demo</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
