/**
 * Dependency-free statevector simulator (≤ 8 qubits) — for visualisation only.
 * Qubit q maps to bit q of the basis index. Basis labels are printed q0-first (|q0 q1 …⟩).
 */
import type { BlochVector, GateOp, SimResult } from '@/types/quantum';

type C = [number, number];
type M2 = [C, C, C, C]; // row-major 2×2

const c = (re: number, im = 0): C => [re, im];
const mul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const add = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const expi = (phi: number): C => [Math.cos(phi), Math.sin(phi)];
const S2 = Math.SQRT1_2;

export function matmul2(a: M2, b: M2): M2 {
  return [
    add(mul(a[0], b[0]), mul(a[1], b[2])),
    add(mul(a[0], b[1]), mul(a[1], b[3])),
    add(mul(a[2], b[0]), mul(a[3], b[2])),
    add(mul(a[2], b[1]), mul(a[3], b[3])),
  ];
}

export function gateMatrix(name: string, p: number[] = []): M2 | null {
  const [a = 0, b = 0, d = 0] = p;
  switch (name) {
    case 'H': return [c(S2), c(S2), c(S2), c(-S2)];
    case 'X': return [c(0), c(1), c(1), c(0)];
    case 'Y': return [c(0), c(0, -1), c(0, 1), c(0)];
    case 'Z': return [c(1), c(0), c(0), c(-1)];
    case 'S': return [c(1), c(0), c(0), c(0, 1)];
    case 'T': return [c(1), c(0), c(0), expi(Math.PI / 4)];
    case 'P': return [c(1), c(0), c(0), expi(a)];
    case 'RX': return [c(Math.cos(a / 2)), c(0, -Math.sin(a / 2)), c(0, -Math.sin(a / 2)), c(Math.cos(a / 2))];
    case 'RY': return [c(Math.cos(a / 2)), c(-Math.sin(a / 2)), c(Math.sin(a / 2)), c(Math.cos(a / 2))];
    case 'RZ':
    case 'CRZ': return [expi(-a / 2), c(0), c(0), expi(a / 2)];
    case 'U3': {
      const ct = Math.cos(a / 2), st = Math.sin(a / 2);
      return [c(ct), mul(c(-st), expi(d)), mul(c(st), expi(b)), mul(c(ct), expi(b + d))];
    }
    case 'Rot': // Rot(φ, θ, ω) = RZ(ω)·RY(θ)·RZ(φ)
      return matmul2(matmul2(gateMatrix('RZ', [d])!, gateMatrix('RY', [b])!), gateMatrix('RZ', [a])!);
    default: return null;
  }
}

export class StateVector {
  readonly n: number;
  re: Float64Array;
  im: Float64Array;

  constructor(n: number) {
    if (n < 1 || n > 10) throw new Error('Simulator supports 1–10 qubits');
    this.n = n;
    this.re = new Float64Array(1 << n);
    this.im = new Float64Array(1 << n);
    this.re[0] = 1;
  }

  clone(): StateVector {
    const s = new StateVector(this.n);
    s.re.set(this.re);
    s.im.set(this.im);
    return s;
  }

  apply1(m: M2, q: number, control = -1): void {
    const bit = 1 << q;
    const cbit = control >= 0 ? 1 << control : 0;
    const N = this.re.length;
    for (let i = 0; i < N; i++) {
      if (i & bit) continue;
      if (cbit && !(i & cbit)) continue;
      const j = i | bit;
      const ar = this.re[i], ai = this.im[i], br = this.re[j], bi = this.im[j];
      this.re[i] = m[0][0] * ar - m[0][1] * ai + m[1][0] * br - m[1][1] * bi;
      this.im[i] = m[0][0] * ai + m[0][1] * ar + m[1][0] * bi + m[1][1] * br;
      this.re[j] = m[2][0] * ar - m[2][1] * ai + m[3][0] * br - m[3][1] * bi;
      this.im[j] = m[2][0] * ai + m[2][1] * ar + m[3][0] * bi + m[3][1] * br;
    }
  }

  cz(a: number, b: number): void {
    const m = (1 << a) | (1 << b);
    for (let i = 0; i < this.re.length; i++)
      if ((i & m) === m) {
        this.re[i] = -this.re[i];
        this.im[i] = -this.im[i];
      }
  }

  swap(a: number, b: number): void {
    const ba = 1 << a, bb = 1 << b;
    for (let i = 0; i < this.re.length; i++)
      if (i & ba && !(i & bb)) {
        const j = (i & ~ba) | bb;
        [this.re[i], this.re[j]] = [this.re[j], this.re[i]];
        [this.im[i], this.im[j]] = [this.im[j], this.im[i]];
      }
  }

  setAmplitudes(amps: number[]): void {
    this.re.fill(0);
    this.im.fill(0);
    let norm = 0;
    for (let i = 0; i < this.re.length; i++) norm += (amps[i] ?? 0) ** 2;
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < this.re.length; i++) this.re[i] = (amps[i] ?? 0) / norm;
    if (norm === 1 && amps.every((a) => a === 0)) this.re[0] = 1;
  }

  applyOp(op: GateOp): void {
    const w = op.wires;
    switch (op.name) {
      case 'MEASURE':
      case 'BARRIER':
        return;
      case 'CNOT':
        this.apply1(gateMatrix('X')!, w[1], w[0]);
        return;
      case 'CZ':
        this.cz(w[0], w[1]);
        return;
      case 'SWAP':
        this.swap(w[0], w[1]);
        return;
      case 'CRZ':
        this.apply1(gateMatrix('RZ', op.params)!, w[1], w[0]);
        return;
      case 'STATEPREP':
        this.setAmplitudes(op.params ?? []);
        return;
      default: {
        const m = gateMatrix(op.name, op.params);
        if (m) this.apply1(m, w[0]);
      }
    }
  }

  probabilities(): number[] {
    const out = new Array<number>(this.re.length);
    for (let i = 0; i < out.length; i++) out[i] = this.re[i] ** 2 + this.im[i] ** 2;
    return out;
  }

  norm(): number {
    return this.probabilities().reduce((s, v) => s + v, 0);
  }

  /** Bloch vector of qubit q from its reduced density matrix. |r| < 1 ⇒ entangled / mixed. */
  bloch(q: number): BlochVector {
    const bit = 1 << q;
    let p0 = 0, p1 = 0, rr = 0, ri = 0; // ρ01 = Σ a_i0 · conj(a_i1)
    for (let i = 0; i < this.re.length; i++) {
      if (i & bit) continue;
      const j = i | bit;
      p0 += this.re[i] ** 2 + this.im[i] ** 2;
      p1 += this.re[j] ** 2 + this.im[j] ** 2;
      rr += this.re[i] * this.re[j] + this.im[i] * this.im[j];
      ri += this.im[i] * this.re[j] - this.re[i] * this.im[j];
    }
    return { x: 2 * rr, y: -2 * ri, z: p0 - p1 };
  }

  expZ(q: number): number {
    return this.bloch(q).z;
  }

  /** Amplitude of basis state `i`: [re, im]. */
  amp(i: number): C {
    return [this.re[i], this.im[i]];
  }
}

export function simulate(nQubits: number, ops: GateOp[], upToLayer = Infinity): SimResult {
  const sv = new StateVector(nQubits);
  for (const op of ops) if (op.layer <= upToLayer) sv.applyOp(op);
  return snapshot(sv);
}

export function snapshot(sv: StateVector): SimResult {
  return {
    re: sv.re.slice(),
    im: sv.im.slice(),
    probabilities: sv.probabilities(),
    bloch: Array.from({ length: sv.n }, (_, q) => sv.bloch(q)),
  };
}

/** State after each layer (index 0 = |0…0⟩ before any gate). */
export function stepStates(nQubits: number, ops: GateOp[]): SimResult[] {
  const maxLayer = ops.reduce((m, o) => Math.max(m, o.layer), -1);
  const sorted = [...ops].sort((a, b) => a.layer - b.layer);
  const sv = new StateVector(nQubits);
  const out: SimResult[] = [snapshot(sv)];
  let k = 0;
  for (let L = 0; L <= maxLayer; L++) {
    while (k < sorted.length && sorted[k].layer === L) sv.applyOp(sorted[k++]);
    out.push(snapshot(sv));
  }
  return out;
}

/** Label for basis index i, printed q0 first. */
export function basisLabel(i: number, n: number): string {
  let s = '';
  for (let q = 0; q < n; q++) s += (i >> q) & 1;
  return s;
}

/** Multinomial shot sampling from probabilities. */
export function sampleShots(probs: number[], shots: number, rand: () => number): number[] {
  const counts = new Array<number>(probs.length).fill(0);
  const cdf: number[] = [];
  let acc = 0;
  for (const p of probs) cdf.push((acc += p));
  for (let s = 0; s < shots; s++) {
    const r = rand() * acc;
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    counts[lo]++;
  }
  return counts;
}

export function blochLength(b: BlochVector): number {
  return Math.sqrt(b.x * b.x + b.y * b.y + b.z * b.z);
}

export function blochAngles(b: BlochVector): { theta: number; phi: number } {
  const r = blochLength(b) || 1;
  return { theta: Math.acos(Math.max(-1, Math.min(1, b.z / r))), phi: Math.atan2(b.y, b.x) };
}

/** Dirac notation like "0.707|00⟩ + 0.707|11⟩" (terms below tol dropped). */
export function dirac(re: Float64Array, im: Float64Array, n: number, tol = 1e-3, maxTerms = 8): string {
  const terms: { i: number; p: number }[] = [];
  for (let i = 0; i < re.length; i++) {
    const p = re[i] ** 2 + im[i] ** 2;
    if (p > tol * tol) terms.push({ i, p });
  }
  terms.sort((a, b) => b.p - a.p);
  const shown = terms.slice(0, maxTerms).sort((a, b) => a.i - b.i);
  const parts = shown.map(({ i }, k) => {
    const r = re[i], m = im[i];
    let coef: string;
    if (Math.abs(m) < tol) coef = Math.abs(r).toFixed(3);
    else if (Math.abs(r) < tol) coef = `${Math.abs(m).toFixed(3)}i`;
    else coef = `(${r.toFixed(3)}${m >= 0 ? '+' : '−'}${Math.abs(m).toFixed(3)}i)`;
    const neg = Math.abs(m) < tol ? r < 0 : Math.abs(r) < tol ? m < 0 : false;
    const sign = k === 0 ? (neg ? '−' : '') : neg ? ' − ' : ' + ';
    return `${sign}${coef}|${basisLabel(i, n)}⟩`;
  });
  return parts.join('') + (terms.length > maxTerms ? ' + …' : '');
}
