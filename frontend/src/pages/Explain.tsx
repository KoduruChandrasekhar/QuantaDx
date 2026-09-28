import { motion } from 'framer-motion';
import { Microscope, Stethoscope, UserRound, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useExperiment, useExplain, useKernel, useLandscape, useLocalExplain, useResults } from '@/api/hooks';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Card, CardHeader, Segmented, Select, Slider, cn } from '@/components/common/ui';
import { ErrorState, FamilyBadge, PageSkeleton, RiskBadge, Skeleton } from '@/components/common/misc';
import { RiskGauge } from '@/components/common/RiskGauge';
import { BlochGrid } from '@/components/quantum/Bloch';
import { CircuitViewer } from '@/components/quantum/CircuitViewer';
import { KernelHeatmap, Colorbar } from '@/components/quantum/Kernel';
import { LossLandscape } from '@/components/quantum/Lazy3D';
import { Defer } from '@/components/fx/Effects';
import { Beeswarm, ShapBars, SlopeChart, Waterfall } from '@/features/explain/ExplainCharts';
import { bestOf } from '@/features/results/O3Scorecard';
import { buildCircuit } from '@/lib/quantum/circuits';
import { simulate } from '@/lib/quantum/simulator';
import { assignBand } from '@/lib/risk';
import { prettyName } from '@/lib/format';
import { usePipeline } from '@/store';

type Filter = 'all' | 'correct' | 'incorrect' | 'fn';

export default function Explain() {
  const { id } = useParams();
  const exp = useExperiment(id);
  const res = useResults(exp.data?.status === 'done' ? id : undefined);
  const bands = usePipeline((s) => s.riskBands);
  const setActive = usePipeline((s) => s.setActiveExperiment);
  useEffect(() => { if (id) setActive(id); }, [id, setActive]);
  const r = res.data;
  const cls = r?.taskType === 'classification';
  const best = r && cls ? bestOf(r) : null;
  const [modelId, setModelId] = useState<string>('');
  const [view, setView] = useState<'clinician' | 'technical'>('technical');
  const [filter, setFilter] = useState<Filter>('fn');
  const [threshold, setThreshold] = useState(0.5);
  const [sample, setSample] = useState<number | undefined>(undefined);
  const [sorted, setSorted] = useState(true);
  const mId = modelId || best?.q?.modelId || r?.models[0]?.modelId || '';
  const model = r?.models.find((m) => m.modelId === mId);
  const g = useExplain(id, mId);
  const gc = useExplain(id, best?.c?.modelId);
  const quantum = model && model.family !== 'classical';
  const kernel = useKernel(id, model?.kind === 'qsvm' ? mId : undefined, 0.2);
  const landscape = useLandscape(id, quantum && model?.kind !== 'qsvm' ? mId : undefined);

  const candidates = useMemo(() => {
    if (!r || !model?.scores || !r.labels) return [];
    return r.labels.map((y, i) => ({ i, y, p: model.scores![i] })).filter(({ y, p }) => {
      const pred = p >= threshold ? 1 : 0;
      return filter === 'all' || (filter === 'correct' ? pred === y : filter === 'incorrect' ? pred !== y : y === 1 && pred === 0);
    });
  }, [r, model, filter, threshold]);
  useEffect(() => { setSample(candidates[0]?.i); }, [candidates]);
  const local = useLocalExplain(id, mId, sample, threshold);

  const encoded = local.data?.encodedX;
  const bloch = useMemo(() => {
    if (!encoded) return [];
    const spec = buildCircuit({ nQubits: encoded.length, encoding: 'zz_feature_map', encodingReps: 2, bandwidth: 0.2, x: encoded, ansatz: null, measure: false, qasm: false });
    return simulate(encoded.length, spec.ops).bloch;
  }, [encoded]);
  const circ = useMemo(() => buildCircuit({ nQubits: 6, encoding: 'zz_feature_map', encodingReps: 1, ansatz: model?.kind === 'qsvm' ? null : 'real_amplitudes', layers: 1 }), [model?.kind]);

  if (exp.isLoading || res.isLoading) return <PageSkeleton />;
  if (exp.isError || res.isError || !r || !model) return <ErrorState error={exp.error ?? res.error ?? new Error('Results not available — is the experiment finished?')} onRetry={() => res.refetch()} />;
  if (!cls) return <ErrorState title="Explainability for regression" error={new Error('This view focuses on classification experiments. Open the PoC experiment (exp-poc-001) to explore SHAP, kernels and local explanations.')} />;

  const l = local.data;
  const band = l ? assignBand(l.probability, bands) : null;
  const clinicianSentences = l?.contributions.filter((c) => c.feature !== 'other features').slice(0, 5) ?? [];

  return (
    <div>
      <PageHeader title="Explainability" trace="explain" description="Why did the model decide what it decided? Global importance, quantum-specific diagnostics and per-patient explanations — for engineers and for clinicians." actions={
        <>
          <Select value={mId} onChange={setModelId} options={r.models.map((m) => ({ value: m.modelId, label: m.label }))} />
          <Segmented value={view} onChange={setView} options={[{ value: 'clinician', label: 'Clinician', icon: <Stethoscope size={13} /> }, { value: 'technical', label: 'Technical', icon: <Microscope size={13} /> }]} />
        </>
      } />

      <div className="grid gap-5 xl:grid-cols-2">
        <Card data-tour="explain-pca">
          <CardHeader title="PCA-aware attribution" subtitle="Importance of each qubit's principal component, mapped back to clinical features via PCA loadings" actions={<FamilyBadge family={model.family} />} />
          {g.data ? (
            <div className="grid gap-5 p-4 md:grid-cols-[0.8fr_1.2fr]">
              <div><div className="mb-2 text-xs font-semibold text-muted">Component level (PC ↔ qubit)</div><ShapBars items={g.data.components} color="var(--purple)" pretty={false} /></div>
              <div><div className="mb-2 text-xs font-semibold text-muted">Original clinical features</div><ShapBars items={g.data.original} color="var(--teal)" max={10} /></div>
              <p className="text-[11px] text-muted md:col-span-2">{g.data.note}</p>
            </div>
          ) : <Skeleton className="m-4 h-64" />}
        </Card>
        <Card data-tour="explain-global">
          <CardHeader title="SHAP beeswarm" subtitle="Each dot is a patient; position = effect on risk; colour = feature value (blue low → red high)" />
          <div className="p-4">{g.data ? <Beeswarm g={g.data} /> : <Skeleton className="h-64" />}</div>
        </Card>
      </div>

      {view === 'technical' && (
        <Defer delay={300} minHeight={400}><div className="mt-5 grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader title="Classical vs quantum reliance" subtitle="Do the models rely on the same features? Orange lines moved ≥ 2 ranks." />
            <div className="p-4">{g.data && gc.data && best?.c ? <SlopeChart a={gc.data.original} b={g.data.original} aLabel={best.c.label} bLabel={model.label} /> : <Skeleton className="h-64" />}</div>
          </Card>
          <Card>
            <CardHeader title="Qubit contribution map" subtitle="Importance per wire, drawn on the circuit (purple bars)" />
            <div className="p-3">{g.data ? <CircuitViewer spec={circ} qubitImportance={g.data.qubitImportance} featureLabels={g.data.components.map((c, i) => `${c.feature} · ${prettyName(g.data!.original[i]?.feature ?? '')}`)} compact maxHeight={300} title="qubit-contributions" /> : <Skeleton className="h-60" />}</div>
          </Card>
          {model.kind === 'qsvm' && (
            <Card data-tour="explain-kernel">
              <CardHeader title="Quantum kernel (bandwidth 0.2)" subtitle={kernel.data ? `kernel-target alignment ${kernel.data.alignment.toFixed(3)}` : 'loading…'} actions={<Segmented size="sm" value={sorted ? 'sorted' : 'raw'} onChange={(v) => setSorted(v === 'sorted')} options={[{ value: 'raw', label: 'Raw order' }, { value: 'sorted', label: 'Sort by class' }]} />} />
              <div className="flex flex-col items-center gap-2 p-4">{kernel.data ? <><KernelHeatmap matrix={kernel.data.matrix} labels={kernel.data.labels} sorted={sorted} size={300} /><Colorbar /></> : <Skeleton className="h-72 w-72" />}</div>
            </Card>
          )}
          {landscape.data && (
            <Card>
              <CardHeader title="Loss landscape" subtitle="Optimizer path over (θ₀, θ₁)" />
              <div className="p-3"><LossLandscape data={landscape.data} height={300} /></div>
            </Card>
          )}
        </div></Defer>
      )}

      <Card className="mt-5" data-tour="explain-local">
        <CardHeader title="Local explanation" subtitle="Pick a patient from the out-of-fold test predictions" icon={<UserRound size={16} />} actions={
          <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'correct', label: 'Correct' }, { value: 'incorrect', label: 'Incorrect' }, { value: 'fn', label: 'False negatives' }]} />
        } />
        <div className="grid gap-5 p-4 lg:grid-cols-[260px_1fr]">
          <div>
            <Slider label="Decision threshold" value={threshold} min={0.05} max={0.95} step={0.01} onChange={setThreshold} format={(v) => v.toFixed(2)} accent="var(--saffron)" />
            <div className="mt-3 text-xs text-muted">{candidates.length} patients match</div>
            <div className="mt-1 max-h-[420px] space-y-1 overflow-y-auto pr-1">
              {candidates.slice(0, 80).map((c) => (
                <button key={c.i} onClick={() => setSample(c.i)} className={cn('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition', sample === c.i ? 'bg-tint-purple text-quantum' : 'hover:bg-surface-2')}>
                  <span className="font-mono">#{c.i}</span>
                  <span className={c.y ? 'text-danger' : 'text-classical'}>{c.y ? 'positive' : 'negative'}</span>
                  <span className="ml-auto tnum">{(c.p * 100).toFixed(1)}%</span>
                </button>
              ))}
              {!candidates.length && <div className="rounded-lg bg-surface-2 p-3 text-xs text-muted">No patients match this filter at t = {threshold.toFixed(2)}.</div>}
            </div>
          </div>
          <>
            {l ? (
              <motion.div key={`${l.sampleIndex}-${view}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-5 xl:grid-cols-[300px_1fr]">
                <div className="flex flex-col items-center gap-2">
                  <RiskGauge value={l.probability} bands={bands} threshold={threshold} size={260} />
                  {band && <RiskBadge band={band} size="lg" />}
                  <div className="flex gap-2 text-xs">
                    <Badge color={l.label ? 'var(--red)' : 'var(--blue)'}>true: {l.label ? 'positive' : 'negative'}</Badge>
                    <Badge color={(l.probability >= threshold ? 1 : 0) === l.label ? 'var(--green)' : 'var(--red)'}>{(l.probability >= threshold ? 1 : 0) === l.label ? 'correct' : l.label ? 'FALSE NEGATIVE · missed' : 'false positive'}</Badge>
                  </div>
                  {bloch.length > 0 && <><div className="mt-2 text-[11px] font-semibold text-muted">Encoded state (ZZ, bw 0.2)</div><BlochGrid vectors={bloch} size={78} /></>}
                </div>
                <div className="space-y-4">
                  {view === 'clinician' ? (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-fg">Why this estimate?</div>
                      {clinicianSentences.map((c, i) => (
                        <motion.div key={c.feature} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg-2">
                          <span className={c.contribution >= 0 ? 'text-danger' : 'text-ok'}>{c.contribution >= 0 ? '▲' : '▼'}</span>{c.text}
                        </motion.div>
                      ))}
                      <p className="rounded-lg border border-line p-3 text-sm text-fg-2"><b>Confidence:</b> the model estimates {(l.probability * 100).toFixed(0)}% risk; similar patients in validation fell in the {band ? band : '—'} band. This is decision support — confirm with imaging and cytology.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-fg-2">{l.summary}</p>
                      <Waterfall l={l} />
                    </>
                  )}
                  {l.counterfactual && l.counterfactual.length > 0 && (
                    <div className="rounded-xl border border-quantum/30 bg-tint-purple p-3">
                      <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-quantum"><Wand2 size={13} /> Counterfactual: smallest changes that would flip this prediction</div>
                      {l.counterfactual.map((c) => <div key={c.feature} className="font-mono text-xs text-fg-2">{c.feature}: {c.from} → <b>{c.to}</b> {c.unit ?? ''}</div>)}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : <Skeleton className="h-80" />}
          </>
        </div>
      </Card>
    </div>
  );
}
