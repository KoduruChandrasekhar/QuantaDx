import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ArrowRight, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/api/endpoints';
import { usePreprocessPreview } from '@/api/hooks';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/common/ui';
import { ErrorState, Skeleton } from '@/components/common/misc';
import { PREPROCESS_PRESETS } from '@/content/preprocess';
import { StepCard } from '@/features/preprocess/StepCard';
import { QubitBudget } from '@/features/preprocess/QubitBudget';
import { BeforeAfter, FeatureEngineering, PipelineSummary, SplitConfig } from '@/features/preprocess/PreviewPanels';
import { useDebounced } from '@/hooks';
import { usePipeline } from '@/store';

export default function Preprocess() {
  const navigate = useNavigate();
  const datasetId = usePipeline((s) => s.activeDatasetId);
  const config = usePipeline((s) => s.preprocessConfig);
  const setConfig = usePipeline((s) => s.setPreprocess);
  const setProcessed = usePipeline((s) => s.setProcessed);
  const processed = usePipeline((s) => s.processedDatasetId);
  const debounced = useDebounced(config, 300);
  const preview = usePreprocessPreview(datasetId, debounced);
  const [budget, setBudget] = useState(config.targetQubits ?? 8);
  const [applying, setApplying] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = config.steps.findIndex((s) => s.id === e.active.id);
    const to = config.steps.findIndex((s) => s.id === e.over!.id);
    setConfig({ ...config, steps: arrayMove(config.steps, from, to) });
  };
  const apply = async () => {
    setApplying(true);
    try {
      const r = await api.preprocess(datasetId, config);
      setProcessed(r.processedDatasetId);
      toast.success('Pre-processing applied', { description: `${r.nFeatures} features → ${r.qubitsNeeded} qubits · split ${r.split.train}/${r.split.val}/${r.split.test}`, action: { label: 'Architecture →', onClick: () => navigate('/architecture') } });
    } catch (e) {
      toast.error('Pre-processing failed', { description: (e as Error).message });
    } finally {
      setApplying(false);
    }
  };
  const fsStep = config.steps.find((s) => s.kind === 'feature_select');
  const p = preview.data;

  return (
    <div>
      <PageHeader title="Pre-processing & feature engineering" trace="preprocess" description="Drag steps to reorder. Every statistic is fitted on the training split only; the preview re-runs live as you edit." actions={
        <>
          {processed && <Button variant="outline" onClick={() => navigate('/architecture')} icon={<ArrowRight size={15} />}>Continue to Architecture</Button>}
          <Button onClick={apply} disabled={applying} icon={applying ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}>Apply pre-processing</Button>
        </>
      } />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs font-medium text-muted"><Sparkles size={13} /> Presets</span>
        {PREPROCESS_PRESETS.map((pr) => (
          <button key={pr.id} onClick={() => { const c = pr.build(); setConfig(c); setBudget(c.targetQubits ?? 8); toast(`Preset: ${pr.label}`, { description: pr.description }); }}
            className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-fg-2 transition hover:border-classical hover:text-classical">
            {pr.label} <span className="text-muted">· {pr.description}</span>
          </button>
        ))}
        {preview.isFetching && <span className="ml-auto flex items-center gap-1 text-xs text-muted"><Loader2 size={12} className="animate-spin" /> recomputing preview…</span>}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-2.5" data-tour="pp-builder">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={config.steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {config.steps.map((s, i) => (
                <StepCard key={s.id} step={s} index={i} onChange={(ns) => setConfig({ ...config, steps: config.steps.map((x) => (x.id === ns.id ? ns : x)) })} />
              ))}
            </SortableContext>
          </DndContext>
          {p && <FeatureEngineering p={p} k={fsStep?.enabled ? Number(fsStep.params.k ?? 12) : p.featureScores.length} />}
        </div>
        <div className="space-y-5">
          {preview.isError && <ErrorState error={preview.error} onRetry={() => preview.refetch()} />}
          {p ? (
            <>
              <QubitBudget features={p.finalFeatures} encoding={config.encoding} onEncoding={(e) => setConfig({ ...config, encoding: e })} budget={budget} onBudget={(b) => { setBudget(b); setConfig({ ...config, targetQubits: b }); }} />
              <SplitConfig split={config.split} onChange={(s) => setConfig({ ...config, split: s })} counts={p.splitCounts} />
              <BeforeAfter p={p} />
              <PipelineSummary p={p} config={config} />
            </>
          ) : !preview.isError && <><Skeleton className="h-72" /><Skeleton className="h-48" /><Skeleton className="h-96" /></>}
        </div>
      </div>
    </div>
  );
}
