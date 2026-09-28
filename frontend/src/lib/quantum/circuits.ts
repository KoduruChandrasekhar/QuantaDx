/** Builds parameterised quantum circuits (feature maps + ansätze) as GateOp lists with column layout. */
import type { AnsatzKind, CircuitBlock, CircuitSpec, EncodingKind, Entanglement, GateName, GateOp, GateRole } from '@/types/quantum';
import { mulberry32 } from '../prng';

const SUB = '₀₁₂₃₄₅₆₇₈₉';
export const sub = (n: number) => String(n).split('').map((d) => SUB[Number(d)]).join('');

export function entanglementPairs(n: number, kind: Entanglement): [number, number][] {
  const pairs: [number, number][] = [];
  if (n < 2) return pairs;
  if (kind === 'full') {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  } else if (kind === 'pairwise') {
    for (let i = 0; i + 1 < n; i += 2) pairs.push([i, i + 1]);
    for (let i = 1; i + 1 < n; i += 2) pairs.push([i, i + 1]);
  } else {
    for (let i = 0; i + 1 < n; i++) pairs.push([i, i + 1]);
    if (kind === 'circular' && n > 2) pairs.push([n - 1, 0]);
  }
  return pairs;
}

class Layout {
  next: number[];
  ops: GateOp[] = [];
  blocks: CircuitBlock[] = [];
  private id = 0;
  private blockStart = 0;
  private blockLabel = '';
  private blockRole: GateRole = 'encoding';

  constructor(n: number) {
    this.next = new Array<number>(n).fill(0);
  }

  add(name: GateName, wires: number[], role: GateRole, params?: number[], paramRefs?: string[]): void {
    const lo = Math.min(...wires);
    const hi = Math.max(...wires);
    const span = name === 'STATEPREP' ? this.next.map((_, i) => i) : Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    const layer = Math.max(...span.map((w) => this.next[w]));
    for (const w of span) this.next[w] = layer + 1;
    this.ops.push({ id: `g${this.id++}`, name, wires, params, paramRefs, role, layer, block: this.blockLabel });
  }

  begin(label: string, role: GateRole): void {
    this.align();
    this.blockStart = Math.max(0, ...this.next);
    this.blockLabel = label;
    this.blockRole = role;
  }

  end(): void {
    const end = Math.max(...this.next) - 1;
    if (end >= this.blockStart) this.blocks.push({ label: this.blockLabel, start: this.blockStart, end, role: this.blockRole });
  }

  align(): void {
    const m = Math.max(0, ...this.next);
    this.next.fill(m);
  }
}

export interface BuildOptions {
  nQubits: number;
  encoding: EncodingKind;
  encodingReps?: number;
  bandwidth?: number;
  entanglement?: Entanglement;
  ansatz?: AnsatzKind | null;
  layers?: number;
  x?: number[]; // scaled features, one per qubit (amplitude: any length)
  theta?: number[];
  measure?: boolean;
  seed?: number;
  qasm?: boolean;
}

export function ansatzParamCount(kind: AnsatzKind, n: number, layers: number): number {
  switch (kind) {
    case 'real_amplitudes': return n * (layers + 1);
    case 'efficient_su2': return 2 * n * (layers + 1);
    case 'strongly_entangling': return 3 * n * layers;
    case 'basic_entangler': return n * layers;
  }
}

export function randomTheta(count: number, seed = 7): number[] {
  const r = mulberry32(seed);
  return Array.from({ length: count }, () => r() * 2 * Math.PI);
}

export function encodingQubits(encoding: EncodingKind, nFeatures: number): number {
  return encoding === 'amplitude' ? Math.max(1, Math.ceil(Math.log2(Math.max(2, nFeatures)))) : nFeatures;
}

export function addEncoding(L: Layout, o: Required<Pick<BuildOptions, 'nQubits' | 'encoding' | 'encodingReps' | 'bandwidth' | 'entanglement'>>, x: number[]): void {
  const { nQubits: n, encoding, encodingReps: reps, bandwidth: bw, entanglement } = o;
  const xi = (i: number) => (x[i] ?? 0) * bw;
  const xs = (i: number) => `x${sub(i)}`;
  if (encoding === 'amplitude') {
    L.begin(`Encoding: amplitude (${x.length} features → ${n} qubits)`, 'encoding');
    const amps = new Array<number>(1 << n).fill(0).map((_, i) => x[i] ?? 0);
    L.add('STATEPREP', Array.from({ length: n }, (_, i) => i), 'encoding', amps, ['|x⟩']);
    L.end();
    return;
  }
  const pairs = entanglementPairs(n, entanglement);
  for (let r = 0; r < reps; r++) {
    const name =
      encoding === 'angle_rx' ? 'Angle-RX' : encoding === 'angle_ry' ? 'Angle-RY' : encoding === 'zz_feature_map' ? 'ZZFeatureMap' : encoding === 'pauli_feature_map' ? 'PauliFeatureMap' : 'IQP';
    L.begin(`Encoding: ${name}${reps > 1 ? ` rep ${r + 1}` : ''}`, 'encoding');
    if (encoding === 'angle_rx' || encoding === 'angle_ry') {
      for (let i = 0; i < n; i++) L.add(encoding === 'angle_rx' ? 'RX' : 'RY', [i], 'encoding', [xi(i)], [xs(i)]);
    } else {
      for (let i = 0; i < n; i++) L.add('H', [i], 'encoding');
      for (let i = 0; i < n; i++) {
        if (encoding === 'iqp') L.add('RZ', [i], 'encoding', [xi(i)], [xs(i)]);
        else L.add('P', [i], 'encoding', [2 * xi(i)], [`2${xs(i)}`]);
        if (encoding === 'pauli_feature_map') L.add('RX', [i], 'encoding', [xi(i)], [xs(i)]);
      }
      for (const [a, b] of pairs) {
        L.add('CNOT', [a, b], 'entangling');
        if (encoding === 'iqp') L.add('RZ', [b], 'encoding', [xi(a) * xi(b)], [`${xs(a)}${xs(b)}`]);
        else L.add('P', [b], 'encoding', [2 * (Math.PI - xi(a)) * (Math.PI - xi(b))], [`2(π−${xs(a)})(π−${xs(b)})`]);
        L.add('CNOT', [a, b], 'entangling');
      }
    }
    L.end();
  }
}

function addAnsatz(L: Layout, n: number, kind: AnsatzKind, layers: number, ent: Entanglement, theta: number[]): void {
  let k = 0;
  const th = () => {
    const v = theta[k] ?? 0;
    const ref = `θ${sub(k)}`;
    k++;
    return { v, ref };
  };
  const rot = (g: GateName, q: number) => {
    const t = th();
    L.add(g, [q], 'variational', [t.v], [t.ref]);
  };
  const pairs = entanglementPairs(n, kind === 'basic_entangler' ? 'circular' : ent);
  const title = { real_amplitudes: 'RealAmplitudes', efficient_su2: 'EfficientSU2', strongly_entangling: 'StronglyEntangling', basic_entangler: 'BasicEntangler' }[kind];
  for (let l = 0; l < layers; l++) {
    L.begin(`Ansatz layer ${l + 1}: ${title}`, 'variational');
    for (let q = 0; q < n; q++) {
      if (kind === 'real_amplitudes') rot('RY', q);
      else if (kind === 'efficient_su2') {
        rot('RY', q);
        rot('RZ', q);
      } else if (kind === 'basic_entangler') rot('RX', q);
      else {
        const a = th(), b = th(), c = th();
        L.add('Rot', [q], 'variational', [a.v, b.v, c.v], [a.ref, b.ref, c.ref]);
      }
    }
    if (kind === 'strongly_entangling') {
      const r = n > 1 ? (l % (n - 1)) + 1 : 0;
      if (n > 1) for (let q = 0; q < n; q++) L.add('CNOT', [q, (q + r) % n], 'entangling');
    } else for (const [a, b] of pairs) L.add('CNOT', [a, b], 'entangling');
    L.end();
  }
  if (kind === 'real_amplitudes' || kind === 'efficient_su2') {
    L.begin('Ansatz: final rotations', 'variational');
    for (let q = 0; q < n; q++) {
      rot('RY', q);
      if (kind === 'efficient_su2') rot('RZ', q);
    }
    L.end();
  }
}

export function buildCircuit(opts: BuildOptions): CircuitSpec {
  const n = opts.nQubits;
  const o = {
    nQubits: n,
    encoding: opts.encoding,
    encodingReps: opts.encodingReps ?? 2,
    bandwidth: opts.bandwidth ?? 1,
    entanglement: opts.entanglement ?? 'linear',
  };
  const x = opts.x ?? Array.from({ length: opts.encoding === 'amplitude' ? 2 ** n : n }, (_, i) => ((i * 0.77 + 0.4) % Math.PI) + 0.2);
  const L = new Layout(n);
  addEncoding(L, o, x);
  let nParams = 0;
  if (opts.ansatz) {
    const layers = opts.layers ?? 2;
    nParams = ansatzParamCount(opts.ansatz, n, layers);
    const theta = opts.theta ?? randomTheta(nParams, opts.seed ?? 7);
    addAnsatz(L, n, opts.ansatz, layers, o.entanglement, theta);
  }
  if (opts.measure !== false) {
    L.begin('Readout', 'measurement');
    for (let q = 0; q < n; q++) L.add('MEASURE', [q], 'measurement');
    L.end();
  }
  const depth = Math.max(0, ...L.next);
  const two = L.ops.filter((g) => ['CNOT', 'CZ', 'SWAP', 'CRZ'].includes(g.name)).length;
  const spec: CircuitSpec = {
    nQubits: n,
    ops: L.ops,
    depth,
    twoQubitGateCount: two,
    nTrainableParams: nParams,
    encoding: opts.encoding,
    ansatz: opts.ansatz ?? undefined,
    blocks: L.blocks,
    estimatedRuntimeSec: estimateRuntime(n, L.ops.length),
  };
  if (opts.qasm !== false) spec.qasm = toQasm(spec);
  return spec;
}

/** Rough simulator runtime per training run (statevector, 500 samples × 100 iterations). */
export function estimateRuntime(n: number, gates: number): number {
  return Number(((2 ** n * gates * 500 * 100) / 4e9 + 0.4).toFixed(1));
}

export function toQasm(spec: CircuitSpec): string {
  const lines = ['OPENQASM 2.0;', 'include "qelib1.inc";', `qreg q[${spec.nQubits}];`, `creg c[${spec.nQubits}];`];
  const f = (v: number) => v.toFixed(6);
  const sorted = [...spec.ops].sort((a, b) => a.layer - b.layer);
  for (const g of sorted) {
    const [a, b] = g.wires;
    const p = g.params ?? [];
    switch (g.name) {
      case 'CNOT': lines.push(`cx q[${a}],q[${b}];`); break;
      case 'CZ': lines.push(`cz q[${a}],q[${b}];`); break;
      case 'SWAP': lines.push(`swap q[${a}],q[${b}];`); break;
      case 'CRZ': lines.push(`crz(${f(p[0])}) q[${a}],q[${b}];`); break;
      case 'MEASURE': lines.push(`measure q[${a}] -> c[${a}];`); break;
      case 'BARRIER': lines.push(`barrier q;`); break;
      case 'STATEPREP': lines.push(`// amplitude encoding: initialize([${p.map((v) => v.toFixed(4)).join(', ')}]) q;`); break;
      case 'Rot': lines.push(`rz(${f(p[0])}) q[${a}];`, `ry(${f(p[1])}) q[${a}];`, `rz(${f(p[2])}) q[${a}];`); break;
      case 'U3': lines.push(`u3(${f(p[0])},${f(p[1])},${f(p[2])}) q[${a}];`); break;
      case 'P': lines.push(`p(${f(p[0])}) q[${a}];`); break;
      case 'RX': case 'RY': case 'RZ': lines.push(`${g.name.toLowerCase()}(${f(p[0])}) q[${a}];`); break;
      default: lines.push(`${g.name.toLowerCase()} q[${a}];`);
    }
  }
  return lines.join('\n');
}
