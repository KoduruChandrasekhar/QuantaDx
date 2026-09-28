import { motion } from 'framer-motion';
import { AlertTriangle, Rocket, Stethoscope } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/api/endpoints';
import { useDatasets, useDeployed, useModels, useProfile, useResults } from '@/api/hooks';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Card, Segmented, Select } from '@/components/common/ui';
import { EmptyState, FamilyBadge, Skeleton } from '@/components/common/misc';
import { DecisionSettings, DEFAULT_ACTIONS, RiskBandEditor, presetThreshold, type Mode } from '@/features/predict/DecisionSettings';
import { PatientForm } from '@/features/predict/PatientForm';
import { ResultCard } from '@/features/predict/ResultCard';
import { BatchMode } from '@/features/predict/BatchMode';
import { pct1 } from '@/lib/format';
import type { RiskBand } from '@/lib/risk';
import { usePipeline } from '@/store';
import type { Prediction } from '@/types/api';

export default function Predict() {
  const [params, setParams] = useSearchParams();
  const datasetId = usePipeline((s) => s.activeDatasetId);
  const bands = usePipeline((s) => s.riskBands);
  const setBands = usePipeline((s) => s.setRiskBands);
  const threshold = usePipeline((s) => s.decisionThreshold);
  const setThreshold = usePipeline((s) => s.setThreshold);
  const units = usePipeline((s) => s.units);
  const { data: datasets } = useDatasets();
  const ds = datasets?.find((d) => d.id === datasetId);
  const { data: deployed, isLoading: depLoading } = useDeployed(datasetId);
  const { data: registry } = useModels();
  const profile = useProfile(datasetId);
  const [chosen, setChosen] = useState<string>('');
  const model = registry?.find((m) => m.modelId === chosen) ?? deployed?.[0];
  const results = useResults(model?.experimentId);
  const valModel = results.data?.models.find((m) => `${model?.experimentId}:${m.modelId}` === model?.modelId);
  const [mode, setMode] = useState<Mode>('balanced');
  const [tab, setTab] = useState<'single' | 'batch'>('single');
  const [values, setValues] = useState<Record<string, string>>({});
  const [pred, setPred] = useState<Prediction | null>(null);
  const [inputs, setInputs] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [actions, setActions] = useState<Record<RiskBand, string>>(DEFAULT_ACTIONS);
  const resultRef = useRef<HTMLDivElement>(null);
  const regression = ds?.taskType === 'regression';

  const predict = async (v: Record<string, number>) => {
    setBusy(true);
    try {
      const p = await api.predict({ datasetId, modelId: model?.modelId, features: v, threshold, bands });
      setPred(p);
      setInputs(v);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) {
      toast.error('Prediction failed', { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const fillExample = async (kind: 'healthy' | 'atRisk', autoPredict = false) => {
    const ex = await api.examples(datasetId);
    const target = ex[kind];
    const keys = Object.keys(target);
    // Animate the values filling in, field by field.
    for (let i = 0; i < keys.length; i += 3) {
      setValues((v) => ({ ...v, ...Object.fromEntries(keys.slice(i, i + 3).map((k) => [k, String(target[k])])) }));
      await new Promise((r) => setTimeout(r, 30));
    }
    if (autoPredict) predict(target);
  };

  const demoRan = useRef(false);
  useEffect(() => {
    if (params.get('demo') !== '1' || demoRan.current || !valModel || !results.data?.labels || !profile.data) return;
    demoRan.current = true;
    setMode('screening');
    setThreshold(presetThreshold('screening', valModel.scores!, results.data.labels));
    fillExample('atRisk', true);
    const n = new URLSearchParams(params);
    n.delete('demo');
    setParams(n, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, valModel, results.data, profile.data]);

  const quantum = model ? model.family !== 'classical' : false;
  const modelOptions = useMemo(() => (registry ?? []).filter((m) => m.datasetId === datasetId).map((m) => ({ value: m.modelId, label: `${m.label} · ${m.version} (${m.stage})${m.deployed ? ' · serving' : ''}` })), [registry, datasetId]);

  return (
    <div>
      <PageHeader title="Prediction & decision support" trace="predict" description="Disease probability, early risk stratification and threshold tuning — for single patients and whole cohorts." />
      <div role="note" className="mb-5 flex items-center gap-2 rounded-xl border border-saffron/40 bg-tint-saffron px-4 py-2.5 text-sm text-fg-2">
        <AlertTriangle size={16} className="shrink-0 text-saffron" /><b>Decision-support research prototype.</b> Not a medical diagnosis. Consult a qualified clinician.
      </div>

      {depLoading ? <Skeleton className="h-24" /> : !model ? (
        <EmptyState title="No model deployed for this dataset" description="Deploy a model from the Experiment Registry or the Training Monitor." />
      ) : (
        <Card className="gradient-border mb-5 flex flex-wrap items-center gap-4 rounded-2xl p-4" data-tour="predict-model">
          <motion.div initial={{ rotate: -20, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} className="rounded-xl bg-tint-green p-3 text-ok"><Rocket size={22} /></motion.div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-fg">{model.label}</span><FamilyBadge family={model.family} /><Badge color="var(--green)">{model.version} · {model.stage}</Badge></div>
            <div className="text-xs text-muted">{model.backend} · MLflow registry · experiment <span className="font-mono">{model.experimentId}</span></div>
          </div>
          <div className="flex gap-4 text-center">
            {model.metrics.rmse !== undefined ? <div><div className="text-[10px] text-muted">RMSE</div><div className="tnum font-bold">{model.metrics.rmse.toFixed(2)}</div></div> : (
              [['Sensitivity', model.metrics.sensitivity], ['Specificity', model.metrics.specificity], ['AUC', model.metrics.rocAuc]].map(([k, v]) => <div key={k as string}><div className="text-[10px] text-muted">{k as string}</div><div className="tnum font-bold text-fg">{v === undefined ? '—' : k === 'AUC' ? (v as number).toFixed(3) : pct1(v as number)}</div></div>)
            )}
          </div>
          <Select className="ml-auto w-72" label="Change model" value={model.modelId} onChange={setChosen} options={modelOptions} />
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        {!regression ? (
          <div className="space-y-5">
            <DecisionSettings model={valModel} labels={results.data?.labels} threshold={threshold} onThreshold={setThreshold} mode={mode} onMode={setMode} />
            <RiskBandEditor bands={bands} onBands={setBands} scores={valModel?.scores} labels={results.data?.labels} actions={actions} onActions={setActions} />
          </div>
        ) : (
          <Card className="p-4 text-sm text-fg-2"><Stethoscope size={18} className="mb-2 text-hybrid" />Regression mode: the model predicts a total UPDRS severity score with a conformal interval, plotted against clinical reference ranges (mild &lt; 18, severe &gt; 39).</Card>
        )}
        <div className="space-y-5">
          <Segmented value={tab} onChange={setTab} options={[{ value: 'single', label: 'Single patient' }, { value: 'batch', label: 'Batch / cohort' }]} />
          {tab === 'single' ? (
            <>
              {profile.data ? <PatientForm profile={profile.data} values={values} onChange={setValues} onPredict={predict} onExample={(k) => fillExample(k)} busy={busy} units={units} /> : <Skeleton className="h-96" />}
              <div ref={resultRef} className="scroll-mt-24">{pred && <ResultCard p={pred} bands={bands} actions={actions} inputs={inputs} quantum={quantum} />}</div>
            </>
          ) : <BatchMode datasetId={datasetId} modelId={model?.modelId} threshold={threshold} bands={bands} actions={actions} />}
        </div>
      </div>
    </div>
  );
}
