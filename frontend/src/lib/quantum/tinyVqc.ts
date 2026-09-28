/** A tiny VQC trained in the browser with SPSA (ZZ feature map + RealAmplitudes), used for live, honest demos. */
import type { GateOp } from '@/types/quantum';
import { buildCircuit, ansatzParamCount } from './circuits';
import { StateVector } from './simulator';
import { mulberry32 } from '../prng';

export interface TinyVqc {
  theta: number[];
  bandwidth: number;
  layers: number;
  accuracy: number;
  history: number[];
}

const templates = new Map<string, { ops: GateOp[]; idx: number[] }>();
const SUBS = '₀₁₂₃₄₅₆₇₈₉';

/** Ansatz gate list, built once per (n, layers) and re-parameterised cheaply. */
function ansatzOps(n: number, layers: number, theta: number[]): GateOp[] {
  const key = `${n}:${layers}`;
  let t = templates.get(key);
  if (!t) {
    const spec = buildCircuit({ nQubits: n, encoding: 'angle_ry', encodingReps: 1, x: new Array(n).fill(0), ansatz: 'real_amplitudes', layers, measure: false });
    const ops = spec.ops.filter((o) => o.role !== 'encoding');
    const idx = ops.map((o) => (o.paramRefs?.[0]?.startsWith('θ') ? Number(o.paramRefs[0].slice(1).split('').map((c) => SUBS.indexOf(c)).join('')) : -1));
    t = { ops, idx };
    templates.set(key, t);
  }
  return t.ops.map((o, i) => (t!.idx[i] >= 0 ? { ...o, params: [theta[t!.idx[i]] ?? 0] } : o));
}

export function encodeAll(xs: number[][], bandwidth: number): StateVector[] {
  return xs.map((x) => {
    const spec = buildCircuit({ nQubits: x.length, encoding: 'zz_feature_map', encodingReps: 2, bandwidth, x, ansatz: null, measure: false, qasm: false });
    const sv = new StateVector(x.length);
    spec.ops.forEach((o) => sv.applyOp(o));
    return sv;
  });
}

export function vqcProbability(enc: StateVector, theta: number[], layers: number): number {
  const sv = enc.clone();
  ansatzOps(enc.n, layers, theta).forEach((o) => sv.applyOp(o));
  return (1 + sv.expZ(0)) / 2;
}

/** SPSA training, yielding to the event loop between iterations. */
export async function trainTinyVqc(xs: number[][], ys: number[], opts: { bandwidth?: number; layers?: number; iters?: number; onIter?: (i: number, loss: number) => void } = {}): Promise<TinyVqc> {
  const bandwidth = opts.bandwidth ?? 0.35;
  const layers = opts.layers ?? 1;
  const iters = opts.iters ?? 70;
  const n = xs[0].length;
  const enc = encodeAll(xs, bandwidth);
  const rand = mulberry32(17);
  let theta = Array.from({ length: ansatzParamCount('real_amplitudes', n, layers) }, () => (rand() - 0.5) * 0.4);
  // Class 1 → ⟨Z₀⟩ → −1 would be p≈0; we map "positive" to p = (1+⟨Z₀⟩)/2 ≈ 1.
  const loss = (th: number[]) => {
    let l = 0;
    for (let i = 0; i < enc.length; i++) {
      const p = Math.min(1 - 1e-4, Math.max(1e-4, vqcProbability(enc[i], th, layers)));
      l -= ys[i] ? Math.log(p) : Math.log(1 - p);
    }
    return l / enc.length;
  };
  const history: number[] = [];
  for (let k = 0; k < iters; k++) {
    const a = 0.6 / (k + 1 + 5) ** 0.602;
    const c = 0.2 / (k + 1) ** 0.101;
    const delta = theta.map(() => (rand() < 0.5 ? -1 : 1));
    const lp = loss(theta.map((t, i) => t + c * delta[i]));
    const lm = loss(theta.map((t, i) => t - c * delta[i]));
    const g = (lp - lm) / (2 * c);
    theta = theta.map((t, i) => t - a * g * delta[i]);
    const cur = (lp + lm) / 2;
    history.push(cur);
    opts.onIter?.(k, cur);
    if (k % 5 === 4) await new Promise((r) => setTimeout(r, 0));
  }
  const acc = enc.reduce((s, e, i) => s + (((vqcProbability(e, theta, layers) >= 0.5 ? 1 : 0) === ys[i]) ? 1 : 0), 0) / enc.length;
  return { theta, bandwidth, layers, accuracy: acc, history };
}
