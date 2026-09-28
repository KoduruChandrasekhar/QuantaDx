/** A consistent "trained model" basis per dataset: feature stats, discriminative weights, PCA encoder, calibration. */
import { pca } from '@/lib/linalg';
import { quantile } from '@/lib/metrics';
import { prettyName } from '@/lib/format';
import { getDataset, getTable } from './data';

export interface ModelBasis {
  datasetId: string;
  names: string[];
  units: (string | undefined)[];
  mean: number[];
  std: number[];
  median: number[];
  min: number[];
  max: number[];
  meanNeg: number[];
  meanPos: number[];
  weights: number[]; // Cohen's-d style direction, normalised (Σ|w| = 1)
  components: number[][]; // 6 × d PCA loadings on standardised features
  pcMin: number[];
  pcMax: number[];
  explained: number[];
  s0: number;
  s1: number;
  regression: boolean;
}

const cache = new Map<string, ModelBasis>();
const NQ = 6;

export function getBasis(datasetId: string): ModelBasis {
  const hit = cache.get(datasetId);
  if (hit) return hit;
  const ds = getDataset(datasetId);
  const t = getTable(datasetId);
  const d = Math.min(t.columns.length, 40);
  const names = t.columns.slice(0, d).map((c) => c.name);
  const units = t.columns.slice(0, d).map((c) => c.unit);
  const colVals = names.map((_, j) => t.X.map((r) => r[j]).filter((v): v is number => v !== null).sort((a, b) => a - b));
  const median = colVals.map((v) => quantile(v, 0.5));
  const X = t.X.map((r) => r.slice(0, d).map((v, j) => (v === null ? median[j] : v)));
  const n = X.length;
  const mean = names.map((_, j) => X.reduce((s, r) => s + r[j], 0) / n);
  const std = names.map((_, j) => Math.sqrt(X.reduce((s, r) => s + (r[j] - mean[j]) ** 2, 0) / (n - 1)) || 1);
  const regression = ds.taskType === 'regression';
  const pos = X.filter((_, i) => t.y[i] === 1);
  const neg = X.filter((_, i) => t.y[i] !== 1);
  const meanPos = names.map((_, j) => (pos.length ? pos.reduce((s, r) => s + r[j], 0) / pos.length : mean[j]));
  const meanNeg = names.map((_, j) => (neg.length ? neg.reduce((s, r) => s + r[j], 0) / neg.length : mean[j]));
  let raw: number[];
  if (regression) {
    const my = t.y.reduce((s, v) => s + v, 0) / n;
    raw = names.map((_, j) => X.reduce((s, r, i) => s + ((r[j] - mean[j]) / std[j]) * (t.y[i] - my), 0) / n);
  } else raw = names.map((_, j) => (meanPos[j] - meanNeg[j]) / std[j]);
  const tot = raw.reduce((s, v) => s + Math.abs(v), 0) || 1;
  const weights = raw.map((v) => v / tot);
  const p = pca(X, Math.min(NQ, d));
  const pcMin = p.components.map((_, c) => Math.min(...p.scores.map((s) => s[c])));
  const pcMax = p.components.map((_, c) => Math.max(...p.scores.map((s) => s[c])));
  const score = (row: number[]) => row.reduce((s, v, j) => s + weights[j] * ((v - mean[j]) / std[j]), 0);
  const basis: ModelBasis = {
    datasetId, names, units, mean, std, median,
    min: colVals.map((v) => v[0] ?? 0), max: colVals.map((v) => v[v.length - 1] ?? 1),
    meanNeg, meanPos, weights, components: p.components, pcMin, pcMax, explained: p.explained,
    s0: score(meanNeg), s1: score(meanPos), regression,
  };
  cache.set(datasetId, basis);
  return basis;
}

export function standardizeRow(b: ModelBasis, row: number[]): number[] {
  return row.map((v, j) => (v - b.mean[j]) / b.std[j]);
}

/** Row → 6 PCA components → MinMax [0, π] rotation angles. */
export function encodeRow(b: ModelBasis, row: number[], bandwidth = 1): number[] {
  const z = standardizeRow(b, row);
  return b.components.map((c, k) => {
    const s = c.reduce((acc, w, j) => acc + w * z[j], 0);
    const a = ((s - b.pcMin[k]) / (b.pcMax[k] - b.pcMin[k] || 1)) * Math.PI;
    return Math.min(Math.PI, Math.max(0, a)) * bandwidth;
  });
}

const logit = (p: number) => Math.log(p / (1 - p));

/** Calibrated probability: class-mean profiles map to ≈ 6% and ≈ 94%. */
export function probabilityOf(b: ModelBasis, row: number[], confidence = 1): number {
  const s = row.reduce((acc, v, j) => acc + b.weights[j] * ((v - b.mean[j]) / b.std[j]), 0);
  const L0 = logit(0.06), L1 = logit(0.94);
  const L = L0 + ((s - b.s0) / (b.s1 - b.s0 || 1)) * (L1 - L0);
  return 1 / (1 + Math.exp(-L * confidence));
}

export function contributions(b: ModelBasis, row: number[]): { feature: string; value: number; contribution: number; z: number }[] {
  return row.map((v, j) => {
    const z = (v - b.mean[j]) / b.std[j];
    return { feature: b.names[j], value: v, contribution: b.weights[j] * z, z };
  });
}

export { prettyName };

export function factorText(feature: string, value: number, unit: string | undefined, z: number, contribution: number, regression: boolean): string {
  const size = Math.abs(z) > 1.5 ? 'much ' : '';
  const dir = z >= 0 ? `${size}higher` : `${size}lower`;
  const effect = regression ? (contribution >= 0 ? 'raised the predicted score' : 'lowered the predicted score') : contribution >= 0 ? 'increased the estimated risk' : 'decreased the estimated risk';
  const v = Math.abs(value) >= 100 ? value.toFixed(0) : Math.abs(value) >= 1 ? value.toFixed(2) : value.toPrecision(3);
  return `${prettyName(feature)} ${dir} than typical (${v}${unit ? ` ${unit}` : ''}) ${effect}.`;
}
