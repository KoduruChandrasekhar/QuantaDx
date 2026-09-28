import { AnimatePresence, motion } from 'framer-motion';
import { Download, FileUp, Loader2, Play, Rocket, Sparkles } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useCircuitPreview, useDatasets, useStartExperiment } from '@/api/hooks';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Modal, Segmented, Select, Switch } from '@/components/common/ui';
import { FamilyBadge } from '@/components/common/misc';
import { Defer } from '@/components/fx/Effects';
import { CircuitViewer } from '@/components/quantum/CircuitViewer';
import { ResourceMeters } from '@/components/quantum/StateViews';
import { HybridArchitecture } from '@/components/quantum/HybridArchitecture';
import { KernelPanel } from '@/components/quantum/Kernel';
import { ModelCatalog, type Hypers } from '@/features/models/ModelCatalog';
import { PqcConfig } from '@/features/models/PqcConfig';
import { DEFAULT_PROTOCOL, STUDIO_PRESETS, spec as modelSpec } from '@/content/experiment';
import { modelMeta } from '@/content/models';
import { buildCircuit } from '@/lib/quantum/circuits';
import { download } from '@/lib/export';
import { duration } from '@/lib/format';
import { useDebounced } from '@/hooks';
import { useEncodedSample } from '@/hooks/usePipelineData';
import { usePipeline, useSecrets } from '@/store';
import type { ExperimentConfig, ModelKind, ModelSpec } from '@/types/api';

export default function Models() {
  const navigate = useNavigate();
  const pipe = usePipeline();
  const hasToken = !!useSecrets((s) => s.ibmToken);
  const { data: datasets } = useDatasets();
  const ds = datasets?.find((d) => d.id === pipe.activeDatasetId);
  const { sample, featureLabels, data: pp } = useEncodedSample(false);
  const nQubits = Math.max(2, Math.min(10, pp?.finalFeatures.length ?? 6));
  const [hypers, setHypers] = useState<Hypers>({});
  const [protocol, setProtocol] = useState(DEFAULT_PROTOCOL);
  const [confirm, setConfirm] = useState(false);
  const [previewModel, setPreviewModel] = useState<ModelKind>('vqc');
  const fileRef = useRef<HTMLInputElement>(null);
  const start = useStartExperiment();
  const q = pipe.quantumConfig;
  const selected = pipe.selectedModels as ModelKind[];
  const task = pipe.taskType;
  const quantumSelected = selected.filter((k) => modelMeta(k)?.family !== 'classical');
  const withAnsatz = !(previewModel === 'qsvm' || previewModel === 'qsvr');

  const req = useDebounced({ nQubits, quantum: q, withAnsatz, x: sample?.x[0] }, 300);
  const remote = useCircuitPreview(req);
  const local = useMemo(() => buildCircuit({ nQubits, encoding: q.encoding, encodingReps: q.encodingReps, bandwidth: q.kernelBandwidth, entanglement: q.entanglement, ansatz: withAnsatz ? q.ansatz : null, layers: q.layers, x: sample?.x[0] }), [nQubits, q, withAnsatz, sample]);
  const circuit = remote.data ?? local;

  const models: ModelSpec[] = selected.map((k) => {
    const m = modelSpec(k);
    return { ...m, hyper: { ...m.hyper, ...(hypers[k] ?? {}) } };
  });
  const estSec = models.reduce((s, m) => s + (m.family === 'classical' ? 3 : (circuit.estimatedRuntimeSec ?? 30) * (q.execution.backend === 'hardware' ? 40 : q.execution.backend === 'noisy' ? 3 : 1)), 0) * protocol.folds;

  const applyPreset = (id: string) => {
    const p = STUDIO_PRESETS.find((x) => x.id === id)!;
    pipe.setSelectedModels(p.models.filter((k) => modelMeta(k).task === task));
    pipe.setQuantum(p.quantum);
    setProtocol({ ...DEFAULT_PROTOCOL, ...p.protocol });
    toast.success(`Preset loaded: ${p.label}`, { description: p.description });
  };
  const exportPreset = () => download('quantadx-preset.json', JSON.stringify({ models: selected, quantum: q, protocol, hypers }, null, 2), 'application/json');
  const importPreset = async (f: File) => {
    try {
      const j = JSON.parse(await f.text()) as { models: ModelKind[]; quantum: typeof q; protocol: typeof protocol; hypers?: Hypers };
      pipe.setSelectedModels(j.models);
      pipe.setQuantum(j.quantum);
      setProtocol(j.protocol);
      setHypers(j.hypers ?? {});
      toast.success('Preset imported');
    } catch {
      toast.error('Invalid preset JSON');
    }
  };
  const run = () => {
    const cfg: ExperimentConfig = { name: `${ds?.shortName ?? pipe.activeDatasetId} · ${models.map((m) => modelMeta(m.kind).short).join(' vs ')}`, datasetId: pipe.activeDatasetId, taskType: task, models, quantum: q, protocol, nQubits };
    start.mutate(cfg, {
      onSuccess: ({ experiment_id }) => {
        setConfirm(false);
        pipe.setActiveExperiment(experiment_id);
        pipe.complete('models');
        toast.success('Experiment started', { description: `${experiment_id} · ${models.length} models` });
        navigate(`/experiments/${experiment_id}/train`);
      },
      onError: (e) => toast.error('Could not start experiment', { description: (e as Error).message }),
    });
  };

  return (
    <div>
      <PageHeader title="Model Studio" trace="models" description="Select classical baselines and quantum / hybrid models to train in one experiment — same splits, same seeds, fair comparison." actions={
        <>
          <Button variant="ghost" size="sm" icon={<Download size={14} />} onClick={exportPreset}>Export preset</Button>
          <Button variant="ghost" size="sm" icon={<FileUp size={14} />} onClick={() => fileRef.current?.click()}>Import</Button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && importPreset(e.target.files[0])} />
          <Button variant="quantum" icon={<Rocket size={15} />} disabled={!selected.length} onClick={() => setConfirm(true)} data-tour="models-run">Run experiment</Button>
        </>
      } />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs font-medium text-muted"><Sparkles size={13} /> Presets</span>
        {STUDIO_PRESETS.map((p) => (
          <motion.button whileHover={{ y: -1 }} key={p.id} onClick={() => applyPreset(p.id)} className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-fg-2 hover:border-quantum hover:text-quantum">{p.label}</motion.button>
        ))}
        <Badge color={task === 'regression' ? 'var(--teal)' : 'var(--blue)'} className="ml-auto">{task} · {ds?.shortName}</Badge>
      </div>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_minmax(0,1.05fr)]">
        <ModelCatalog task={task} selected={selected} onChange={(k) => pipe.setSelectedModels(k)} hypers={hypers} onHypers={setHypers} bandwidth={q.kernelBandwidth ?? 0.2} onBandwidth={(b) => pipe.setQuantum({ kernelBandwidth: b })} />
        <div className="space-y-5">
          <PqcConfig q={q} set={pipe.setQuantum} nQubits={nQubits} hasToken={hasToken} />
          <Card>
            <CardHeader title="Evaluation protocol" subtitle="Fair, reproducible, honest" />
            <div className="grid grid-cols-2 gap-3 p-4">
              <div className="col-span-2 flex items-center gap-2"><span className="text-xs text-muted">Stratified k-fold</span><Segmented size="sm" value={String(protocol.folds)} onChange={(v) => setProtocol({ ...protocol, folds: Number(v) })} options={[{ value: '3', label: '3' }, { value: '5', label: '5' }, { value: '10', label: '10' }]} /></div>
              <Select label="Repeats" value={String(protocol.repeats)} onChange={(v) => setProtocol({ ...protocol, repeats: Number(v) })} options={['1', '3', '5'].map((v) => ({ value: v, label: `${v}×` }))} />
              <Select label="Primary metric" value={protocol.primaryMetric} onChange={(v) => setProtocol({ ...protocol, primaryMetric: v })} options={task === 'regression' ? [{ value: 'rmse', label: 'RMSE' }] : [{ value: 'sens@spec≥0.90', label: 'Sensitivity @ specificity ≥ 0.90' }, { value: 'roc_auc', label: 'ROC-AUC' }, { value: 'balanced_accuracy', label: 'Balanced accuracy' }]} />
              <Select label="External validation (O6)" value={protocol.externalDatasetId ?? ''} onChange={(v) => setProtocol({ ...protocol, externalDatasetId: v || undefined })} options={[{ value: '', label: 'None' }, { value: 'site_b', label: 'Held-out site B' }, ...(datasets ?? []).filter((d) => d.id !== pipe.activeDatasetId && d.taskType === task).map((d) => ({ value: d.id, label: d.shortName }))]} />
              <div className="flex flex-col justify-end gap-2">
                <Switch checked={protocol.noiseSweep} onChange={(v) => setProtocol({ ...protocol, noiseSweep: v })} label="Noise-robustness sweep" />
                <Switch checked={protocol.qubitScaling} onChange={(v) => setProtocol({ ...protocol, qubitScaling: v })} label="Qubit-scaling study" />
              </div>
            </div>
          </Card>
        </div>
        <div className="space-y-5">
          <Card data-tour="models-circuit">
            <CardHeader title="Live circuit" subtitle={`POST /circuit/preview · ${nQubits} qubits · rebuilds as you configure`} actions={
              <Segmented size="sm" value={withAnsatz ? 'vqc' : 'qsvm'} onChange={(v) => setPreviewModel(v as ModelKind)} options={[{ value: 'vqc', label: 'Variational' }, { value: 'qsvm', label: 'Kernel' }]} />
            } />
            <div className="p-3">
              <CircuitViewer key={`${q.encoding}-${q.ansatz}-${q.layers}-${q.entanglement}-${q.encodingReps}-${withAnsatz}`} spec={circuit} mode="build" featureLabels={featureLabels.map((f) => f.split(' · ')[0])} maxHeight={420} title="model-studio-circuit" />
              {remote.isFetching && <div className="mt-1 flex items-center gap-1 text-[10px] text-muted"><Loader2 size={10} className="animate-spin" /> syncing with backend…</div>}
            </div>
          </Card>
          <ResourceMeters nQubits={circuit.nQubits} depth={circuit.depth} twoQubit={circuit.twoQubitGateCount} params={circuit.nTrainableParams} runtimeSec={circuit.estimatedRuntimeSec ?? 1} gates={circuit.ops.length} backendQubits={q.execution.backend === 'noisy' && q.execution.noise?.deviceModel === 'fake_manila' ? 5 : 127} />
          <Defer delay={400} minHeight={220}><Card>
            <CardHeader title="Model architecture" subtitle="Click the quantum block to expand" actions={
              <Select value={quantumSelected[0] ?? 'vqc'} onChange={(v) => setPreviewModel(v as ModelKind)} options={(quantumSelected.length ? quantumSelected : (['vqc'] as ModelKind[])).map((k) => ({ value: k, label: modelMeta(k).short }))} />
            } />
            <div className="p-3"><HybridArchitecture kind={previewModel} nQubits={nQubits} circuit={circuit} /></div>
          </Card></Defer>
          {selected.includes('qsvm') && sample && (
            <Defer delay={700} minHeight={300}><Card>
              <CardHeader title="QSVM kernel preview (in-browser)" subtitle={`bandwidth ${(q.kernelBandwidth ?? 1).toFixed(2)} · 24 patients`} />
              <div className="p-4"><KernelPanel xs={sample.x.slice(0, 24)} labels={sample.y.slice(0, 24)} bandwidth={q.kernelBandwidth ?? 1} encoding={q.encoding === 'amplitude' ? 'zz_feature_map' : q.encoding} showComparison={false} size={200} /></div>
            </Card></Defer>
          )}
        </div>
      </div>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Start experiment?" footer={
        <>
          <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="quantum" icon={start.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} onClick={run} disabled={start.isPending}>Start training</Button>
        </>
      }>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-surface-2 p-2"><div className="text-[10px] text-muted">Qubits</div><div className="text-lg font-bold">{nQubits}</div></div>
            <div className="rounded-lg bg-surface-2 p-2"><div className="text-[10px] text-muted">Backend</div><div className="text-sm font-bold capitalize">{q.execution.backend}</div></div>
            <div className="rounded-lg bg-surface-2 p-2"><div className="text-[10px] text-muted">Est. time</div><div className="text-sm font-bold">{duration(estSec)}</div></div>
          </div>
          <ul className="divide-y divide-line rounded-lg border border-line">
            <AnimatePresence>
              {models.map((m, i) => (
                <motion.li key={m.modelId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center gap-2 px-3 py-2">
                  <FamilyBadge family={m.family} /><span className="text-fg">{m.label}</span>
                  <span className="ml-auto font-mono text-[10px] text-muted">{Object.entries(m.hyper).map(([k, v]) => `${k}=${v}`).join(' ')}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <p className="text-xs text-muted">{protocol.folds}-fold stratified CV · primary metric {protocol.primaryMetric} · seed {q.seed}. In mock mode the demo runs in ~10–20 s per quantum model.</p>
        </div>
      </Modal>
    </div>
  );
}
