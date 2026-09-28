import { motion } from 'framer-motion';
import { ArrowRight, Check, Database, Dna, Fingerprint, HeartPulse, Microscope, Ruler, ScanLine, ShieldAlert, Stethoscope } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDatasets, useProfile } from '@/api/hooks';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Segmented, Select, Tabs, cn } from '@/components/common/ui';
import { ErrorState, Skeleton } from '@/components/common/misc';
import { UploadZone } from '@/features/data/UploadZone';
import { MissingView, PreviewTable, SchemaTable } from '@/features/data/ProfileBasics';
import { BalanceView, CorrelationView, DimensionalityView, DistributionView, NoiseView, QualityView } from '@/features/data/ProfileCharts';
import { usePipeline } from '@/store';
import type { Dataset } from '@/types/api';

type Tab = 'preview' | 'schema' | 'missing' | 'noise' | 'dist' | 'corr' | 'balance' | 'dim' | 'quality';
const DISEASE_ICON = { cancer: Microscope, cardiovascular: HeartPulse, neurological: Stethoscope, diabetes: Database, kidney: Database };
const MODALITY_ICON = { tabular_ehr: Stethoscope, genomics: Dna, imaging_features: ScanLine };

function BenchmarkCard({ d, active, onUse }: { d: Dataset; active: boolean; onUse: () => void }) {
  const Icon = DISEASE_ICON[d.disease];
  const MI = MODALITY_ICON[d.modality];
  return (
    <motion.div whileHover={{ y: -2 }} className={cn('card flex flex-col p-3.5 transition', active && 'ring-2 ring-classical')}>
      <div className="flex items-start gap-2">
        <div className="rounded-lg bg-tint-blue p-2 text-classical"><Icon size={16} /></div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-fg">{d.shortName}</div>
          <div className="flex items-center gap-1 text-[10px] capitalize text-muted"><MI size={10} /> {d.modality.replace('_', ' ')} · {d.disease}</div>
        </div>
        {d.taskType === 'regression' && <Badge color="var(--teal)">regression</Badge>}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px]">
        <div className="rounded bg-surface-2 py-1"><div className="tnum text-xs font-semibold text-fg">{d.rows.toLocaleString()}</div>rows</div>
        <div className="rounded bg-surface-2 py-1"><div className="tnum text-xs font-semibold text-fg">{d.features.toLocaleString()}</div>features</div>
        <div className="rounded bg-surface-2 py-1"><div className="tnum text-xs font-semibold text-fg">{d.classBalance ? `${d.classBalance.positive}/${d.classBalance.negative}` : d.targetRange?.join('–')}</div>{d.classBalance ? 'pos/neg' : 'target'}</div>
      </div>
      <Button size="sm" variant={active ? 'success' : 'outline'} className="mt-3" onClick={onUse} icon={active ? <Check size={13} /> : undefined}>{active ? 'In use' : 'Use'}</Button>
    </motion.div>
  );
}

export default function Data() {
  const navigate = useNavigate();
  const { data: datasets } = useDatasets();
  const pipe = usePipeline();
  const ds = datasets?.find((d) => d.id === pipe.activeDatasetId);
  const profile = useProfile(ds && (ds.features > 0 || ds.benchmark) ? ds.id : undefined);
  const [tab, setTab] = useState<Tab>('preview');
  const [unitCol, setUnitCol] = useState('');

  const p = profile.data;
  const idCol = ds?.benchmark ? { wdbc: 'patient_id', heart: 'record_id', pima: 'patient_no', parkinsons: 'recording', ckd: 'patient_id', leukemia: 'sample_id', telemonitoring: 'subject_visit' }[ds.id] : ds?.columns.find((c) => c.type === 'id')?.name;

  return (
    <div>
      <PageHeader title="Data ingestion & profiling" trace="data" description="Upload EHR, genomics or imaging data — or start from a benchmark — and profile quality before any model sees it." actions={
        <Button onClick={() => { pipe.complete('data'); navigate('/preprocess'); }} icon={<ArrowRight size={15} />} disabled={!p}>Continue to pre-processing</Button>
      } />

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="space-y-5">
          <UploadZone />
          {ds && (
            <Card data-tour="data-config">
              <CardHeader title="Configuration" subtitle={ds.name} icon={<Database size={16} />} />
              <div className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-muted">Task</span>
                  <Segmented size="sm" value={pipe.taskType} onChange={(t) => pipe.setTarget(pipe.targetColumn, pipe.positiveClass, t)} options={[{ value: 'classification', label: 'Classification' }, { value: 'regression', label: 'Regression' }]} />
                  <span className="text-[10px] text-muted">auto-suggested: {ds.taskType}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Target column" value={ds.target} onChange={() => undefined} options={[{ value: ds.target, label: ds.target }]} />
                  {ds.taskType === 'classification' ? (
                    <Select label="Positive class" value={ds.positiveClass ?? ''} onChange={(v) => pipe.setTarget(ds.target, v)} options={[{ value: ds.positiveClass ?? '', label: `${ds.positiveClass} · ${ds.classBalance?.positiveLabel}` }]} />
                  ) : <div className="text-xs text-muted">Target range<br /><span className="font-mono text-fg">{ds.targetRange?.join(' – ')}</span></div>}
                </div>
                {idCol && <div className="flex items-center gap-2 rounded-lg bg-tint-blue px-3 py-2 text-xs text-fg-2"><Fingerprint size={14} className="text-classical" /> ID column detected: <b className="font-mono">{idCol}</b> — auto-excluded from features</div>}
                {p && p.phiColumns.length > 0 && <div className="flex items-center gap-2 rounded-lg bg-tint-red px-3 py-2 text-xs text-danger"><ShieldAlert size={14} /> PHI-like columns: {p.phiColumns.join(', ')}</div>}
                <div>
                  <div className="mb-1 flex items-center gap-1 text-xs font-medium text-muted"><Ruler size={12} /> Units editor (used by the Predict form)</div>
                  <div className="flex gap-2">
                    <Select className="flex-1" value={unitCol || ds.columns[0]?.name} onChange={setUnitCol} options={ds.columns.slice(0, 40).map((c) => ({ value: c.name, label: c.name }))} />
                    <input className="h-9 w-28 rounded-lg border border-line bg-surface px-2 text-sm" placeholder="unit" aria-label="Unit"
                      value={pipe.units[unitCol || ds.columns[0]?.name] ?? ds.columns.find((c) => c.name === (unitCol || ds.columns[0]?.name))?.unit ?? ''}
                      onChange={(e) => pipe.setUnit(unitCol || ds.columns[0]?.name, e.target.value)} />
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-fg">Benchmark datasets</h3>
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4" data-tour="data-benchmarks">
              {datasets?.filter((d) => d.benchmark).map((d) => <BenchmarkCard key={d.id} d={d} active={d.id === pipe.activeDatasetId} onUse={() => pipe.setDataset(d.id, d.taskType, d.target, d.positiveClass)} />)
                ?? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-40" />)}
            </div>
          </div>

          <Card data-tour="data-profile">
            <div className="px-4 pt-3">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-fg">Profile · {ds?.shortName}</h3>
                {ds?.id === 'wdbc' && <span className="text-[10px] text-muted">Demo copy: ~0.8% synthetic missingness injected to exercise the D1 pipeline.</span>}
              </div>
              <Tabs value={tab} onChange={setTab} tabs={[
                { value: 'preview', label: 'Preview' }, { value: 'schema', label: 'Schema' }, { value: 'missing', label: 'Missing data' }, { value: 'noise', label: 'Noise & outliers' },
                { value: 'dist', label: 'Distributions' }, { value: 'corr', label: 'Correlations' }, { value: 'balance', label: 'Class balance' }, { value: 'dim', label: 'Dimensionality' }, { value: 'quality', label: 'Quality score' },
              ]} />
            </div>
            <div className="p-4">
              {profile.isLoading && <Skeleton className="h-80" />}
              {profile.isError && <ErrorState error={profile.error} onRetry={() => profile.refetch()} />}
              {ds && !ds.benchmark && ds.features === 0 && <div className="py-10 text-center text-sm text-muted">Run “Extract features” on the uploaded image archive to profile it.</div>}
              {p && ds && (
                <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                  {tab === 'preview' && <PreviewTable p={p} />}
                  {tab === 'schema' && <SchemaTable p={p} />}
                  {tab === 'missing' && <MissingView p={p} />}
                  {tab === 'noise' && <NoiseView p={p} />}
                  {tab === 'dist' && <DistributionView p={p} ds={ds} />}
                  {tab === 'corr' && <CorrelationView p={p} />}
                  {tab === 'balance' && <BalanceView p={p} ds={ds} />}
                  {tab === 'dim' && <DimensionalityView p={p} ds={ds} />}
                  {tab === 'quality' && <QualityView p={p} />}
                </motion.div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
