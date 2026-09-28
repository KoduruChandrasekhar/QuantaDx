/** Batch / cohort mode: CSV or sample cohort → predictions table, stratification donut, prioritised worklist. */
import { motion } from 'framer-motion';
import { AlertTriangle, Download, ListOrdered, Loader2, Upload, Users } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { toast } from 'sonner';
import { api } from '@/api/endpoints';
import type { BatchPrediction } from '@/types/api';
import { BAND_META, type RiskBand, type RiskBands } from '@/lib/risk';
import { download, toCsv } from '@/lib/export';
import { Button, Card, CardHeader, Segmented } from '@/components/common/ui';
import { RiskBadge } from '@/components/common/misc';
import { tooltipStyle } from '@/components/charts/ChartCard';

export function BatchMode({ datasetId, modelId, threshold, bands, actions }: { datasetId: string; modelId?: string; threshold: number; bands: RiskBands; actions: Record<RiskBand, string> }) {
  const [res, setRes] = useState<BatchPrediction | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | RiskBand>('all');
  const [sortDesc, setSortDesc] = useState(true);
  const file = useRef<HTMLInputElement>(null);
  const run = async (rows: { patientId: string; features: Record<string, number> }[]) => {
    setBusy(true);
    try {
      const r = await api.predictBatch({ datasetId, modelId, features: {}, threshold, bands, rows });
      setRes(r);
      toast.success(`Scored ${r.rows.length} patients`, { description: `${r.summary.high} high · ${r.summary.moderate} moderate · ${r.summary.low} low` });
    } catch (e) {
      toast.error('Batch prediction failed', { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const fromCsv = async (f: File) => {
    const Papa = (await import('papaparse')).default;
    const parsed = Papa.parse<Record<string, string>>(await f.text(), { header: true, skipEmptyLines: true });
    const rows = parsed.data.map((r, i) => ({ patientId: r.patient_id ?? r.id ?? `ROW-${i + 1}`, features: Object.fromEntries(Object.entries(r).filter(([, v]) => v !== '' && !Number.isNaN(Number(v))).map(([k, v]) => [k, Number(v)])) }));
    run(rows);
  };
  const rows = useMemo(() => (res ? res.rows.filter((r) => filter === 'all' || r.riskBand === filter).sort((a, b) => ((a.probability ?? a.value ?? 0) - (b.probability ?? b.value ?? 0)) * (sortDesc ? -1 : 1)) : []), [res, filter, sortDesc]);
  const donut = res ? (['low', 'moderate', 'high'] as RiskBand[]).map((b) => ({ name: BAND_META[b].label, value: res.summary[b], color: BAND_META[b].color })) : [];
  return (
    <Card data-tour="predict-batch">
      <CardHeader title="Batch / cohort mode" subtitle="Validated against the dataset schema · results stay in this browser" icon={<Users size={16} />} actions={
        <>
          <Button size="sm" variant="outline" icon={<Upload size={13} />} onClick={() => file.current?.click()}>Upload CSV</Button>
          <input ref={file} type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && fromCsv(e.target.files[0])} />
          <Button size="sm" icon={busy ? <Loader2 size={13} className="animate-spin" /> : <Users size={13} />} disabled={busy} onClick={async () => run(await api.cohort(datasetId, 120))}>Score sample cohort (120)</Button>
        </>
      } />
      {!res ? (
        <div className="p-8 text-center text-sm text-muted">Upload a CSV with the same columns as the training data, or score a sample cohort.</div>
      ) : (
        <div className="grid gap-5 p-4 lg:grid-cols-[280px_1fr]">
          <div className="space-y-4">
            {res.schemaErrors.map((e) => <div key={e} className="flex gap-2 rounded-lg bg-tint-saffron p-2 text-xs text-fg-2"><AlertTriangle size={13} className="shrink-0 text-saffron" />{e}</div>)}
            <div className="relative h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={donut} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3} animationDuration={900}>{donut.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie><Tooltip {...tooltipStyle()} /></PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="metric text-2xl font-bold">{res.rows.length}</span><span className="text-[10px] text-muted">patients</span></div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-fg-2"><ListOrdered size={13} /> Prioritised worklist</div>
              {[...res.rows].sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0)).slice(0, 6).map((r, i) => (
                <motion.div key={r.patientId + i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="flex items-center gap-2 border-b border-line py-1.5 text-xs last:border-0">
                  <span className="font-mono text-muted">{i + 1}.</span><span className="font-mono text-fg">{r.patientId}</span>
                  <span className="tnum ml-auto font-semibold">{r.probability !== undefined ? `${(r.probability * 100).toFixed(0)}%` : r.value}</span>
                </motion.div>
              ))}
              {res.rows[0]?.riskBand && <p className="mt-2 text-[11px] text-muted">High band action: {actions.high}</p>}
            </div>
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Segmented size="sm" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'high', label: 'High' }, { value: 'moderate', label: 'Moderate' }, { value: 'low', label: 'Low' }]} />
              <Button size="sm" variant="ghost" onClick={() => setSortDesc((s) => !s)}>Sort: risk {sortDesc ? '↓' : '↑'}</Button>
              <Button size="sm" variant="outline" className="ml-auto" icon={<Download size={13} />} onClick={() => download('cohort-predictions.csv', toCsv(res.rows.map((r) => ({ patient_id: r.patientId, probability: r.probability ?? null, value: r.value ?? null, band: r.riskBand ?? '', decision: r.decision ?? '' }))), 'text/csv')}>CSV</Button>
            </div>
            <div className="max-h-[420px] overflow-auto rounded-lg border border-line">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface-2 text-left text-muted"><tr><th className="px-3 py-2">Patient</th><th className="px-3 py-2">Probability</th><th className="px-3 py-2">Band</th><th className="px-3 py-2">Top factor</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.patientId + i} className="border-t border-line hover:bg-surface-2">
                      <td className="px-3 py-1.5 font-mono">{r.patientId}</td>
                      <td className="px-3 py-1.5"><div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded-full bg-surface-3"><div className="h-full rounded-full" style={{ width: `${(r.probability ?? 0) * 100}%`, background: r.riskBand ? BAND_META[r.riskBand].color : 'var(--teal)' }} /></div><span className="tnum">{r.probability !== undefined ? `${(r.probability * 100).toFixed(1)}%` : r.value}</span></div></td>
                      <td className="px-3 py-1.5">{r.riskBand && <RiskBadge band={r.riskBand} size="sm" />}</td>
                      <td className="max-w-xs truncate px-3 py-1.5 text-fg-2">{r.topFactors[0]?.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
