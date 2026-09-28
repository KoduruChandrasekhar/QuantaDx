/** EncodingVisualizer (Section 8.7, D2 "Data encoding"): angle, ZZ feature map and amplitude encoding of a real patient. */
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import type { PreprocessPreview } from '@/types/api';
import { buildCircuit } from '@/lib/quantum/circuits';
import { simulate } from '@/lib/quantum/simulator';
import { entanglementPairs } from '@/lib/quantum/circuits';
import { useReducedMotion } from '@/hooks';
import { Segmented, Select, Slider, cn } from '../common/ui';
import { Tex } from '../common/misc';
import { BlochGrid } from './Bloch';
import { CircuitViewer } from './CircuitViewer';
import { StateBars } from './StateViews';

type Tab = 'angle' | 'zz' | 'amplitude';

export function EncodingVisualizer({ sample, featureLabels, bandwidth, onBandwidth, patient, onPatient }: {
  sample: PreprocessPreview['encodedSample'];
  featureLabels: string[];
  bandwidth: number;
  onBandwidth: (b: number) => void;
  patient: number;
  onPatient: (i: number) => void;
}) {
  const [tab, setTab] = useState<Tab>('angle');
  const [hoverPair, setHoverPair] = useState<number | null>(null);
  const x = useMemo(() => sample.x[patient] ?? [], [sample, patient]);
  const n = x.length;
  const bx = x.map((v) => v * bandwidth);

  const angleVecs = bx.map((t) => ({ x: Math.sin(t), y: 0, z: Math.cos(t) }));
  const zz = useMemo(() => {
    const spec = buildCircuit({ nQubits: n, encoding: 'zz_feature_map', encodingReps: 2, bandwidth, x, ansatz: null, measure: false });
    return { spec, sim: simulate(n, spec.ops) };
  }, [n, bandwidth, x]);
  const pairs = entanglementPairs(n, 'linear');

  const options = sample.ids.slice(0, 16).map((id, i) => ({ value: String(i), label: `${id} · ${sample.y[i] === 1 ? 'positive' : 'negative'}` }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Segmented value={tab} onChange={setTab} options={[{ value: 'angle', label: 'Angle' }, { value: 'zz', label: 'ZZ feature map' }, { value: 'amplitude', label: 'Amplitude' }]} />
        <Select className="w-56" label="Patient (test split)" value={String(patient)} onChange={(v) => onPatient(Number(v))} options={options} />
        <Slider className="min-w-[220px] flex-1" label="Kernel bandwidth b (features × b before encoding)" value={bandwidth} min={0.05} max={1} step={0.01} onChange={onBandwidth} format={(v) => v.toFixed(2)} accent="var(--purple)" />
      </div>

      {tab === 'angle' && (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <BlochGrid vectors={angleVecs} size={118} labels={Array.from({ length: n }, (_, i) => `q${i}`)} sublabels={featureLabels} />
          <div className="space-y-1.5 text-xs">
            <div className="font-semibold text-fg-2">Each scaled feature becomes a rotation</div>
            {x.map((v, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1 font-mono text-[11px]">
                <span className="w-24 truncate text-muted" title={featureLabels[i]}>{featureLabels[i]?.split(' · ')[0]}</span>
                <span className="text-fg">{v.toFixed(2)}</span>
                <span className="text-muted">× {bandwidth.toFixed(2)} →</span>
                <span className="text-quantum">RY({(v * bandwidth).toFixed(2)})</span>
                <span className="text-muted">on q{i}</span>
              </div>
            ))}
            <p className="pt-1 text-muted">
              e.g. <span className="font-mono">{sample.rawNames[0]} = {String(sample.raw[patient]?.[0] ?? '—')}</span> → standardise → PCA → MinMax [0, π] → angle. Smaller bandwidth ⇒ arrows stay near |0⟩.
            </p>
          </div>
        </div>
      )}

      {tab === 'zz' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-surface-2 p-3 text-sm">
            <Tex block>{'U_{\\phi}(x)=\\Big[\\prod_{(i,j)} \\mathrm{CNOT}_{ij}\\,P\\big(2(\\pi-x_i)(\\pi-x_j)\\big)_j\\,\\mathrm{CNOT}_{ij}\\prod_i P(2x_i)\\,H^{\\otimes n}\\Big]^{\\text{reps}=2}'}</Tex>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pairs.map(([a, b], k) => {
                const phi = 2 * (Math.PI - bx[a]) * (Math.PI - bx[b]);
                return (
                  <button key={k} onMouseEnter={() => setHoverPair(k)} onMouseLeave={() => setHoverPair(null)}
                    className={cn('rounded-md border px-2 py-1 font-mono text-[11px] transition', hoverPair === k ? 'border-quantum bg-tint-purple text-quantum' : 'border-line bg-surface text-fg-2')}>
                    φ<sub>{a}{b}</sub> = 2(π−{bx[a].toFixed(2)})(π−{bx[b].toFixed(2)}) = {phi.toFixed(2)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="mb-1 text-xs font-semibold text-fg-2">Per-qubit state after encoding (shorter arrow ⇒ entangled)</div>
              <BlochGrid vectors={zz.sim.bloch} size={108} highlight={hoverPair !== null ? pairs[hoverPair][1] : null} />
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-fg-2">Basis-state probabilities</div>
              <StateBars re={zz.sim.re} im={zz.sim.im} n={n} height={140} />
            </div>
          </div>
          <CircuitViewer spec={zz.spec} compact featureLabels={featureLabels.map((f) => f.split(' · ')[0])} maxHeight={320} title="zz-feature-map" />
        </div>
      )}

      {tab === 'amplitude' && <AmplitudeView sample={sample} patient={patient} />}
    </div>
  );
}

function AmplitudeView({ sample, patient }: { sample: PreprocessPreview['encodedSample']; patient: number }) {
  const reduced = useReducedMotion();
  const [showAmps, setShowAmps] = useState(false);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setShowAmps((s) => !s), 2600);
    return () => clearInterval(id);
  }, [reduced]);
  const d = sample.rawNames.length;
  const nq = Math.ceil(Math.log2(Math.max(2, d)));
  const { feats, amps } = useMemo(() => {
    const cols = Array.from({ length: d }, (_, j) => sample.raw.map((r) => r[j] ?? 0));
    const mm = cols.map((c) => [Math.min(...c), Math.max(...c)] as const);
    const f = (sample.raw[patient] ?? []).map((v, j) => ((v ?? mm[j][0]) - mm[j][0]) / (mm[j][1] - mm[j][0] || 1));
    const padded = [...f, ...new Array<number>(2 ** nq - f.length).fill(0)];
    const norm = Math.sqrt(padded.reduce((s, v) => s + v * v, 0)) || 1;
    return { feats: padded, amps: padded.map((v) => v / norm) };
  }, [sample, patient, d, nq]);
  const vals = showAmps ? amps : feats;
  const max = Math.max(...vals, 0.01);
  const re = new Float64Array(amps);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-tint-teal px-2.5 py-1 text-xs font-semibold text-hybrid">{d} features → {nq} qubits (log₂ saving)</span>
          <button onClick={() => setShowAmps((s) => !s)} className="text-xs text-classical hover:underline">{showAmps ? 'show scaled features' : 'show amplitudes'}</button>
        </div>
        <div className="flex h-40 items-end gap-[2px]" role="img" aria-label={showAmps ? 'Normalised amplitudes' : 'Scaled features'}>
          {vals.map((v, i) => (
            <motion.div key={i} className="flex-1 rounded-t" initial={false} animate={{ height: `${(v / max) * 100}%`, backgroundColor: i >= d ? 'var(--line-strong)' : showAmps ? 'var(--teal)' : 'var(--blue)' }}
              transition={{ type: 'spring', stiffness: 140, damping: 20, delay: reduced ? 0 : i * 0.008 }} title={`${i < d ? sample.rawNames[i] : 'padding'}: ${v.toFixed(3)}`} style={{ minHeight: 1 }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted"><span>feature 0</span><span>{showAmps ? 'Σ aᵢ² = 1' : 'MinMax-scaled values'}</span><span>index {2 ** nq - 1} (padding grey)</span></div>
        <div className="mt-3 text-sm text-fg-2"><Tex>{'|x\\rangle=\\sum_{i=0}^{2^n-1}\\frac{x_i}{\\lVert x\\rVert}\\,|i\\rangle'}</Tex></div>
      </div>
      <div>
        <div className="mb-1 text-xs font-semibold text-fg-2">Resulting {nq}-qubit state (top 16)</div>
        <StateBars re={re} im={new Float64Array(re.length)} n={nq} height={130} />
        <p className="mt-2 text-[11px] text-muted">Exponentially compact, but state preparation needs O(2ⁿ) gates — which is why angle / ZZ encodings are preferred on NISQ hardware.</p>
      </div>
    </div>
  );
}
