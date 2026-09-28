/** NoiseVisualizer (Section 8.11): depolarizing shrinks the Bloch vector, T1 drifts to |0⟩, T2 dephases, readout blurs the histogram. */
import { Zap } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { basisLabel, simulate } from '@/lib/quantum/simulator';
import type { GateOp } from '@/types/quantum';
import { Slider } from '../common/ui';
import { Bloch } from './Bloch';

export interface NoiseParams {
  depolarizing: number;
  readout: number;
  t1Us: number;
  t2Us: number;
}

const GATE_TIME_US = 0.35; // effective duration of the demo circuit per layer

const OPS: GateOp[] = [
  { id: 'a', name: 'H', wires: [0], role: 'encoding', layer: 0 },
  { id: 'b', name: 'RY', wires: [0], params: [0.6], role: 'variational', layer: 1 },
  { id: 'c', name: 'CNOT', wires: [0, 1], role: 'entangling', layer: 2 },
  { id: 'd', name: 'RY', wires: [1], params: [0.9], role: 'variational', layer: 3 },
];
const TWO = simulate(2, OPS).probabilities;

export function NoiseVisualizer({ noise, onChange, experimentId }: { noise: NoiseParams; onChange: (n: NoiseParams) => void; experimentId?: string }) {
  const ideal = useMemo(() => simulate(1, [{ id: 'h', name: 'RY', wires: [0], params: [1.1], role: 'variational', layer: 0 }, { id: 'z', name: 'RZ', wires: [0], params: [0.8], role: 'variational', layer: 1 }]).bloch[0], []);
  const two = TWO;
  const layers = 4;
  const t = layers * GATE_TIME_US * 40; // amplified for visibility
  const shrink = (1 - noise.depolarizing) ** (layers * 10);
  const e1 = Math.exp(-t / noise.t1Us);
  const e2 = Math.exp(-t / noise.t2Us);
  const noisy = { x: ideal.x * shrink * e2, y: ideal.y * shrink * e2, z: (1 - (1 - ideal.z) * e1) * shrink };
  const blurred = two.map((_, i) => {
    // independent readout flips per bit + depolarizing mixing toward uniform
    let q = 0;
    for (let j = 0; j < two.length; j++) {
      let pr = 1;
      for (let b = 0; b < 2; b++) pr *= ((i >> b) & 1) === ((j >> b) & 1) ? 1 - noise.readout : noise.readout;
      q += two[j] * pr;
    }
    return q * shrink + (1 - shrink) / two.length;
  });
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
      <div className="space-y-3">
        <Slider label="Depolarizing p (per gate)" value={noise.depolarizing} min={0} max={0.03} step={0.0005} onChange={(v) => onChange({ ...noise, depolarizing: v })} format={(v) => v.toFixed(4)} accent="var(--red)" />
        <Slider label="Readout error" value={noise.readout} min={0} max={0.15} step={0.005} onChange={(v) => onChange({ ...noise, readout: v })} format={(v) => `${(v * 100).toFixed(1)}%`} accent="var(--saffron)" />
        <Slider label="T1 (µs)" value={noise.t1Us} min={10} max={400} step={5} onChange={(v) => onChange({ ...noise, t1Us: v })} accent="var(--blue)" />
        <Slider label="T2 (µs)" value={noise.t2Us} min={5} max={300} step={5} onChange={(v) => onChange({ ...noise, t2Us: v })} accent="var(--teal)" />
        {experimentId && (
          <Link to={`/experiments/${experimentId}/results#noise`} className="inline-flex items-center gap-1 text-xs font-medium text-classical hover:underline">
            <Zap size={12} /> See the noise-robustness benchmark
          </Link>
        )}
      </div>
      <div className="flex gap-2">
        <Bloch vector={ideal} size={130} compact label="ideal" />
        <Bloch vector={noisy} size={130} compact label="noisy" color="var(--red)" />
      </div>
      <div>
        <div className="mb-1 text-[11px] font-medium text-muted">2-qubit read-out: ideal (outline) vs noisy (filled)</div>
        <div className="flex h-24 items-end gap-2">
          {two.map((p, i) => (
            <div key={i} className="relative flex h-full flex-1 flex-col justify-end">
              <div className="absolute inset-x-0 bottom-0 rounded-t border-2 border-dashed border-fg-2/60" style={{ height: `${p * 100}%` }} />
              <div className="rounded-t bg-danger/60 transition-all duration-300" style={{ height: `${blurred[i] * 100}%` }} />
              <span className="mt-1 text-center font-mono text-[10px] text-muted">{basisLabel(i, 2)}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1 font-mono text-[10px] text-muted">
          {['H', 'RY', 'CX', 'RY'].map((g, i) => (
            <span key={i} className="flex items-center gap-0.5 rounded bg-surface-3 px-1.5 py-0.5">
              {g} <Zap size={9} className="text-danger" style={{ opacity: Math.min(1, noise.depolarizing * 60 + 0.15) }} />
            </span>
          ))}
          <span className="ml-1">noise after every gate</span>
        </div>
      </div>
    </div>
  );
}
