/** Key findings generated ONLY from the returned numbers (templates), plus CSV / PDF export. */
import { motion } from 'framer-motion';
import { FileDown, FileSpreadsheet, Lightbulb, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Experiment, ExperimentResults } from '@/types/api';
import { Button, Card, CardHeader } from '@/components/common/ui';
import { deltaPts, duration, pValue } from '@/lib/format';
import { download, toCsv } from '@/lib/export';
import { Report } from '@/lib/report';
import { bestOf } from './O3Scorecard';
import { columnsFor } from './Leaderboard';

export function findings(r: ExperimentResults): string[] {
  const out: string[] = [];
  if (r.taskType === 'regression') {
    const sorted = [...r.models].sort((a, b) => a.regression!.rmse.mean - b.regression!.rmse.mean);
    const bq = sorted.find((m) => m.family !== 'classical');
    out.push(`${sorted[0].label} has the lowest RMSE (${sorted[0].regression!.rmse.mean.toFixed(2)}, R² ${sorted[0].regression!.r2.mean.toFixed(2)}).`);
    if (bq) out.push(`Best quantum model ${bq.label}: RMSE ${bq.regression!.rmse.mean.toFixed(2)} (${(bq.regression!.rmse.mean - sorted[0].regression!.rmse.mean).toFixed(2)} worse than the best model).`);
    return out;
  }
  const { c, q } = bestOf(r);
  out.push(`Best classical model: ${c.label} — accuracy ${(c.metrics!.accuracy.mean * 100).toFixed(1)}%, sensitivity ${(c.metrics!.sensitivity.mean * 100).toFixed(1)}%, specificity ${(c.metrics!.specificity.mean * 100).toFixed(1)}%.`);
  if (q) {
    out.push(`Best quantum/hybrid model: ${q.label} — accuracy ${deltaPts(q.metrics!.accuracy.mean - c.metrics!.accuracy.mean)}, sensitivity ${deltaPts(q.metrics!.sensitivity.mean - c.metrics!.sensitivity.mean)}, specificity ${deltaPts(q.metrics!.specificity.mean - c.metrics!.specificity.mean)} vs ${c.label}.`);
    const s = r.significance.find((x) => x.modelA === q.modelId && x.modelB === c.modelId);
    if (s) out.push(`Significance (${q.label} vs ${c.label}): McNemar p = ${pValue(s.mcnemar?.pValue ?? 1)}, paired t p = ${pValue(s.pairedT.pValue)}, Wilcoxon p = ${pValue(s.wilcoxon.pValue)}. ${s.verdict}`);
  }
  if (r.bandwidthSweep) {
    const raw = r.bandwidthSweep.find((b) => b.bandwidth === 1);
    const sel = r.bandwidthSweep.find((b) => b.selected);
    if (raw && sel) out.push(`Bandwidth tuning fixed kernel concentration: accuracy ${(raw.accuracy * 100).toFixed(1)}% at bandwidth 1.0 → ${(sel.accuracy * 100).toFixed(1)}% at the CV-selected ${sel.bandwidth}.`);
  }
  const nSig = r.significance.filter((s) => s.significant).length;
  out.push(`${nSig} of ${r.significance.length} quantum-vs-classical comparisons are significant under both McNemar and the paired t-test.`);
  if (q) out.push(`Efficiency: ${q.label} trains in ${duration(q.efficiency.trainTimeSec)} vs ${duration(c.efficiency.trainTimeSec)} for ${c.label} (${Math.round(q.efficiency.trainTimeSec / Math.max(0.01, c.efficiency.trainTimeSec))}× slower on a statevector simulator).`);
  if (r.noiseRobustness.length && q) {
    const first = r.noiseRobustness[0].series[q.modelId], last = r.noiseRobustness[r.noiseRobustness.length - 1];
    if (first !== undefined && last.series[q.modelId] !== undefined) out.push(`Under noise, ${q.label} drops from ${(first * 100).toFixed(1)}% (ideal) to ${(last.series[q.modelId] * 100).toFixed(1)}% (${last.level}); mitigation recovers ${((last.mitigated[q.modelId] - last.series[q.modelId]) * 100).toFixed(1)} pts.`);
  }
  if (r.externalValidation.length) {
    const worst = [...r.externalValidation].sort((a, b) => a.external - a.internal - (b.external - b.internal))[0];
    out.push(`External validation: largest drop for ${r.models.find((m) => m.modelId === worst.modelId)?.label} (${((worst.external - worst.internal) * 100).toFixed(1)} pts ROC-AUC).`);
  }
  out.push('Next steps: threshold tuning for sensitivity, hybrid architectures and a hardware run with error mitigation.');
  return out;
}

export function Findings({ r, exp }: { r: ExperimentResults; exp: Experiment }) {
  const [busy, setBusy] = useState(false);
  const items = findings(r);
  const exportCsv = () => {
    const cols = columnsFor(r);
    const rows = r.models.map((m) => ({ model: m.label, family: m.family, ...Object.fromEntries(cols.flatMap((c) => [[c.key, Number(c.get(m).toFixed(4))], ...(c.std ? [[`${c.key}_std`, Number(c.std(m).toFixed(4))]] : [])])) }));
    download(`${exp.id}-metrics.csv`, toCsv(rows), 'text/csv');
    toast.success('Metrics CSV exported');
  };
  const exportPdf = async () => {
    setBusy(true);
    try {
      const rep = await Report.create('Benchmark report', `${exp.name} · ${exp.datasetName} · ${exp.id}`);
      rep.heading('1. Dataset & protocol');
      rep.paragraph(`Dataset: ${exp.datasetName} (${r.nSamples} samples). Task: ${r.taskType}. Protocol: ${r.protocol}. Backend: ${exp.backend}.`);
      rep.heading('2. Leaderboard (mean ± std over folds)');
      const cols = columnsFor(r).slice(0, 7);
      rep.table(['Model', ...cols.map((c) => c.label)], r.models.map((m) => [m.label, ...cols.map((c) => `${c.fmt ? c.fmt(c.get(m)) : c.get(m).toFixed(3)}${c.std ? ` ±${c.std(m).toFixed(3)}` : ''}`)]), [46, ...cols.map(() => 136 / cols.length)]);
      rep.heading('3. Key findings');
      rep.bullets(items);
      if (r.significance.length) {
        rep.heading('4. Significance tests');
        const name = (id: string) => r.models.find((m) => m.modelId === id)?.label ?? id;
        rep.table(['Quantum', 'Classical', 'McNemar p', 'Paired t p', 'Wilcoxon p'], r.significance.map((s) => [name(s.modelA), name(s.modelB), pValue(s.mcnemar?.pValue ?? 1), pValue(s.pairedT.pValue), pValue(s.wilcoxon.pValue)]), [52, 52, 26, 26, 26]);
      }
      rep.heading('5. Charts');
      for (const [id, cap] of [['results-roc', 'ROC curves (out-of-fold)'], ['results-bandwidth', 'Kernel bandwidth sweep'], ['results-noise', 'Noise robustness']] as const)
        await rep.chart(document.querySelector<SVGSVGElement>(`[data-tour="${id}"] svg.recharts-surface`), cap);
      rep.heading('Appendix · configuration');
      rep.paragraph(JSON.stringify({ quantum: exp.config.quantum, protocol: exp.config.protocol, models: exp.config.models.map((m) => m.label), seeds: exp.seeds, versions: exp.libraryVersions }, null, 1), 7);
      rep.save(`${exp.id}-benchmark-report.pdf`);
      toast.success('PDF benchmark report exported');
    } catch (e) {
      toast.error('Report failed', { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader title="Key findings" subtitle="Auto-generated from the returned numbers only — no hand-written claims" icon={<Lightbulb size={16} />} actions={
        <>
          <Button size="sm" variant="outline" icon={<FileSpreadsheet size={14} />} onClick={exportCsv}>Metrics CSV</Button>
          <Button size="sm" icon={busy ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} onClick={exportPdf} disabled={busy}>PDF report</Button>
        </>
      } />
      <ol className="space-y-2 p-4">
        {items.map((t, i) => (
          <motion.li key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="flex gap-3 text-sm text-fg-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-tint-purple text-[10px] font-bold text-quantum">{i + 1}</span>{t}
          </motion.li>
        ))}
      </ol>
    </Card>
  );
}
