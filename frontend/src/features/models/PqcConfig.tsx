/** Shared parameterised-circuit configuration: encoding, ansatz, entanglement, readout, optimiser, execution, mitigation, seed. */
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useState } from 'react';
import type { QuantumConfig } from '@/types/api';
import type { AnsatzKind, EncodingKind, Entanglement } from '@/types/quantum';
import { Card, CardHeader, NumberField, Segmented, Select, Slider, Switch, Tip, cn } from '@/components/common/ui';
import { Term } from '@/components/common/misc';
import { EntanglementMap } from '@/components/quantum/StateViews';
import { NoiseVisualizer } from '@/components/quantum/NoiseVisualizer';
import { gateColor } from '@/content/gates';
import type { GateName } from '@/types/quantum';

const ENCODINGS: { value: EncodingKind; label: string; strip: GateName[] }[] = [
  { value: 'angle_rx', label: 'Angle-RX', strip: ['RX'] }, { value: 'angle_ry', label: 'Angle-RY', strip: ['RY'] },
  { value: 'zz_feature_map', label: 'ZZFeatureMap', strip: ['H', 'P', 'CNOT', 'P', 'CNOT'] }, { value: 'pauli_feature_map', label: 'PauliFeatureMap', strip: ['H', 'P', 'RX', 'CNOT'] },
  { value: 'iqp', label: 'IQP', strip: ['H', 'RZ', 'CNOT', 'RZ'] }, { value: 'amplitude', label: 'Amplitude', strip: ['STATEPREP'] },
];
const ANSATZE: { value: AnsatzKind; label: string; strip: GateName[] }[] = [
  { value: 'real_amplitudes', label: 'RealAmplitudes', strip: ['RY', 'CNOT', 'RY'] }, { value: 'efficient_su2', label: 'EfficientSU2', strip: ['RY', 'RZ', 'CNOT'] },
  { value: 'strongly_entangling', label: 'StronglyEntangling', strip: ['Rot', 'CNOT'] }, { value: 'basic_entangler', label: 'BasicEntangler', strip: ['RX', 'CNOT'] },
];

function Strip({ gates }: { gates: GateName[] }) {
  return (
    <div className="flex items-center gap-0.5">
      {gates.map((g, i) => (
        <span key={i} className="rounded px-1 py-px font-mono text-[8.5px] font-bold text-white" style={{ background: gateColor(g) }}>{g === 'STATEPREP' ? 'Amp' : g === 'CNOT' ? '⊕' : g}</span>
      ))}
    </div>
  );
}

function PickCard<T extends string>({ items, value, onChange, cols = 3 }: { items: { value: T; label: string; strip: GateName[] }[]; value: T; onChange: (v: T) => void; cols?: number }) {
  return (
    <div className={cn('grid gap-2', cols === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2')}>
      {items.map((it) => (
        <motion.button key={it.value} whileTap={{ scale: 0.97 }} onClick={() => onChange(it.value)} aria-pressed={value === it.value}
          className={cn('relative rounded-lg border p-2 text-left transition', value === it.value ? 'border-quantum bg-tint-purple' : 'border-line hover:border-line-strong')}>
          <div className="mb-1.5 text-xs font-semibold text-fg">{it.label}</div>
          <Strip gates={it.strip} />
        </motion.button>
      ))}
    </div>
  );
}

export function PqcConfig({ q, set, nQubits, hasToken }: { q: QuantumConfig; set: (p: Partial<QuantumConfig>) => void; nQubits: number; hasToken: boolean }) {
  const [hoverEnt, setHoverEnt] = useState<Entanglement | null>(null);
  const ex = q.execution;
  const noise = { depolarizing: ex.noise?.depolarizing ?? 0.002, readout: ex.noise?.readout ?? 0.02, t1Us: ex.noise?.t1Us ?? 140, t2Us: ex.noise?.t2Us ?? 70 };
  return (
    <Card data-tour="models-pqc">
      <CardHeader title="Parameterised quantum circuit" subtitle="Shared by all quantum / hybrid models (per-model overrides via hyperparameters)" />
      <div className="space-y-5 p-4">
        <section>
          <div className="mb-2 text-xs font-semibold text-fg-2">Encoding · <Term term="Feature map" /></div>
          <PickCard items={ENCODINGS} value={q.encoding} onChange={(v) => set({ encoding: v })} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Slider label="Reps" value={q.encodingReps} min={1} max={4} onChange={(v) => set({ encodingReps: v })} accent="var(--purple)" />
            <Slider label={<Term term="Bandwidth">Bandwidth</Term>} value={q.kernelBandwidth ?? 1} min={0.05} max={1} step={0.05} onChange={(v) => set({ kernelBandwidth: v })} format={(v) => v.toFixed(2)} accent="var(--purple)" />
          </div>
        </section>
        <section>
          <div className="mb-2 text-xs font-semibold text-fg-2">Ansatz · <Term term="Ansatz">W(θ)</Term></div>
          <PickCard items={ANSATZE} value={q.ansatz} onChange={(v) => set({ ansatz: v })} cols={2} />
          <Slider className="mt-3" label="Layers" value={q.layers} min={1} max={6} onChange={(v) => set({ layers: v })} accent="var(--blue)" hint={q.layers >= 5 ? '⚠ Deep ansätze risk barren plateaus — gradients vanish exponentially.' : undefined} />
        </section>
        <section className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-2 text-xs font-semibold text-fg-2">Entanglement</div>
            <div className="flex flex-wrap gap-1.5">
              {(['linear', 'circular', 'full', 'pairwise'] as Entanglement[]).map((e) => (
                <button key={e} onMouseEnter={() => setHoverEnt(e)} onMouseLeave={() => setHoverEnt(null)} onClick={() => set({ entanglement: e })} aria-pressed={q.entanglement === e}
                  className={cn('rounded-full border px-3 py-1 text-xs font-medium capitalize transition', q.entanglement === e ? 'border-navy bg-navy text-white' : 'border-line text-fg-2 hover:border-navy')}>{e}</button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Select label="Readout" value={q.readout} onChange={(v) => set({ readout: v })} options={[{ value: 'expval_z0', label: '⟨Z₀⟩ → probability' }, { value: 'parity', label: 'Parity' }, { value: 'multi_expval', label: 'Multi-qubit ⟨Z⟩ → head' }]} />
              <Select label="Optimizer" value={q.optimizer} onChange={(v) => set({ optimizer: v })} options={[{ value: 'cobyla', label: 'COBYLA' }, { value: 'spsa', label: 'SPSA (noisy / hardware)' }, { value: 'adam', label: 'Adam' }, { value: 'lbfgsb', label: 'L-BFGS-B' }]} />
              <Select label="Gradient" value={q.gradient} onChange={(v) => set({ gradient: v })} options={[{ value: 'parameter_shift', label: 'Parameter-shift' }, { value: 'adjoint', label: 'Adjoint (simulator)' }, { value: 'finite_diff', label: 'Finite difference' }]} />
              <NumberField label="Max iterations" value={q.maxIter} min={10} max={1000} step={10} onChange={(v) => set({ maxIter: v })} />
              <NumberField label="Learning rate" value={q.learningRate ?? 0.05} min={0.001} max={1} step={0.005} onChange={(v) => set({ learningRate: v })} />
              <NumberField label="Seed" value={q.seed} onChange={(v) => set({ seed: v })} />
            </div>
          </div>
          <div className="flex flex-col items-center justify-center rounded-lg bg-surface-2 p-2">
            <EntanglementMap key={hoverEnt ?? q.entanglement} n={Math.min(nQubits, 10)} kind={hoverEnt ?? q.entanglement} size={150} />
            <span className="text-[10px] capitalize text-muted">{hoverEnt ?? q.entanglement} preview</span>
          </div>
        </section>
        <section>
          <div className="mb-2 text-xs font-semibold text-fg-2">Execution</div>
          <Segmented value={ex.backend} onChange={(b) => (b === 'hardware' && !hasToken ? undefined : set({ execution: { ...ex, backend: b } }))} options={[
            { value: 'statevector', label: 'Statevector' }, { value: 'shots', label: 'Shots' }, { value: 'noisy', label: 'Noisy sim' },
            { value: 'hardware', label: <Tip text={hasToken ? 'IBM Quantum Runtime' : 'Add an IBM Quantum token in Settings to enable hardware runs'}><span className="flex items-center gap-1">{!hasToken && <Lock size={11} />}Hardware</span></Tip> },
          ]} />
          <div className="mt-3 space-y-3">
            {(ex.backend === 'shots' || ex.backend === 'noisy' || ex.backend === 'hardware') && (
              <Slider label="Shots" value={Math.log2(ex.shots ?? 1024)} min={8} max={13} onChange={(v) => set({ execution: { ...ex, shots: 2 ** v } })} format={() => String(ex.shots ?? 1024)} accent="var(--green)" />
            )}
            {ex.backend === 'noisy' && (
              <div className="rounded-lg border border-line p-3">
                <Select className="mb-3 w-56" label="Device noise model" value={ex.noise?.deviceModel ?? 'fake_manila'} onChange={(v) => set({ execution: { ...ex, noise: { ...noise, deviceModel: v } } })} options={[{ value: 'fake_manila', label: 'fake_manila (5q)' }, { value: 'fake_brisbane', label: 'fake_brisbane (127q)' }, { value: 'custom', label: 'Custom' }]} />
                <NoiseVisualizer noise={noise} onChange={(n) => set({ execution: { ...ex, noise: { ...n, deviceModel: ex.noise?.deviceModel } } })} experimentId="exp-poc-001" />
              </div>
            )}
            {ex.backend === 'hardware' && (
              <Select className="w-56" label="Device" value={ex.deviceName ?? 'ibm_brisbane'} onChange={(v) => set({ execution: { ...ex, deviceName: v } })} options={[{ value: 'ibm_brisbane', label: 'ibm_brisbane (127q)' }, { value: 'ibm_kyiv', label: 'ibm_kyiv (127q)' }]} />
            )}
            <div className="flex flex-wrap gap-4">
              <Switch checked={!!ex.mitigation?.readout} onChange={(v) => set({ execution: { ...ex, mitigation: { readout: v, zne: !!ex.mitigation?.zne } } })} label={<Term term="Readout error">Readout mitigation</Term>} color="var(--green)" />
              <Switch checked={!!ex.mitigation?.zne} onChange={(v) => set({ execution: { ...ex, mitigation: { readout: !!ex.mitigation?.readout, zne: v } } })} label={<Term term="ZNE">Zero-noise extrapolation</Term>} color="var(--green)" />
            </div>
          </div>
        </section>
      </div>
    </Card>
  );
}
