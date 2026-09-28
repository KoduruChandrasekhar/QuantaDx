/** Objective O3 scorecard: best quantum/hybrid vs best classical on accuracy, sensitivity, specificity — never overclaims. */
import { motion } from 'framer-motion';
import { Atom, Cpu, Scale } from 'lucide-react';
import type { ExperimentResults, ModelResult } from '@/types/api';
import { Badge, Card, Tip } from '@/components/common/ui';
import { CountUp } from '@/components/common/misc';
import { deltaPts, pValue } from '@/lib/format';

const T975: Record<number, number> = { 3: 4.303, 5: 2.776, 10: 2.262 };

export function bestOf(r: ExperimentResults) {
  const by = (ms: ModelResult[]) => [...ms].sort((a, b) => b.metrics!.accuracy.mean - a.metrics!.accuracy.mean || b.metrics!.rocAuc.mean - a.metrics!.rocAuc.mean)[0];
  return { c: by(r.models.filter((m) => m.family === 'classical')), q: by(r.models.filter((m) => m.family !== 'classical')) };
}

export function O3Scorecard({ r }: { r: ExperimentResults }) {
  const { c, q } = bestOf(r);
  if (!c || !q) return null;
  const t = T975[r.folds] ?? 2.776;
  const ci = (s: number) => (t * s) / Math.sqrt(r.folds);
  const sig = r.significance.find((s) => s.modelA === q.modelId && s.modelB === c.modelId);
  const rows: { key: 'accuracy' | 'sensitivity' | 'specificity'; label: string }[] = [
    { key: 'accuracy', label: 'Accuracy' }, { key: 'sensitivity', label: 'Sensitivity' }, { key: 'specificity', label: 'Specificity' },
  ];
  return (
    <Card className="gradient-border overflow-hidden rounded-2xl" data-tour="results-o3">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-gradient-to-r from-tint-blue via-surface to-tint-purple px-5 py-3">
        <Scale size={18} className="text-navy" />
        <div>
          <h3 className="font-semibold text-fg">Objective O3 scorecard</h3>
          <p className="text-xs text-muted">Best quantum/hybrid vs best classical · 95% CI over {r.folds} folds · significance from the returned tests only</p>
        </div>
        {sig && (
          <Tip text={sig.verdict}>
            <span tabIndex={0} className="ml-auto"><Badge color={sig.significant ? 'var(--red)' : 'var(--muted)'}>{sig.significant ? 'Significant difference' : 'Not significant'} · McNemar p = {pValue(sig.mcnemar?.pValue ?? 1)} · Wilcoxon p = {pValue(sig.wilcoxon.pValue)}</Badge></span>
          </Tip>
        )}
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-[1fr_1fr_1fr]">
        {rows.map((row, i) => {
          const qm = q.metrics![row.key], cm = c.metrics![row.key];
          const d = qm.mean - cm.mean;
          const color = Math.abs(d) < 0.0005 ? 'var(--muted)' : d > 0 ? 'var(--green)' : 'var(--red)';
          return (
            <motion.div key={row.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="rounded-xl border border-line bg-surface-2 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted">{row.label}</div>
              <div className="metric mt-1 text-2xl font-bold" style={{ color }}>{deltaPts(d)}</div>
              <div className="mt-3 space-y-2">
                {[{ m: q, v: qm, icon: Atom, col: 'var(--purple)' }, { m: c, v: cm, icon: Cpu, col: 'var(--blue)' }].map(({ m, v, icon: Icon, col }) => (
                  <div key={m.modelId}>
                    <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1 truncate text-fg-2"><Icon size={12} style={{ color: col }} />{m.label}</span><span className="tnum font-semibold text-fg"><CountUp value={v.mean * 100} format={(x) => `${x.toFixed(1)}%`} /></span></div>
                    <div className="relative mt-1 h-2 rounded-full bg-surface-3">
                      <motion.div className="absolute inset-y-0 rounded-full opacity-30" style={{ background: col }} initial={{ left: '50%', width: 0 }} animate={{ left: `${Math.max(0, (v.mean - ci(v.std) - 0.7) / 0.3) * 100}%`, width: `${((2 * ci(v.std)) / 0.3) * 100}%` }} transition={{ duration: 0.9 }} />
                      <motion.div className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded" style={{ background: col }} initial={{ left: '0%' }} animate={{ left: `${((v.mean - 0.7) / 0.3) * 100}%` }} transition={{ type: 'spring', stiffness: 80, damping: 14 }} />
                    </div>
                    <div className="mt-0.5 text-right font-mono text-[9px] text-muted">95% CI {((v.mean - ci(v.std)) * 100).toFixed(1)}–{Math.min(100, (v.mean + ci(v.std)) * 100).toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="border-t border-line bg-surface-2 px-5 py-3 text-sm text-fg-2">
        <b>Honest reading:</b> {q.label} {Math.abs(q.metrics!.specificity.mean - c.metrics!.specificity.mean) < 0.0005 ? `matches ${c.label}'s specificity (${(c.metrics!.specificity.mean * 100).toFixed(1)}%)` : `is ${deltaPts(q.metrics!.specificity.mean - c.metrics!.specificity.mean)} on specificity`} and is {deltaPts(q.metrics!.sensitivity.mean - c.metrics!.sensitivity.mean)} on sensitivity. {sig ? sig.verdict : ''} O3 improvement is <i>not</i> claimed for this dataset; next steps are threshold tuning and hybrid models.
      </div>
    </Card>
  );
}
