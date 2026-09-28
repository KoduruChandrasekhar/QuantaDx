import { motion } from 'framer-motion';
import { BarChart3, CheckCircle2, Lightbulb, Rocket, RotateCw, Wifi, WifiOff, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { useCancelExperiment, useDeploy, useExperiment } from '@/api/hooks';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Progress, Tabs } from '@/components/common/ui';
import { ErrorState, FamilyBadge, LiveDot, PageSkeleton } from '@/components/common/misc';
import { Burst } from '@/components/fx/Effects';
import { HybridArchitecture } from '@/components/quantum/HybridArchitecture';
import { StatusChip } from '@/features/common/StatusChip';
import { TrainCharts } from '@/features/train/TrainCharts';
import { QuantumPanel } from '@/features/train/QuantumPanel';
import { LogConsole } from '@/features/train/LogConsole';
import { useExperimentStream } from '@/hooks/useExperimentStream';
import { countdown } from '@/lib/format';
import { usePipeline } from '@/store';

export default function Train() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const exp = useExperiment(id, true);
  const stream = useExperimentStream(id, exp.data?.status === 'done');
  const cancel = useCancelExperiment();
  const deploy = useDeploy();
  const setActive = usePipeline((s) => s.setActiveExperiment);
  const complete = usePipeline((s) => s.complete);
  const [tab, setTab] = useState<string>('all');
  const [burst, setBurst] = useState(0);
  const wasRunning = useRef(false);

  useEffect(() => { if (id) setActive(id); }, [id, setActive]);

  const replay = async () => {
    if (!id) return;
    stream.reset();
    wasRunning.current = true;
    await api.replay(id, 3);
    toast('Replaying training at 3× speed');
  };
  useEffect(() => {
    if (params.get('replay') === '1' && exp.data) {
      replay();
      const n = new URLSearchParams(params);
      n.delete('replay');
      setParams(n, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exp.data?.id]);

  const running = exp.data?.status === 'running' || exp.data?.status === 'queued';
  if (running) wasRunning.current = true;
  useEffect(() => {
    if (stream.done && wasRunning.current) {
      wasRunning.current = false;
      setBurst((b) => b + 1);
      complete('train');
      qc.invalidateQueries({ queryKey: ['experiment', id] });
      qc.invalidateQueries({ queryKey: ['experiments'] });
      qc.invalidateQueries({ queryKey: ['results', id] });
      toast.success('Training complete', { description: exp.data?.name, action: { label: 'View results', onClick: () => navigate(`/experiments/${id}/results`) } });
    }
  }, [stream.done]); // eslint-disable-line react-hooks/exhaustive-deps

  const quantumModels = useMemo(() => exp.data?.models.filter((m) => m.family !== 'classical') ?? [], [exp.data]);
  const [qModel, setQModel] = useState<string>('');
  const activeQ = qModel || quantumModels.find((m) => m.kind !== 'qsvm')?.modelId || quantumModels[0]?.modelId;

  if (exp.isLoading) return <PageSkeleton />;
  if (exp.isError || !exp.data) return <ErrorState error={exp.error} onRetry={() => exp.refetch()} />;
  const e = exp.data;
  const isDone = e.status === 'done' && !running;
  const liveModels = e.models.map((m) => {
    const st = stream.status[m.modelId];
    const last = stream.progress[m.modelId]?.[stream.progress[m.modelId].length - 1];
    const status = st?.status ?? m.status;
    return { ...m, status, progress: status === 'done' ? 1 : last ? (last.iteration ?? 0) / (last.maxIter ?? 1) : m.progress, etaSec: last?.etaSec ?? m.etaSec, queuePosition: st?.queuePosition };
  });

  return (
    <div>
      <Burst fire={burst} />
      <PageHeader title="Training monitor" trace="train" description={<span>{e.name} · <span className="font-mono">{e.id}</span> · {e.datasetName} · {e.backend}</span>} actions={
        <>
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium" title="Training-event stream status">
            {stream.conn === 'open' ? <><Wifi size={13} className="text-ok" /> stream open</> : stream.conn === 'polling' ? <><WifiOff size={13} className="text-saffron" /> polling fallback</> : <><WifiOff size={13} className="text-muted" /> {stream.conn}</>}
          </span>
          {running ? (
            <Button variant="danger" size="sm" icon={<X size={14} />} onClick={() => cancel.mutate(e.id, { onSuccess: () => toast.info('Experiment cancelled') })}>Cancel</Button>
          ) : (
            <Button variant="outline" size="sm" icon={<RotateCw size={14} />} onClick={replay}>Replay 3×</Button>
          )}
          <Button size="sm" icon={<BarChart3 size={14} />} disabled={!isDone} onClick={() => navigate(`/experiments/${e.id}/results`)}>View results</Button>
        </>
      } />

      {isDone && (stream.done || !wasRunning.current) && (
        <motion.div initial={{ opacity: 0, y: -10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="gradient-border card mb-5 flex flex-wrap items-center gap-3 rounded-2xl p-4">
          <motion.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }}><CheckCircle2 size={28} className="text-ok" /></motion.div>
          <div className="flex-1"><div className="font-semibold text-fg">Training complete</div><div className="text-xs text-muted">All {e.models.length} models finished. Results, explanations and deployment are ready.</div></div>
          <Button size="sm" icon={<BarChart3 size={14} />} onClick={() => navigate(`/experiments/${e.id}/results`)}>View results</Button>
          <Button size="sm" variant="outline" icon={<Lightbulb size={14} />} onClick={() => navigate(`/experiments/${e.id}/explain`)}>Explain</Button>
          <Button size="sm" variant="success" icon={<Rocket size={14} />} onClick={async () => {
            const r = await api.results(e.id);
            const best = [...r.models].sort((a, b) => (b.metrics?.rocAuc.mean ?? -(b.regression?.rmse.mean ?? 0)) - (a.metrics?.rocAuc.mean ?? -(a.regression?.rmse.mean ?? 0)))[0];
            deploy.mutate(`${e.id}:${best.modelId}`, {
              onSuccess: (d) => toast.success(`Deployed ${d.label}`, { description: 'Now serving POST /predict', action: { label: 'Predict →', onClick: () => navigate('/predict') } }),
              onError: (err) => toast.error('Deploy failed', { description: (err as Error).message }),
            });
          }}>Deploy best model</Button>
        </motion.div>
      )}

      <Card className="mb-5">
        <CardHeader title="Job queue" subtitle="Celery tasks · one per model" icon={running ? <LiveDot color="var(--blue)" /> : undefined} />
        <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-3">
          {liveModels.map((m) => (
            <motion.div layout key={m.modelId} className="rounded-xl border border-line bg-surface-2 p-3">
              <div className="flex items-center gap-2">
                <FamilyBadge family={m.family} />
                <span className="truncate text-sm font-medium text-fg">{m.label}</span>
                <span className="ml-auto"><StatusChip status={m.status} /></span>
              </div>
              <Progress className="mt-2.5" value={m.progress} striped={m.status === 'running'} color={m.family === 'classical' ? 'var(--blue)' : m.family === 'hybrid' ? 'var(--teal)' : 'var(--purple)'} />
              <div className="mt-1.5 flex justify-between text-[11px] text-muted">
                <span>{m.queuePosition ? <b className="text-saffron">Queued on {e.config.quantum.execution.deviceName ?? 'ibm_brisbane'}, position {m.queuePosition}</b> : `${Math.round(m.progress * 100)}%`}</span>
                <span className="tnum">{m.status === 'running' ? `ETA ${countdown(m.etaSec ?? 0)}` : m.status === 'done' ? 'finished' : ''}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>

      <Tabs value={tab} onChange={setTab} className="mb-4" tabs={[{ value: 'all', label: 'Compare all' }, ...e.models.map((m) => ({ value: m.modelId, label: m.label }))]} />
      <TrainCharts models={e.models} progress={stream.progress} selected={tab} />

      {quantumModels.length > 0 && activeQ && (
        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-xl font-semibold text-heading">Quantum panel</h2>
            {quantumModels.map((m) => (
              <button key={m.modelId} onClick={() => setQModel(m.modelId)} className={`rounded-full border px-3 py-1 text-xs font-medium ${activeQ === m.modelId ? 'border-quantum bg-tint-purple text-quantum' : 'border-line text-fg-2'}`}>{m.label}</button>
            ))}
            <Badge color="var(--purple)" className="ml-auto">{e.config.quantum.optimizer.toUpperCase()} · {e.config.quantum.gradient.replace('_', '-')}</Badge>
          </div>
          <Card className="mb-4 p-3">
            <HybridArchitecture kind={e.config.models.find((m) => m.modelId === activeQ)?.kind ?? 'vqc'} nQubits={e.config.nQubits} training={running} />
          </Card>
          <QuantumPanel exp={e} modelId={activeQ} events={stream.progress[activeQ] ?? []} />
        </div>
      )}

      <div className="mt-6"><LogConsole logs={stream.logs} /></div>
    </div>
  );
}
