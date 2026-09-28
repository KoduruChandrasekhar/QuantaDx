/** Quantum Lab circuit model, presets and conversion to GateOps. */
import type { CircuitSpec, GateName, GateOp } from '@/types/quantum';
import { toQasm } from '@/lib/quantum/circuits';

export interface LabGate {
  id: string;
  name: GateName;
  wires: number[]; // [target] or [control, target]
  col: number;
  params?: number[];
}

export interface LabCircuit {
  n: number;
  gates: LabGate[];
}

export const COLS = 12;
export const PALETTE: GateName[] = ['H', 'X', 'Y', 'Z', 'S', 'T', 'RX', 'RY', 'RZ', 'P', 'CNOT', 'CZ', 'SWAP', 'MEASURE'];
export const TWO: GateName[] = ['CNOT', 'CZ', 'SWAP'];
export const PARAM: GateName[] = ['RX', 'RY', 'RZ', 'P'];

let uid = 0;
export const g = (name: GateName, wires: number[], col: number, params?: number[]): LabGate => ({ id: `lg${uid++}`, name, wires, col, params });

export function toOps(c: LabCircuit): GateOp[] {
  return c.gates.map((x) => ({ id: x.id, name: x.name, wires: x.wires, params: x.params, layer: x.col, role: x.name === 'MEASURE' ? 'measurement' : TWO.includes(x.name) ? 'entangling' : 'variational', paramRefs: x.params ? [x.params[0].toFixed(2)] : undefined }));
}

export function toSpec(c: LabCircuit): CircuitSpec {
  const ops = toOps(c);
  const spec: CircuitSpec = {
    nQubits: c.n, ops, depth: ops.reduce((m, o) => Math.max(m, o.layer + 1), 0), twoQubitGateCount: ops.filter((o) => o.wires.length > 1).length,
    nTrainableParams: ops.filter((o) => o.params).length, encoding: 'angle_ry',
  };
  spec.qasm = toQasm(spec);
  return spec;
}

const PATIENT = [2.41, 0.62, 1.88, 1.12];

export const PRESETS: { id: string; label: string; build: () => LabCircuit; lesson?: string }[] = [
  { id: 'superposition', label: 'Superposition', build: () => ({ n: 1, gates: [g('H', [0], 0)] }), lesson: 'superposition' },
  { id: 'bell', label: 'Bell state', build: () => ({ n: 2, gates: [g('H', [0], 0), g('CNOT', [0, 1], 1)] }), lesson: 'entanglement' },
  { id: 'ghz', label: 'GHZ (3 qubits)', build: () => ({ n: 3, gates: [g('H', [0], 0), g('CNOT', [0, 1], 1), g('CNOT', [1, 2], 2)] }) },
  { id: 'patient', label: 'Angle-encode a patient', build: () => ({ n: 4, gates: PATIENT.map((a, i) => g('RY', [i], 0, [a])) }), lesson: 'encoding' },
  { id: 'zz', label: 'ZZ feature map (2 qubits)', build: () => ({ n: 2, gates: [g('H', [0], 0), g('H', [1], 0), g('P', [0], 1, [2 * 1.2]), g('P', [1], 1, [2 * 0.7]), g('CNOT', [0, 1], 2), g('P', [1], 3, [2 * (Math.PI - 1.2) * (Math.PI - 0.7)]), g('CNOT', [0, 1], 4)] }) },
  { id: 'ra', label: 'One RealAmplitudes layer', build: () => ({ n: 3, gates: [g('RY', [0], 0, [0.8]), g('RY', [1], 0, [1.9]), g('RY', [2], 0, [0.4]), g('CNOT', [0, 1], 1), g('CNOT', [1, 2], 2), g('RY', [0], 3, [1.2]), g('RY', [1], 3, [0.3]), g('RY', [2], 3, [2.2]), g('MEASURE', [0], 4)] }), lesson: 'vqc' },
  { id: 'kernel', label: 'Kernel entry k(x, x′)', build: () => ({ n: 2, gates: [g('RY', [0], 0, [1.1]), g('RY', [1], 0, [2.0]), g('CNOT', [0, 1], 1), g('CNOT', [0, 1], 2), g('RY', [0], 3, [-0.9]), g('RY', [1], 3, [-1.7])] }), lesson: 'kernel' },
  { id: 'bandwidth', label: 'Bandwidth effect', build: () => ({ n: 2, gates: [g('RY', [0], 0, [0.2 * 2.4]), g('RY', [1], 0, [0.2 * 0.9]), g('CNOT', [0, 1], 1)] }), lesson: 'bandwidth' },
];

export const LESSONS: Record<string, { title: string; text: string; preset: string }> = {
  superposition: { title: 'Superposition', preset: 'superposition', text: 'H turns |0⟩ into (|0⟩+|1⟩)/√2: the Bloch arrow moves from the north pole to the equator and a measurement gives 0 or 1 with 50% each. Run “Measure” in the histogram to watch the counts converge.' },
  entanglement: { title: 'Entanglement', preset: 'bell', text: 'H then CNOT creates (|00⟩+|11⟩)/√2. Each qubit alone is completely random — both Bloch arrows shrink to the centre (|r| = 0) — yet the two results always agree. That correlation is entanglement.' },
  encoding: { title: 'How patient data becomes a quantum state', preset: 'patient', text: 'Four principal components of a patient record, scaled to [0, π], become RY rotation angles — one qubit per feature. Similar patients produce similar states.' },
  vqc: { title: 'How a variational classifier learns', preset: 'ra', text: 'Trainable RY angles plus CNOT entanglers form W(θ). The classical optimizer nudges θ so that ⟨Z₀⟩ is high for one class and low for the other; p = (1 + ⟨Z₀⟩)/2.' },
  kernel: { title: 'A quantum kernel entry', preset: 'kernel', text: 'Apply U(x), then the inverse U†(x′). The probability of returning to |00⟩ is the similarity k(x,x′) = |⟨φ(x)|φ(x′)⟩|². Identical patients give 1.' },
  bandwidth: { title: 'Why bandwidth matters', preset: 'bandwidth', text: 'Scaling features by a small bandwidth keeps rotations small, so different patients stay distinguishable instead of all looking orthogonal (kernel concentration). Compare with the “Angle-encode a patient” preset.' },
};
