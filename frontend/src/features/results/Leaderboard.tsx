/** Sortable leaderboard (mean ± std over folds), best per column highlighted, rows drive linked highlighting. */
import { motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ExperimentResults, ModelFamily, ModelResult } from '@/types/api';
import { useSelection } from '@/store';
import { Card, CardHeader, Segmented, cn } from '@/components/common/ui';
import { FamilyBadge } from '@/components/common/misc';
import { duration, ms } from '@/lib/format';

type Col = { key: string; label: string; get: (m: ModelResult) => number; std?: (m: ModelResult) => number; higher: boolean; fmt?: (v: number) => string };

export function columnsFor(r: ExperimentResults): Col[] {
  const eff: Col[] = [
    { key: 'train', label: 'Train time', get: (m) => m.efficiency.trainTimeSec, higher: false, fmt: duration },
    { key: 'inf', label: 'Inference', get: (m) => m.efficiency.inferenceMsPerSample, higher: false, fmt: (v) => `${ms(v)}/sample` },
    { key: 'params', label: 'Params / qubits', get: (m) => m.efficiency.params, higher: false, fmt: (v) => v.toLocaleString() },
  ];
  if (r.taskType === 'regression')
    return [
      { key: 'rmse', label: 'RMSE', get: (m) => m.regression!.rmse.mean, std: (m) => m.regression!.rmse.std, higher: false, fmt: (v) => v.toFixed(2) },
      { key: 'mae', label: 'MAE', get: (m) => m.regression!.mae.mean, std: (m) => m.regression!.mae.std, higher: false, fmt: (v) => v.toFixed(2) },
      { key: 'r2', label: 'R²', get: (m) => m.regression!.r2.mean, std: (m) => m.regression!.r2.std, higher: true },
      ...eff,
    ];
  const mk = (key: keyof NonNullable<ModelResult['metrics']>, label: string, higher = true): Col => ({ key, label, get: (m) => m.metrics![key].mean, std: (m) => m.metrics![key].std, higher });
  return [mk('accuracy', 'Accuracy'), mk('balancedAccuracy', 'Bal. acc'), mk('sensitivity', 'Sensitivity'), mk('specificity', 'Specificity'), mk('precision', 'Precision'), mk('npv', 'NPV'), mk('f1', 'F1'), mk('rocAuc', 'ROC-AUC'), mk('prAuc', 'PR-AUC'), mk('mcc', 'MCC'), mk('brier', 'Brier', false), ...eff];
}

export function Leaderboard({ r, styles }: { r: ExperimentResults; styles: Record<string, { color: string; dash: string }> }) {
  const cols = columnsFor(r);
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: cols[0].key, desc: cols[0].higher });
  const [fam, setFam] = useState<'all' | ModelFamily>('all');
  const hl = useSelection((s) => s.highlightedModelId);
  const setHl = useSelection((s) => s.setHighlighted);
  const best = useMemo(() => Object.fromEntries(cols.map((c) => {
    const vals = r.models.map((m) => c.get(m));
    return [c.key, c.higher ? Math.max(...vals) : Math.min(...vals)];
  })), [cols, r]);
  const col = cols.find((c) => c.key === sort.key)!;
  const rows = r.models.filter((m) => fam === 'all' || m.family === fam || (fam === 'quantum' && m.family === 'hybrid')).sort((a, b) => (col.get(a) - col.get(b)) * (sort.desc ? -1 : 1));
  return (
    <Card data-tour="results-leaderboard">
      <CardHeader title="Leaderboard" subtitle={`mean ± std over ${r.folds} folds · best per column highlighted · hover a row to link every chart`} icon={<Trophy size={16} />}
        actions={<Segmented size="sm" value={fam} onChange={setFam} options={[{ value: 'all', label: 'All' }, { value: 'classical', label: 'Classical' }, { value: 'quantum', label: 'Quantum + hybrid' }]} />} />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-surface-2 text-muted">
            <tr>
              <th className="sticky left-0 z-10 bg-surface-2 px-3 py-2 text-left font-semibold">#</th>
              <th className="sticky left-6 z-10 min-w-[190px] bg-surface-2 px-3 py-2 text-left font-semibold">Model</th>
              {cols.map((c) => (
                <th key={c.key} className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                  <button className="inline-flex items-center gap-1 hover:text-fg" onClick={() => setSort({ key: c.key, desc: sort.key === c.key ? !sort.desc : c.higher })}>
                    {c.label}{sort.key === c.key && (sort.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <motion.tr layout key={m.modelId} onMouseEnter={() => setHl(m.modelId)} onMouseLeave={() => setHl(null)} transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                className={cn('border-t border-line transition-colors', hl === m.modelId ? 'bg-tint-blue' : hl ? 'opacity-50' : 'hover:bg-surface-2')}>
                <td className="sticky left-0 bg-inherit px-3 py-2 font-mono text-muted">{i + 1}</td>
                <td className="sticky left-6 bg-inherit px-3 py-2">
                  <div className="flex items-center gap-2">
                    <svg width="16" height="6" aria-hidden><line x1="0" y1="3" x2="16" y2="3" stroke={styles[m.modelId]?.color} strokeWidth="3" strokeDasharray={styles[m.modelId]?.dash} /></svg>
                    <span className="font-medium text-fg">{m.label}</span>
                    <FamilyBadge family={m.family} />
                  </div>
                </td>
                {cols.map((c) => {
                  const v = c.get(m);
                  const isBest = Math.abs(v - best[c.key]) < 1e-9;
                  return (
                    <td key={c.key} className={cn('tnum whitespace-nowrap px-3 py-2 text-right', isBest ? 'font-bold text-ok' : 'text-fg-2')}>
                      {isBest && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-ok align-middle" />}
                      {c.fmt ? c.fmt(v) : v.toFixed(3)}
                      {c.std && <span className="ml-1 text-[10px] font-normal text-muted">± {c.std(m).toFixed(3)}</span>}
                      {c.key === 'params' && m.efficiency.qubits && <span className="ml-1 text-[10px] font-normal text-quantum">· {m.efficiency.qubits}q</span>}
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
