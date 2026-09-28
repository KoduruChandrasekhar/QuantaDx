/** Threshold explorer (dynamic element #12): dragging recomputes the confusion matrix and all threshold metrics client-side at 60 fps. */
import { Stethoscope } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ExperimentResults } from '@/types/api';
import { confusionAt, metricsFromConfusion } from '@/lib/metrics';
import { youdenThreshold } from '@/lib/risk';
import { useSelection } from '@/store';
import { Card, CardHeader, Select, Slider } from '@/components/common/ui';
import { ConfusionMatrix, RocChart, type Styles } from '@/components/charts/charts';
import { pct1 } from '@/lib/format';

export function ThresholdExplorer({ r, styles, defaultModel, pos = 'Pos', neg = 'Neg' }: { r: ExperimentResults; styles: Styles; defaultModel: string; pos?: string; neg?: string }) {
  const [modelId, setModelId] = useState(defaultModel);
  const t = useSelection((s) => s.threshold);
  const setT = useSelection((s) => s.setThreshold);
  const m = r.models.find((x) => x.modelId === modelId) ?? r.models[0];
  const labels = r.labels!;
  const cm = useMemo(() => confusionAt(m.scores!, labels, t), [m, labels, t]);
  const k = metricsFromConfusion(cm);
  const youden = useMemo(() => youdenThreshold(m.scores!, labels), [m, labels]);
  const op = { fpr: 1 - k.specificity, tpr: k.sensitivity };
  return (
    <Card>
      <CardHeader title="Threshold explorer" subtitle="Recomputed in your browser from out-of-fold scores" icon={<Stethoscope size={16} />} actions={
        <Select value={modelId} onChange={setModelId} options={r.models.map((x) => ({ value: x.modelId, label: x.label }))} />
      } />
      <div className="grid gap-5 p-4 lg:grid-cols-[1fr_1fr_1.1fr]">
        <div className="space-y-4">
          <Slider label="Decision threshold" value={t} min={0.01} max={0.99} step={0.005} onChange={setT} format={(v) => v.toFixed(3)} accent="var(--saffron)" hint={<span>Youden’s J optimum: <button className="font-mono text-classical hover:underline" onClick={() => setT(youden)}>{youden.toFixed(3)}</button></span>} />
          <div className="grid grid-cols-3 gap-2">
            {[['Sensitivity', k.sensitivity, 'var(--blue)'], ['Specificity', k.specificity, 'var(--purple)'], ['PPV', k.precision, 'var(--teal)'], ['NPV', k.npv, 'var(--green)'], ['F1', k.f1, 'var(--saffron)'], ['MCC', k.mcc, 'var(--navy)']].map(([l, v, c]) => (
              <div key={l as string} className="rounded-lg bg-surface-2 p-2 text-center">
                <div className="text-[10px] text-muted">{l as string}</div>
                <div className="tnum text-base font-bold" style={{ color: c as string }}>{l === 'MCC' ? (v as number).toFixed(3) : pct1(v as number)}</div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full transition-[width] duration-75" style={{ width: `${Math.max(0, v as number) * 100}%`, background: c as string }} /></div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-saffron/40 bg-tint-saffron p-3 text-xs text-fg-2">
            <b>Clinical note:</b> for screening, favour sensitivity — a false negative is a missed patient. At this threshold, <b className="text-danger">{cm.fn} patients would be missed</b> and {cm.fp} healthy patients recalled.
          </div>
        </div>
        <ConfusionMatrix cm={cm} label={`${m.label} @ t = ${t.toFixed(2)}`} color={styles[m.modelId]?.color} positive={pos} negative={neg} />
        <RocChart models={[m]} styles={styles} height={250} operatingPoint={op} />
      </div>
    </Card>
  );
}
