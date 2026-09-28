import { useQueries } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Download, FileCog, GitCompare, Rocket, RotateCw, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/api/endpoints';
import { useDeploy, useExperiments, useModels, useStartExperiment } from '@/api/hooks';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, Button, Card, CardHeader, Drawer, Select, Tabs, cn } from '@/components/common/ui';
import { CopyButton, FamilyBadge, PageSkeleton } from '@/components/common/misc';
import { ChartCard } from '@/components/charts/ChartCard';
import { RocChart } from '@/components/charts/charts';
import { StatusChip } from '@/features/common/StatusChip';
import { dateShort, deltaPts, duration, pct1 } from '@/lib/format';
import { download } from '@/lib/export';
import { usePipeline } from '@/store';
import type { Experiment } from '@/types/api';

const PAGE = 8;
const COLORS = ['#0070C0', '#7B3FA0', '#0E8C8C', '#E8770E'];

function flatten(o: unknown, prefix = ''): Record<string, string> {
  if (o === null || typeof o !== 'object') return { [prefix]: JSON.stringify(o) };
  if (Array.isArray(o)) return { [prefix]: JSON.stringify(o.map((x) => (typeof x === 'object' && x && 'label' in x ? (x as { label: string }).label : x))) };
  return Object.entries(o as Record<string, unknown>).reduce((acc, [k, v]) => ({ ...acc, ...flatten(v, prefix ? `${prefix}.${k}` : k) }), {} as Record<string, string>);
}

function Compare({ exps, onClose }: { exps: Experiment[]; onClose: () => void }) {
  const qs = useQueries({ queries: exps.map((e) => ({ queryKey: ['results', e.id], queryFn: () => api.results(e.id), staleTime: Infinity })) });
  const res = qs.map((q) => q.data);
  const bestOf = (i: number) => res[i]?.models.filter((m) => m.metrics).sort((a, b) => b.metrics!.rocAuc.mean - a.metrics!.rocAuc.mean)[0];
  const flat = exps.map((e) => flatten({ dataset: e.datasetId, quantum: e.config.quantum, protocol: e.config.protocol, models: e.config.models }));
  const keys = [...new Set(flat.flatMap((f) => Object.keys(f)))].filter((k) => new Set(flat.map((f) => f[k])).size > 1);
  const rocModels = exps.map((e, i) => { const b = bestOf(i); return b ? { ...b, modelId: `${e.id}:${b.modelId}`, label: `${e.id} · ${b.label}` } : null; }).filter(Boolean) as NonNullable<ReturnType<typeof bestOf>>[];
  const styles = Object.fromEntries(rocModels.map((m, i) => [m.modelId, { color: COLORS[i], dash: '0' }]));
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 space-y-4">
      <div className="flex items-center gap-2"><GitCompare size={18} className="text-quantum" /><h2 className="font-serif text-xl font-semibold text-heading">Comparing {exps.length} runs</h2><Button size="sm" variant="ghost" className="ml-auto" icon={<X size={14} />} onClick={onClose}>Close</Button></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Best model per run" subtitle={`Deltas vs ${exps[0].id}`} />
          <table className="w-full text-xs">
            <thead className="bg-surface-2 text-left text-muted"><tr><th className="px-3 py-2">Run</th><th className="px-3 py-2">Best model</th><th className="px-3 py-2">AUC</th><th className="px-3 py-2">Sens</th><th className="px-3 py-2">Spec</th></tr></thead>
            <tbody>
              {exps.map((e, i) => {
                const b = bestOf(i), b0 = bestOf(0);
                const cell = (k: 'rocAuc' | 'sensitivity' | 'specificity') => b ? <span>{k === 'rocAuc' ? b.metrics![k].mean.toFixed(3) : pct1(b.metrics![k].mean)}{i > 0 && b0 && <span className={cn('ml-1 text-[10px]', b.metrics![k].mean >= b0.metrics![k].mean ? 'text-ok' : 'text-danger')}>{deltaPts(b.metrics![k].mean - b0.metrics![k].mean)}</span>}</span> : '—';
                return (
                  <tr key={e.id} className="border-t border-line">
                    <td className="px-3 py-2"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: COLORS[i] }} /><span className="font-mono">{e.id}</span></td>
                    <td className="px-3 py-2">{b?.label ?? (e.taskType === 'regression' ? 'regression run' : '…')}</td>
                    <td className="tnum px-3 py-2">{cell('rocAuc')}</td><td className="tnum px-3 py-2">{cell('sensitivity')}</td><td className="tnum px-3 py-2">{cell('specificity')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <ChartCard title="Overlaid ROC (best model of each run)">{rocModels.length ? <RocChart models={rocModels} styles={styles} height={240} /> : <div className="text-sm text-muted">No classification runs selected.</div>}</ChartCard>
      </div>
      <Card>
        <CardHeader title="Config diff" subtitle={`${keys.length} settings differ`} />
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[11px]">
            <thead className="bg-surface-2 text-left text-muted"><tr><th className="px-3 py-2">key</th>{exps.map((e) => <th key={e.id} className="px-3 py-2">{e.id}</th>)}</tr></thead>
            <tbody>{keys.slice(0, 40).map((k) => <tr key={k} className="border-t border-line"><td className="px-3 py-1.5 text-muted">{k}</td>{flat.map((f, i) => <td key={i} className="max-w-[260px] truncate px-3 py-1.5 text-fg" title={f[k]}>{f[k] ?? '—'}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
}

export default function Experiments() {
  const navigate = useNavigate();
  const { data: exps, isLoading } = useExperiments(true);
  const { data: models } = useModels();
  const deploy = useDeploy();
  const start = useStartExperiment();
  const pipe = usePipeline();
  const [tab, setTab] = useState<'experiments' | 'models'>('experiments');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [repro, setRepro] = useState<Experiment | null>(null);
  const filtered = useMemo(() => (exps ?? []).filter((e) => (status === 'all' || e.status === status) && `${e.name} ${e.id} ${e.datasetName} ${e.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())), [exps, q, status]);
  if (isLoading || !exps) return <PageSkeleton />;
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));

  return (
    <div>
      <PageHeader title="Experiment & model registry" trace="experiments" description="Every run is reproducible: config, seeds, library versions, dataset hash and MLflow run ID." />
      <Tabs value={tab} onChange={setTab} className="mb-4" tabs={[{ value: 'experiments', label: 'Experiments', count: exps.length }, { value: 'models', label: 'Models', count: models?.length }]} />
      {tab === 'experiments' ? (
        <>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-2.5"><Search size={14} className="text-muted" /><input aria-label="Search experiments" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search name, dataset, tag…" className="w-56 bg-transparent text-sm outline-none" /></div>
            <Select value={status} onChange={(v) => { setStatus(v); setPage(0); }} options={[{ value: 'all', label: 'All statuses' }, { value: 'done', label: 'Done' }, { value: 'running', label: 'Running' }, { value: 'queued', label: 'Queued' }, { value: 'cancelled', label: 'Cancelled' }]} />
            <AnimatePresence>{sel.length >= 2 && <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}><Button variant="quantum" icon={<GitCompare size={14} />} onClick={() => setComparing(true)}>Compare {sel.length}</Button></motion.div>}</AnimatePresence>
            <span className="ml-auto text-xs text-muted">Select 2–4 finished runs to compare</span>
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-left text-xs text-muted"><tr><th className="w-8 px-3 py-2" /><th className="px-3 py-2">Experiment</th><th className="px-3 py-2">Dataset · task</th><th className="px-3 py-2">Models</th><th className="px-3 py-2">Best classical / quantum</th><th className="px-3 py-2">Backend</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Duration</th><th className="px-3 py-2">Date</th><th className="px-3 py-2" /></tr></thead>
                <tbody>
                  {filtered.slice(page * PAGE, page * PAGE + PAGE).map((e, i) => (
                    <motion.tr key={e.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className={cn('border-t border-line', sel.includes(e.id) ? 'bg-tint-purple' : 'hover:bg-surface-2')}>
                      <td className="px-3 py-2.5"><input type="checkbox" aria-label={`Select ${e.id}`} disabled={e.status !== 'done'} checked={sel.includes(e.id)} onChange={() => toggle(e.id)} /></td>
                      <td className="cursor-pointer px-3 py-2.5" onClick={() => { pipe.setActiveExperiment(e.id); navigate(`/experiments/${e.id}/${e.status === 'done' ? 'results' : 'train'}`); }}>
                        <div className="font-medium text-fg hover:text-classical">{e.name}</div>
                        <div className="flex gap-1 pt-0.5"><span className="font-mono text-[10px] text-muted">{e.id}</span>{e.tags.map((t) => <span key={t} className="rounded bg-surface-3 px-1 text-[9px] text-muted">{t}</span>)}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-fg-2">{e.datasetName}<div className="text-[10px] text-muted">{e.taskType}</div></td>
                      <td className="px-3 py-2.5"><div className="flex max-w-[180px] flex-wrap gap-1">{e.models.map((m) => <FamilyBadge key={m.modelId} family={m.family} />).slice(0, 5)}{e.models.length > 5 && <span className="text-[10px] text-muted">+{e.models.length - 5}</span>}</div></td>
                      <td className="tnum px-3 py-2.5 text-xs">{e.bestByFamily.classical?.value.toFixed(3) ?? '—'} / <span className="text-quantum">{e.bestByFamily.quantum?.value.toFixed(3) ?? e.bestByFamily.hybrid?.value.toFixed(3) ?? '—'}</span><div className="text-[10px] text-muted">{e.bestByFamily.classical?.metric}</div></td>
                      <td className="px-3 py-2.5 text-xs text-fg-2">{e.backend}</td>
                      <td className="px-3 py-2.5"><StatusChip status={e.status} /></td>
                      <td className="tnum px-3 py-2.5 text-xs text-muted">{e.durationSec ? duration(e.durationSec) : '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-muted">{dateShort(e.createdAt)}</td>
                      <td className="px-3 py-2.5"><Button size="sm" variant="ghost" icon={<FileCog size={13} />} onClick={() => setRepro(e)}>Repro</Button></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-muted">
              <span>{filtered.length} experiments</span>
              <div className="flex items-center gap-2"><Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</Button>Page {page + 1} / {pages}<Button size="sm" variant="ghost" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button></div>
            </div>
          </Card>
          <AnimatePresence>{comparing && sel.length >= 2 && <Compare exps={exps.filter((e) => sel.includes(e.id))} onClose={() => setComparing(false)} />}</AnimatePresence>
        </>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs text-muted"><tr><th className="px-4 py-2">Model</th><th className="px-4 py-2">Version</th><th className="px-4 py-2">Stage</th><th className="px-4 py-2">Dataset</th><th className="px-4 py-2">Validated metrics</th><th className="px-4 py-2">Backend</th><th className="px-4 py-2" /></tr></thead>
            <tbody>
              {models?.map((m) => (
                <tr key={m.modelId} className="border-t border-line hover:bg-surface-2">
                  <td className="px-4 py-2.5"><div className="flex items-center gap-2 font-medium text-fg">{m.label}<FamilyBadge family={m.family} /></div><div className="font-mono text-[10px] text-muted">{m.modelId}</div></td>
                  <td className="px-4 py-2.5 font-mono text-xs">{m.version}</td>
                  <td className="px-4 py-2.5"><Badge color={m.stage === 'production' ? 'var(--green)' : 'var(--saffron)'}>{m.stage}</Badge></td>
                  <td className="px-4 py-2.5 text-xs text-fg-2">{m.datasetId}</td>
                  <td className="tnum px-4 py-2.5 text-xs">{m.metrics.rmse !== undefined ? `RMSE ${m.metrics.rmse.toFixed(2)}` : `sens ${pct1(m.metrics.sensitivity)} · spec ${pct1(m.metrics.specificity)} · AUC ${m.metrics.rocAuc?.toFixed(3)}`}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">{m.backend}</td>
                  <td className="px-4 py-2.5 text-right">{m.deployed ? <Badge solid color="var(--green)">serving /predict</Badge> : <Button size="sm" variant="outline" icon={<Rocket size={13} />} onClick={() => deploy.mutate(m.modelId, { onSuccess: () => toast.success(`${m.label} deployed`, { description: `Now serving predictions for ${m.datasetId}` }) })}>Deploy</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Drawer open={!!repro} onClose={() => setRepro(null)} title="Reproducibility" width={560}>
        {repro && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[['MLflow run', repro.mlflowRunId], ['Seeds', repro.seeds.join(', ')], ['Dataset', repro.datasetId], ['Created', dateShort(repro.createdAt)]].map(([k, v]) => <div key={k} className="rounded-lg bg-surface-2 p-2"><div className="text-muted">{k}</div><div className="font-mono text-fg">{v}</div></div>)}
            </div>
            <div className="rounded-lg bg-surface-2 p-3 font-mono text-[11px]">{Object.entries(repro.libraryVersions).map(([k, v]) => <div key={k}>{k}=={v}</div>)}</div>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={JSON.stringify(repro.config, null, 2)} label="Copy config" />
              <Button size="sm" variant="outline" icon={<Download size={13} />} onClick={() => download(`${repro.id}-config.json`, JSON.stringify({ ...repro.config, seeds: repro.seeds, libraryVersions: repro.libraryVersions, mlflowRunId: repro.mlflowRunId }, null, 2), 'application/json')}>Download</Button>
              <Button size="sm" variant="outline" icon={<RotateCw size={13} />} onClick={() => start.mutate({ ...repro.config, name: `${repro.config.name} (re-run)` }, { onSuccess: ({ experiment_id }) => { setRepro(null); pipe.setActiveExperiment(experiment_id); navigate(`/experiments/${experiment_id}/train`); } })}>Re-run</Button>
              <Button size="sm" variant="quantum" icon={<Copy size={13} />} onClick={() => { const c = repro.config; pipe.setDataset(c.datasetId, c.taskType, pipe.targetColumn); pipe.setQuantum(c.quantum); pipe.setSelectedModels([...new Set(c.models.map((m) => m.kind))]); setRepro(null); navigate('/models'); toast('Config loaded into Model Studio'); }}>Clone and edit</Button>
            </div>
            <pre className="max-h-80 overflow-auto rounded-lg bg-[#0b1220] p-3 font-mono text-[10px] text-[#c3cfdf]">{JSON.stringify(repro.config, null, 2)}</pre>
          </div>
        )}
      </Drawer>
    </div>
  );
}
