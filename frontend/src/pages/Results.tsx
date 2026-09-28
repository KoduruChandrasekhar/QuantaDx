import { motion } from 'framer-motion';
import { Braces, Lightbulb, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDatasets, useExperiment, useResults } from '@/api/hooks';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Drawer, SectionTitle, cn } from '@/components/common/ui';
import { CopyButton, EmptyState, ErrorState, PageSkeleton } from '@/components/common/misc';
import { ChartCard } from '@/components/charts/ChartCard';
import { ConfusionMatrix, ModelLegend, PrChart, RadarCompare, RocChart } from '@/components/charts/charts';
import { Defer, Reveal } from '@/components/fx/Effects';
import { Leaderboard } from '@/features/results/Leaderboard';
import { O3Scorecard, bestOf } from '@/features/results/O3Scorecard';
import { ThresholdExplorer } from '@/features/results/ThresholdExplorer';
import { Generalization, SignificanceTable } from '@/features/results/Generalization';
import { BandwidthSweep, Calibration, Efficiency, NoiseRobustness } from '@/features/results/Efficiency';
import { Findings } from '@/features/results/Findings';
import { RegressionView } from '@/features/results/RegressionView';
import { stylesFor } from '@/content/models';
import { dateTime } from '@/lib/format';
import { usePipeline, useSelection } from '@/store';

const SECTIONS = [
  ['leaderboard', 'Leaderboard'], ['o3', 'O3 scorecard'], ['curves', 'Curves'], ['cm', 'Confusion'], ['threshold', 'Threshold'], ['significance', 'Significance'],
  ['generalization', 'Generalization'], ['efficiency', 'Efficiency'], ['noise', 'Noise & bandwidth'], ['calibration', 'Calibration'], ['findings', 'Findings'],
] as const;

function SectionNav() {
  const [active, setActive] = useState('leaderboard');
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id.replace('sec-', ''))), { rootMargin: '-30% 0px -60% 0px' });
    SECTIONS.forEach(([id]) => { const el = document.getElementById(`sec-${id}`); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  return (
    <div className="sticky top-[70px] z-30 -mx-4 mb-4 overflow-x-auto border-b border-line bg-bg/95 px-4 py-2 lg:-mx-8 lg:px-8">
      <div className="flex gap-1">
        {SECTIONS.map(([id, label]) => (
          <button key={id} onClick={() => document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={cn('relative shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors', active === id ? 'text-white' : 'text-muted hover:text-fg')}>
            {active === id && <motion.span layoutId="res-nav" className="absolute inset-0 rounded-full bg-gradient-to-r from-[#0070C0] to-[#7B3FA0]" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Results() {
  const { id } = useParams();
  const navigate = useNavigate();
  const exp = useExperiment(id);
  const res = useResults(exp.data?.status === 'done' ? id : undefined);
  const { data: datasets } = useDatasets();
  const setActive = usePipeline((s) => s.setActiveExperiment);
  const setThreshold = useSelection((s) => s.setThreshold);
  const [cfgOpen, setCfgOpen] = useState(false);
  useEffect(() => { if (id) setActive(id); setThreshold(0.5); }, [id, setActive, setThreshold]);
  const r = res.data;
  const styles = useMemo(() => (r ? stylesFor(r.models) : {}), [r]);

  if (exp.isLoading || (exp.data?.status === 'done' && res.isLoading)) return <PageSkeleton />;
  if (exp.isError) return <ErrorState error={exp.error} onRetry={() => exp.refetch()} />;
  if (exp.data && exp.data.status !== 'done') return <EmptyState icon={<Loader2 className="animate-spin" size={28} />} title="Experiment still running" description="Results appear when training completes." action={<Button onClick={() => navigate(`/experiments/${id}/train`)}>Open training monitor</Button>} />;
  if (res.isError || !r || !exp.data) return <ErrorState error={res.error} onRetry={() => res.refetch()} />;
  const e = exp.data;
  const ds = datasets?.find((d) => d.id === r.datasetId);
  const cls = r.taskType === 'classification';
  const { c, q } = cls ? bestOf(r) : { c: undefined, q: undefined };
  const prevalence = cls ? r.labels!.filter((l) => l === 1).length / r.labels!.length : 0;
  const radarVals = (m: NonNullable<typeof c>) => ({ Accuracy: m.metrics!.accuracy.mean, Sensitivity: m.metrics!.sensitivity.mean, Specificity: m.metrics!.specificity.mean, Precision: m.metrics!.precision.mean, 'ROC-AUC': m.metrics!.rocAuc.mean, F1: m.metrics!.f1.mean });

  return (
    <div>
      <PageHeader title="Evaluation & benchmark" trace="results" description={<span>{e.name} · {e.datasetName} · {r.taskType} · {r.protocol} · {r.backend} · {dateTime(e.createdAt)}</span>} actions={
        <>
          <Button variant="outline" size="sm" icon={<Braces size={14} />} onClick={() => setCfgOpen(true)}>Config JSON</Button>
          <Button variant="outline" size="sm" icon={<Lightbulb size={14} />} onClick={() => navigate(`/experiments/${e.id}/explain`)}>Explain</Button>
          <Button size="sm" onClick={() => document.getElementById('sec-findings')?.scrollIntoView({ behavior: 'smooth' })}>Export ↓</Button>
        </>
      } />
      <SectionNav />
      <ModelLegend className="mb-4" models={r.models} styles={styles} />

      <div id="sec-leaderboard" className="scroll-mt-32"><Leaderboard r={r} styles={styles} /></div>

      {cls && q && c && (
        <>
          <div id="sec-o3" className="mt-6 scroll-mt-32"><O3Scorecard r={r} /></div>

          <SectionTitle id="sec-curves" sub="Out-of-fold predictions pooled across folds. Hover a model anywhere to highlight it everywhere.">Discrimination</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-3">
            <Defer delay={80} minHeight={380}><ChartCard title="ROC curves" tourId="results-roc" className="lg:col-span-1" info="Sensitivity vs 1 − specificity across all thresholds; dashed diagonal = chance." table={{ columns: ['Model', 'ROC-AUC'], rows: r.models.map((m) => [m.label, m.metrics!.rocAuc.mean]) }}>
              <RocChart models={r.models} styles={styles} />
            </ChartCard></Defer>
            <Defer delay={260} minHeight={380}><ChartCard title="Precision–recall curves" info="More informative than ROC under class imbalance; dashed line = prevalence." table={{ columns: ['Model', 'PR-AUC'], rows: r.models.map((m) => [m.label, m.metrics!.prAuc.mean]) }}>
              <PrChart models={r.models} styles={styles} prevalence={prevalence} />
            </ChartCard></Defer>
            <Defer delay={440} minHeight={380}><ChartCard title={`Radar · ${q.label.replace('QSVM · ', 'QSVM ')} vs ${c.label}`} info="Best quantum (dashed) vs best classical on six metrics.">
              <RadarCompare a={{ label: c.label, color: 'var(--blue)', values: radarVals(c) }} b={{ label: q.label, color: 'var(--purple)', values: radarVals(q) }} />
            </ChartCard></Defer>
          </div>

          <SectionTitle id="sec-cm" sub="At threshold 0.5. FN = missed patients.">Confusion matrices</SectionTitle>
          <Defer delay={620} minHeight={300}><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {r.models.map((m, i) => (
              <Reveal key={m.modelId} delay={i * 0.03}>
                <div className="card p-3"><ConfusionMatrix cm={m.confusion!} label={m.label} color={styles[m.modelId]?.color} compact positive={ds?.positiveClass ?? 'Pos'} negative="Neg" /></div>
              </Reveal>
            ))}
          </div></Defer>

          <div id="sec-threshold" className="mt-8 scroll-mt-32"><Defer delay={800} minHeight={380}><ThresholdExplorer r={r} styles={styles} defaultModel={q.modelId} pos={ds?.positiveClass ?? 'Pos'} /></Defer></div>
          <div id="sec-significance" className="mt-6 scroll-mt-32"><Defer delay={950} minHeight={200}><SignificanceTable r={r} /></Defer></div>
        </>
      )}

      {!cls && (
        <>
          <SectionTitle id="sec-curves" sub="Regression showcase: total UPDRS score.">Predicted vs actual</SectionTitle>
          <RegressionView r={r} styles={styles} />
        </>
      )}

      <SectionTitle id="sec-generalization" sub="Objective O6: does performance hold beyond the training data?">Generalization</SectionTitle>
      <Defer delay={1100} minHeight={600}><Generalization r={r} styles={styles} /></Defer>

      <SectionTitle id="sec-efficiency" sub="Objective O6: computational cost of each approach.">Computational efficiency & scaling</SectionTitle>
      <Defer delay={1300} minHeight={600}><Efficiency r={r} styles={styles} /></Defer>

      <SectionTitle id="sec-noise" sub="NISQ reality check and our key innovation: bandwidth-tuned kernels.">Noise robustness & kernel bandwidth</SectionTitle>
      <Defer delay={1500} minHeight={360}><div className="grid gap-4 lg:grid-cols-2">
        <NoiseRobustness r={r} styles={styles} />
        {r.bandwidthSweep ? <BandwidthSweep r={r} /> : <div className="card flex items-center justify-center p-6 text-sm text-muted">No QSVM bandwidth sweep in this experiment.</div>}
      </div></Defer>

      {cls && (
        <>
          <SectionTitle id="sec-calibration" sub="Are the probabilities trustworthy?">Calibration</SectionTitle>
          <Defer delay={1700} minHeight={320}><Calibration r={r} styles={styles} /></Defer>
        </>
      )}

      <div id="sec-findings" className="mt-8 scroll-mt-32"><Findings r={r} exp={e} /></div>

      <Drawer open={cfgOpen} onClose={() => setCfgOpen(false)} title="Experiment configuration" width={560}>
        <div className="mb-2 flex items-center gap-2"><Badge color="var(--navy)">{e.mlflowRunId}</Badge><CopyButton text={JSON.stringify(e.config, null, 2)} /></div>
        <pre className="overflow-x-auto rounded-lg bg-[#0b1220] p-3 font-mono text-[11px] text-[#c3cfdf]">{JSON.stringify(e.config, null, 2)}</pre>
      </Drawer>
    </div>
  );
}
