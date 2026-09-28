/** Fidelity quantum kernels k(x,x′) = |⟨φ(x)|φ(x′)⟩|² for small in-browser previews (≤ 60 samples, ≤ 6 qubits). */
import type { EncodingKind, Entanglement } from '@/types/quantum';
import { buildCircuit } from './circuits';
import { StateVector } from './simulator';

export function encodeState(x: number[], encoding: EncodingKind, bandwidth: number, reps = 2, entanglement: Entanglement = 'linear'): StateVector {
  const n = encoding === 'amplitude' ? Math.ceil(Math.log2(Math.max(2, x.length))) : x.length;
  const spec = buildCircuit({ nQubits: n, encoding, encodingReps: reps, bandwidth, entanglement, x, ansatz: null, measure: false, qasm: false });
  const sv = new StateVector(n);
  for (const op of spec.ops) sv.applyOp(op);
  return sv;
}

export function fidelity(a: StateVector, b: StateVector): number {
  let re = 0, im = 0;
  for (let i = 0; i < a.re.length; i++) {
    re += a.re[i] * b.re[i] + a.im[i] * b.im[i];
    im += a.re[i] * b.im[i] - a.im[i] * b.re[i];
  }
  return re * re + im * im;
}

export function fidelityKernel(xs: number[][], encoding: EncodingKind = 'zz_feature_map', bandwidth = 1, reps = 2, entanglement: Entanglement = 'linear'): number[][] {
  const states = xs.map((x) => encodeState(x, encoding, bandwidth, reps, entanglement));
  const n = xs.length;
  const K = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    K[i][i] = 1;
    for (let j = i + 1; j < n; j++) K[i][j] = K[j][i] = fidelity(states[i], states[j]);
  }
  return K;
}

export function rbfKernel(xs: number[][], gamma = 0.5): number[][] {
  return xs.map((a) => xs.map((b) => Math.exp(-gamma * a.reduce((s, v, k) => s + (v - b[k]) ** 2, 0))));
}

/** Off-diagonal values (upper triangle). */
export function offDiagonal(K: number[][]): number[] {
  const out: number[] = [];
  for (let i = 0; i < K.length; i++) for (let j = i + 1; j < K.length; j++) out.push(K[i][j]);
  return out;
}

export function variance(xs: number[]): number {
  const m = xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
  return xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length || 1);
}

/** Kernel-target alignment A(K, yyᵀ) with y ∈ {−1, +1}. */
export function kernelTargetAlignment(K: number[][], labels: number[]): number {
  const y = labels.map((l) => (l === 1 ? 1 : -1));
  let ky = 0, kk = 0;
  for (let i = 0; i < K.length; i++)
    for (let j = 0; j < K.length; j++) {
      ky += K[i][j] * y[i] * y[j];
      kk += K[i][j] ** 2;
    }
  return ky / (Math.sqrt(kk) * K.length);
}

export const CONCENTRATION_VAR_THRESHOLD = 0.004;
