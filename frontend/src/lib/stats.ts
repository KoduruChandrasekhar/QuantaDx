/** Significance tests used for honest benchmarking: McNemar, paired t-test, Wilcoxon signed-rank. */
import { erf } from './prng';

/** Chi-square(1) survival function. */
function chi2Sf1(x: number): number {
  return 1 - erf(Math.sqrt(x / 2));
}

export interface TestResult {
  statistic: number;
  pValue: number;
}

/** McNemar with continuity correction on paired correct/incorrect predictions. */
export function mcnemar(correctA: boolean[], correctB: boolean[]): TestResult & { b: number; c: number } {
  let b = 0, c = 0;
  for (let i = 0; i < correctA.length; i++) {
    if (correctA[i] && !correctB[i]) b++;
    else if (!correctA[i] && correctB[i]) c++;
  }
  if (b + c === 0) return { statistic: 0, pValue: 1, b, c };
  const stat = (Math.abs(b - c) - 1) ** 2 / (b + c);
  return { statistic: stat, pValue: Math.min(1, chi2Sf1(stat)), b, c };
}

/* Regularised incomplete beta (Numerical Recipes continued fraction) for Student-t p-values. */
function lnGamma(z: number): number {
  const g = [76.1800917294715, -86.5053203294168, 24.0140982408309, -1.23173957245015, 0.0012086509738662, -0.000005395239384953];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const c of g) ser += c / ++y;
  x = z;
  return -tmp + Math.log((Math.sqrt(2 * Math.PI) * ser) / x);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-12;
  const FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

export function incBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-sided p-value for Student's t with df degrees of freedom. */
export function tTwoSided(t: number, df: number): number {
  const x = df / (df + t * t);
  return incBeta(df / 2, 0.5, x);
}

export function pairedTTest(a: number[], b: number[]): TestResult {
  const d = a.map((v, i) => v - b[i]);
  const n = d.length;
  const m = d.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(d.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1));
  if (sd === 0) return { statistic: 0, pValue: 1 };
  const t = m / (sd / Math.sqrt(n));
  return { statistic: t, pValue: tTwoSided(t, n - 1) };
}

/** Exact two-sided Wilcoxon signed-rank test (n ≤ 16), zero differences dropped. */
export function wilcoxonSignedRank(a: number[], b: number[]): TestResult {
  const d = a.map((v, i) => v - b[i]).filter((v) => Math.abs(v) > 1e-12);
  const n = d.length;
  if (n === 0) return { statistic: 0, pValue: 1 };
  const order = d.map((v, i) => ({ v: Math.abs(v), i })).sort((x, y) => x.v - y.v);
  const ranks = new Array<number>(n);
  for (let k = 0; k < n; ) {
    let j = k;
    while (j + 1 < n && Math.abs(order[j + 1].v - order[k].v) < 1e-12) j++;
    const r = (k + j + 2) / 2;
    for (let t = k; t <= j; t++) ranks[order[t].i] = r;
    k = j + 1;
  }
  let wPlus = 0;
  for (let i = 0; i < n; i++) if (d[i] > 0) wPlus += ranks[i];
  const total = (n * (n + 1)) / 2;
  const w = Math.min(wPlus, total - wPlus);
  let count = 0;
  const combos = 1 << n;
  for (let mask = 0; mask < combos; mask++) {
    let s = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) s += ranks[i];
    if (s <= w + 1e-9) count++;
  }
  return { statistic: w, pValue: Math.min(1, (2 * count) / combos) };
}
