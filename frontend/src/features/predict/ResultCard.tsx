/** D4 result: animated gauge, band + action, uncertainty interval, top factors with mini waterfall, quantum view, PDF report. */
import { AnimatePresence, motion } from 'framer-motion';
import { Atom, ChevronDown, FileDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Prediction } from '@/types/api';
import { BAND_META, type RiskBand, type RiskBands } from '@/lib/risk';
import { buildCircuit } from '@/lib/quantum/circuits';
import { simulate } from '@/lib/quantum/simulator';
import { dateTime, prettyName } from '@/lib/format';
import { Report } from '@/lib/report';
import { Button, Card, CardHeader } from '@/components/common/ui';
import { RiskBadge } from '@/components/common/misc';
import { RiskGauge } from '@/components/common/RiskGauge';
import { BlochGrid } from '@/components/quantum/Bloch';
import { CircuitViewer } from '@/components/quantum/CircuitViewer';

export async function patientPdf(p: Prediction, inputs: Record<string, number>, actions: Record<RiskBand, string>, quantum: boolean) {
  const rep = await Report.create('Patient risk report', `${p.modelLabel} · ${dateTime(p.timestamp)}`);
  rep.heading('Result');
  if (p.probability !== undefined) rep.paragraph(`Estimated probability: ${(p.probability * 100).toFixed(1)}% (${p.uncertainty ? `interval ${(p.uncertainty.lower * 100).toFixed(1)}–${(p.uncertainty.upper * 100).toFixed(1)}%, ${p.uncertainty.method.replace('_', ' ')}` : ''}). Decision threshold ${p.threshold.toFixed(2)} → ${p.decision ? 'POSITIVE screen' : 'negative screen'}.`);
  else rep.paragraph(`Predicted score: ${p.value} (interval ${p.uncertainty?.lower}–${p.uncertainty?.upper}).`);
  if (p.riskBand) rep.paragraph(`Risk band: ${BAND_META[p.riskBand].label}. Recommended action: ${actions[p.riskBand]}`);
  rep.heading('Top contributing factors');
  rep.bullets(p.topFactors.map((f) => f.text));
  rep.heading('Inputs');
  rep.table(['Feature', 'Value'], Object.entries(inputs).map(([k, v]) => [prettyName(k), v]), [120, 62]);
  rep.heading('Model');
  rep.paragraph(`${p.modelLabel} (${quantum ? 'quantum/hybrid' : 'classical'}) · backend ${p.backend} · ${p.timestamp}`);
  rep.heading('Disclaimer');
  rep.paragraph('Decision-support research prototype. Not a medical diagnosis. Consult a qualified clinician.');
  rep.save(`quantadx-patient-report-${Date.now()}.pdf`);
}

export function ResultCard({ p, bands, actions, inputs, quantum }: { p: Prediction; bands: RiskBands; actions: Record<RiskBand, string>; inputs: Record<string, number>; quantum: boolean }) {
  const [showQ, setShowQ] = useState(false);
  const x = useMemo(() => p.encodedX ?? [], [p.encodedX]);
  const bloch = useMemo(() => {
    if (!x.length) return [];
    const spec = buildCircuit({ nQubits: x.length, encoding: 'zz_feature_map', encodingReps: 2, bandwidth: 0.2, x, ansatz: null, measure: false, qasm: false });
    return simulate(x.length, spec.ops).bloch;
  }, [x]);
  const circuit = useMemo(() => (x.length ? buildCircuit({ nQubits: x.length, encoding: 'zz_feature_map', encodingReps: 1, bandwidth: 0.2, x, ansatz: 'real_amplitudes', layers: 1 }) : null), [x]);
  const maxC = Math.max(...p.topFactors.map((f) => Math.abs(f.contribution)), 1e-9);
  const band = p.riskBand;
  return (
    <Card className="overflow-hidden" data-tour="predict-result">
      <CardHeader title="Result" subtitle={`${p.modelLabel} · ${p.backend} · ${dateTime(p.timestamp)}`} actions={<Button size="sm" variant="outline" icon={<FileDown size={14} />} onClick={() => patientPdf(p, inputs, actions, quantum)}>PDF report</Button>} />
      {band && <motion.div className="h-1" style={{ background: BAND_META[band].color }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8 }} />}
      <div className="grid gap-5 p-4 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center">
          {p.probability !== undefined ? <RiskGauge value={p.probability} bands={bands} threshold={p.threshold} size={250} /> : (
            <div className="w-64 py-6 text-center">
              <div className="metric text-5xl font-bold text-hybrid">{p.value}</div>
              <div className="text-xs text-muted">predicted total UPDRS</div>
              <div className="relative mt-5 h-3 rounded-full" style={{ background: 'linear-gradient(90deg, var(--green) 0% 30%, var(--saffron) 30% 65%, var(--red) 65% 100%)' }}>
                <motion.div className="absolute -top-1 h-5 w-1.5 rounded bg-fg" initial={{ left: 0 }} animate={{ left: `${((p.value ?? 0) / 60) * 100}%` }} transition={{ type: 'spring', stiffness: 60 }} />
                {p.uncertainty && <div className="absolute -bottom-2 h-1 rounded bg-fg/40" style={{ left: `${(p.uncertainty.lower / 60) * 100}%`, width: `${((p.uncertainty.upper - p.uncertainty.lower) / 60) * 100}%` }} />}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-muted"><span>mild &lt; 18</span><span>moderate</span><span>severe &gt; 39</span></div>
            </div>
          )}
          {band && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, type: 'spring' }} className="flex flex-col items-center gap-2">
              <RiskBadge band={band} size="lg" />
              <div className="max-w-[240px] text-center text-sm font-medium text-fg-2">{actions[band]}</div>
            </motion.div>
          )}
          {p.uncertainty && p.probability !== undefined && (
            <div className="mt-3 w-full max-w-[250px]">
              <div className="mb-1 flex justify-between text-[10px] text-muted"><span>uncertainty ({p.uncertainty.method.replace('_', ' ')})</span><span className="tnum">{(p.uncertainty.lower * 100).toFixed(1)}–{(p.uncertainty.upper * 100).toFixed(1)}%</span></div>
              <div className="relative h-2 rounded-full bg-surface-3">
                <motion.div className="absolute inset-y-0 rounded-full bg-quantum/40" initial={{ left: '50%', width: 0 }} animate={{ left: `${p.uncertainty.lower * 100}%`, width: `${(p.uncertainty.upper - p.uncertainty.lower) * 100}%` }} transition={{ delay: 0.5 }} />
                <div className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-quantum" style={{ left: `${p.probability * 100}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="text-sm font-semibold text-fg">Top contributing factors</div>
          {p.topFactors.map((f, i) => (
            <motion.div key={f.feature} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.12 }} className="rounded-lg bg-surface-2 p-2.5">
              <div className="flex items-start gap-2 text-sm text-fg-2"><span className={f.contribution >= 0 ? 'text-danger' : 'text-ok'}>{f.contribution >= 0 ? '▲' : '▼'}</span>{f.text}</div>
              <div className="ml-5 mt-1.5 flex items-center gap-1">
                <div className="relative h-1.5 flex-1 rounded-full bg-surface-3">
                  <motion.div className="absolute inset-y-0 rounded-full" style={{ background: f.contribution >= 0 ? 'var(--red)' : 'var(--blue)', left: f.contribution >= 0 ? '50%' : undefined, right: f.contribution < 0 ? '50%' : undefined }} initial={{ width: 0 }} animate={{ width: `${(Math.abs(f.contribution) / maxC) * 50}%` }} transition={{ delay: 0.5 + i * 0.12 }} />
                  <div className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                </div>
              </div>
            </motion.div>
          ))}
          {x.length > 0 && (
            <div className="rounded-xl border border-quantum/30">
              <button className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-quantum" onClick={() => setShowQ((s) => !s)} aria-expanded={showQ}>
                <Atom size={15} /> How the quantum model saw this patient
                <ChevronDown size={15} className={`ml-auto transition ${showQ ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showQ && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="space-y-3 border-t border-quantum/20 p-3">
                      {!quantum && <p className="text-[11px] text-muted">The deployed model is classical; this is how the 6-qubit feature map would encode the same patient.</p>}
                      <BlochGrid vectors={bloch} size={84} />
                      {circuit && <CircuitViewer spec={circuit} compact toolbar={false} maxHeight={260} />}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
