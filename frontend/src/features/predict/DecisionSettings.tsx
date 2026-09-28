/** D4 threshold tuning (presets, cost-weighted, min-sensitivity) and the draggable risk-band editor. */
import { motion } from 'framer-motion';
import { Gauge, Layers } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { ModelResult } from '@/types/api';
import { confusionAt, metricsFromConfusion } from '@/lib/metrics';
import { BAND_META, assignBand, bandsFromCuts, costWeightedThreshold, sensitivityConstrainedThreshold, specificityConstrainedThreshold, youdenThreshold, type RiskBand, type RiskBands } from '@/lib/risk';
import { pct1 } from '@/lib/format';
import { Button, Card, CardHeader, NumberField, Segmented, Slider } from '@/components/common/ui';
import { RocChart } from '@/components/charts/charts';

export type Mode = 'screening' | 'balanced' | 'confirmatory' | 'custom';

export function presetThreshold(mode: Mode, scores: number[], labels: number[]): number {
  if (mode === 'screening') return sensitivityConstrainedThreshold(scores, labels, 0.95);
  if (mode === 'confirmatory') return specificityConstrainedThreshold(scores, labels, 0.98);
  return youdenThreshold(scores, labels);
}

export function DecisionSettings({ model, labels, threshold, onThreshold, mode, onMode }: { model?: ModelResult; labels?: number[]; threshold: number; onThreshold: (t: number) => void; mode: Mode; onMode: (m: Mode) => void }) {
  const [costFN, setCostFN] = useState(10);
  const [costFP, setCostFP] = useState(1);
  const [minSens, setMinSens] = useState(0.95);
  const ok = !!model?.scores && !!labels;
  const k = useMemo(() => (ok ? metricsFromConfusion(confusionAt(model!.scores!, labels!, threshold)) : null), [ok, model, labels, threshold]);
  return (
    <Card data-tour="predict-settings">
      <CardHeader title="Decision settings" subtitle="Threshold tuning for sensitivity / specificity (validated on out-of-fold data)" icon={<Gauge size={16} />} />
      <div className="space-y-4 p-4">
        <Segmented value={mode} onChange={(m) => { onMode(m); if (ok && m !== 'custom') onThreshold(presetThreshold(m, model!.scores!, labels!)); }} options={[
          { value: 'screening', label: 'Screening' }, { value: 'balanced', label: 'Balanced' }, { value: 'confirmatory', label: 'Confirmatory' }, { value: 'custom', label: 'Custom' },
        ]} className="flex w-full [&>button]:flex-1" />
        <p className="text-[11px] text-muted">{{ screening: 'Screening: sensitivity ≥ 95% — missing a patient is costlier than a recall.', balanced: "Balanced: maximises Youden's J = sensitivity + specificity − 1.", confirmatory: 'Confirmatory: specificity ≥ 98% — few false alarms before invasive follow-up.', custom: 'Custom: drag the threshold yourself.' }[mode]}</p>
        <Slider label="Decision threshold" value={threshold} min={0.01} max={0.99} step={0.005} onChange={(v) => { onThreshold(v); onMode('custom'); }} format={(v) => v.toFixed(3)} accent="var(--saffron)" />
        {k && (
          <div className="grid grid-cols-4 gap-2">
            {[['Sensitivity', k.sensitivity], ['Specificity', k.specificity], ['PPV', k.precision], ['NPV', k.npv]].map(([l, v]) => (
              <div key={l as string} className="rounded-lg bg-surface-2 p-2 text-center"><div className="text-[10px] text-muted">{l as string}</div><motion.div key={(v as number).toFixed(3)} initial={{ scale: 1.15 }} animate={{ scale: 1 }} className="tnum text-sm font-bold text-fg">{pct1(v as number)}</motion.div></div>
            ))}
          </div>
        )}
        {ok && <RocChart models={[model!]} styles={{ [model!.modelId]: { color: 'var(--purple)', dash: '0' } }} height={170} operatingPoint={k ? { fpr: 1 - k.specificity, tpr: k.sensitivity } : undefined} mini />}
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-line p-3">
          <div className="col-span-2 text-xs font-semibold text-fg-2">Cost-weighted threshold</div>
          <NumberField label="Cost of a missed case (FN)" value={costFN} min={0} onChange={setCostFN} />
          <NumberField label="Cost of a false alarm (FP)" value={costFP} min={0} onChange={setCostFP} />
          <Button size="sm" variant="outline" className="col-span-2" disabled={!ok} onClick={() => { onThreshold(costWeightedThreshold(model!.scores!, labels!, costFN, costFP)); onMode('custom'); }}>Find cost-optimal threshold</Button>
        </div>
        <div className="flex items-end gap-2 rounded-lg border border-line p-3">
          <Slider className="flex-1" label="Minimum sensitivity" value={minSens} min={0.7} max={0.99} step={0.01} onChange={setMinSens} format={pct1} />
          <Button size="sm" variant="outline" disabled={!ok} onClick={() => { onThreshold(sensitivityConstrainedThreshold(model!.scores!, labels!, minSens)); onMode('custom'); }}>Apply</Button>
        </div>
      </div>
    </Card>
  );
}

const DEFAULT_ACTIONS: Record<RiskBand, string> = { low: BAND_META.low.action, moderate: BAND_META.moderate.action, high: BAND_META.high.action };

export function RiskBandEditor({ bands, onBands, scores, labels, actions, onActions }: { bands: RiskBands; onBands: (b: RiskBands) => void; scores?: number[]; labels?: number[]; actions: Record<RiskBand, string>; onActions: (a: Record<RiskBand, string>) => void }) {
  const bar = useRef<HTMLDivElement>(null);
  const drag = (which: 0 | 1) => (e: React.PointerEvent) => {
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const r = bar.current!.getBoundingClientRect();
      const v = Math.min(0.98, Math.max(0.02, (ev.clientX - r.left) / r.width));
      onBands(which === 0 ? bandsFromCuts(v, bands.moderate[1]) : bandsFromCuts(bands.low[1], v));
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const keyMove = (which: 0 | 1) => (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 0.01 : e.key === 'ArrowLeft' ? -0.01 : 0;
    if (!d) return;
    e.preventDefault();
    onBands(which === 0 ? bandsFromCuts(bands.low[1] + d, bands.moderate[1]) : bandsFromCuts(bands.low[1], bands.moderate[1] + d));
  };
  const hist = useMemo(() => {
    const bins = Array.from({ length: 25 }, (_, i) => ({ x: (i + 0.5) / 25, pos: 0, neg: 0 }));
    scores?.forEach((s, i) => { const b = bins[Math.min(24, Math.floor(s * 25))]; if (labels?.[i]) b.pos++; else b.neg++; });
    return bins;
  }, [scores, labels]);
  const max = Math.max(1, ...hist.map((h) => h.pos + h.neg));
  const prev = (band: RiskBand) => {
    if (!scores || !labels) return null;
    let n = 0, p = 0;
    scores.forEach((s, i) => { if (assignBand(s, bands) === band) { n++; p += labels[i]; } });
    return { n, rate: n ? p / n : 0 };
  };
  return (
    <Card data-tour="predict-bands">
      <CardHeader title="Early risk stratification" subtitle="Drag the cut-points · histogram = validation probabilities" icon={<Layers size={16} />} />
      <div className="space-y-4 p-4">
        <div className="flex h-28 items-end gap-px" role="img" aria-label="Validation probability histogram coloured by risk band">
          {hist.map((h) => {
            const band = assignBand(h.x, bands);
            return (
              <div key={h.x} className="flex h-full flex-1 flex-col justify-end">
                <motion.div className="rounded-t-sm" animate={{ height: `${((h.pos + h.neg) / max) * 100}%`, backgroundColor: BAND_META[band].color }} transition={{ duration: 0.25 }} style={{ opacity: 0.85 }} />
              </div>
            );
          })}
        </div>
        <div ref={bar} className="relative h-4 rounded-full">
          <div className="absolute inset-y-0 left-0 rounded-l-full" style={{ width: `${bands.low[1] * 100}%`, background: BAND_META.low.color }} />
          <div className="absolute inset-y-0" style={{ left: `${bands.low[1] * 100}%`, width: `${(bands.moderate[1] - bands.low[1]) * 100}%`, background: BAND_META.moderate.color }} />
          <div className="absolute inset-y-0 right-0 rounded-r-full" style={{ left: `${bands.moderate[1] * 100}%`, background: BAND_META.high.color }} />
          {[0, 1].map((w) => {
            const v = w === 0 ? bands.low[1] : bands.moderate[1];
            return (
              <button key={w} role="slider" aria-label={w === 0 ? 'Low / moderate cut-point' : 'Moderate / high cut-point'} aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}
                onPointerDown={drag(w as 0 | 1)} onKeyDown={keyMove(w as 0 | 1)}
                className="absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border-[3px] border-surface bg-fg shadow-pop transition-transform hover:scale-110" style={{ left: `${v * 100}%` }}>
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-fg px-1.5 py-0.5 font-mono text-[10px] text-surface">{v.toFixed(2)}</span>
              </button>
            );
          })}
        </div>
        <div className="space-y-2">
          {(['low', 'moderate', 'high'] as RiskBand[]).map((b) => {
            const p = prev(b);
            return (
              <div key={b} className="rounded-lg border p-2.5" style={{ borderColor: `color-mix(in srgb, ${BAND_META[b].color} 35%, transparent)`, background: BAND_META[b].tint }}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold" style={{ color: BAND_META[b].color }}>{BAND_META[b].label} · {bands[b][0].toFixed(2)}–{bands[b][1].toFixed(2)}</span>
                  {p && <span className="tnum text-fg-2">{p.n} patients · <b>{(p.rate * 100).toFixed(0)}% actually positive</b></span>}
                </div>
                <input className="mt-1.5 w-full rounded-md border border-line bg-surface px-2 py-1 text-xs text-fg-2" value={actions[b]} onChange={(e) => onActions({ ...actions, [b]: e.target.value })} aria-label={`Recommended action for ${b} risk`} />
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

export { DEFAULT_ACTIONS };
