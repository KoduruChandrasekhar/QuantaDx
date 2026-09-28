/** Confusion-matrix math, threshold metrics, curves and regression metrics. Pure, fast, tested. */

export interface Confusion {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export interface ThresholdMetrics {
  accuracy: number;
  balancedAccuracy: number;
  sensitivity: number;
  specificity: number;
  precision: number;
  npv: number;
  f1: number;
  mcc: number;
}

const safe = (n: number, d: number) => (d === 0 ? 0 : n / d);

export function confusionAt(scores: ArrayLike<number>, labels: ArrayLike<number>, threshold: number): Confusion {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (let i = 0; i < scores.length; i++) {
    const pred = scores[i] >= threshold ? 1 : 0;
    if (labels[i] === 1) {
      if (pred) tp++;
      else fn++;
    } else if (pred) fp++;
    else tn++;
  }
  return { tp, fp, tn, fn };
}

export function metricsFromConfusion(c: Confusion): ThresholdMetrics {
  const { tp, fp, tn, fn } = c;
  const n = tp + fp + tn + fn;
  const sensitivity = safe(tp, tp + fn);
  const specificity = safe(tn, tn + fp);
  const precision = safe(tp, tp + fp);
  const npv = safe(tn, tn + fn);
  const f1 = safe(2 * precision * sensitivity, precision + sensitivity);
  const denom = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
  const mcc = denom === 0 ? 0 : (tp * tn - fp * fn) / denom;
  return {
    accuracy: safe(tp + tn, n),
    balancedAccuracy: (sensitivity + specificity) / 2,
    sensitivity,
    specificity,
    precision,
    npv,
    f1,
    mcc,
  };
}

export interface RocPoint {
  fpr: number;
  tpr: number;
  threshold: number;
}

/** Exact empirical ROC curve (monotonic by construction). */
export function rocCurve(scores: ArrayLike<number>, labels: ArrayLike<number>): RocPoint[] {
  const idx = Array.from({ length: scores.length }, (_, i) => i).sort((a, b) => scores[b] - scores[a]);
  let P = 0;
  for (let i = 0; i < labels.length; i++) P += labels[i] === 1 ? 1 : 0;
  const N = labels.length - P;
  const pts: RocPoint[] = [{ fpr: 0, tpr: 0, threshold: 1 }];
  let tp = 0, fp = 0;
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k];
    if (labels[i] === 1) tp++;
    else fp++;
    const next = idx[k + 1];
    if (next === undefined || scores[next] !== scores[i]) {
      pts.push({ fpr: safe(fp, N), tpr: safe(tp, P), threshold: scores[i] });
    }
  }
  return pts;
}

export function trapezoidAuc(pts: { x: number; y: number }[]): number {
  let a = 0;
  for (let i = 1; i < pts.length; i++) a += ((pts[i].x - pts[i - 1].x) * (pts[i].y + pts[i - 1].y)) / 2;
  return Math.abs(a);
}

export const rocAuc = (roc: RocPoint[]) => trapezoidAuc(roc.map((p) => ({ x: p.fpr, y: p.tpr })));

export interface PrPoint {
  recall: number;
  precision: number;
}

export function prCurve(scores: ArrayLike<number>, labels: ArrayLike<number>): PrPoint[] {
  const idx = Array.from({ length: scores.length }, (_, i) => i).sort((a, b) => scores[b] - scores[a]);
  let P = 0;
  for (let i = 0; i < labels.length; i++) P += labels[i] === 1 ? 1 : 0;
  const pts: PrPoint[] = [{ recall: 0, precision: 1 }];
  let tp = 0, fp = 0;
  for (let k = 0; k < idx.length; k++) {
    if (labels[idx[k]] === 1) tp++;
    else fp++;
    const next = idx[k + 1];
    if (next === undefined || scores[next] !== scores[idx[k]]) pts.push({ recall: safe(tp, P), precision: safe(tp, tp + fp) });
  }
  return pts;
}

/** Average precision (step-wise PR-AUC). */
export function averagePrecision(pr: PrPoint[]): number {
  let ap = 0;
  for (let i = 1; i < pr.length; i++) ap += (pr[i].recall - pr[i - 1].recall) * pr[i].precision;
  return ap;
}

export function brier(scores: ArrayLike<number>, labels: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < scores.length; i++) s += (scores[i] - labels[i]) ** 2;
  return s / scores.length;
}

export interface CalibrationBin {
  bin: number;
  predicted: number;
  observed: number;
  count: number;
}

export function calibrationBins(scores: ArrayLike<number>, labels: ArrayLike<number>, bins = 10): CalibrationBin[] {
  const acc = Array.from({ length: bins }, () => ({ p: 0, y: 0, n: 0 }));
  for (let i = 0; i < scores.length; i++) {
    const b = Math.min(bins - 1, Math.floor(scores[i] * bins));
    acc[b].p += scores[i];
    acc[b].y += labels[i];
    acc[b].n++;
  }
  return acc
    .map((a, i) => ({ bin: i, predicted: safe(a.p, a.n), observed: safe(a.y, a.n), count: a.n }))
    .filter((b) => b.count > 0);
}

/** Sample the ROC down to ≤ n points for chart rendering. */
export function thinRoc(roc: RocPoint[], n = 120): RocPoint[] {
  if (roc.length <= n) return roc;
  const step = roc.length / n;
  const out: RocPoint[] = [];
  for (let i = 0; i < n; i++) out.push(roc[Math.floor(i * step)]);
  out.push(roc[roc.length - 1]);
  return out;
}

/* ───────── Regression ───────── */
export interface RegressionScores {
  rmse: number;
  mae: number;
  r2: number;
}

export function regressionMetrics(actual: number[], predicted: number[]): RegressionScores {
  const n = actual.length;
  const mean = actual.reduce((s, v) => s + v, 0) / n;
  let se = 0, ae = 0, st = 0;
  for (let i = 0; i < n; i++) {
    const r = actual[i] - predicted[i];
    se += r * r;
    ae += Math.abs(r);
    st += (actual[i] - mean) ** 2;
  }
  return { rmse: Math.sqrt(se / n), mae: ae / n, r2: st === 0 ? 0 : 1 - se / st };
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0;
}

export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / (xs.length - 1));
}

export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function histogram(xs: number[], bins: number, lo?: number, hi?: number): { x0: number; x1: number; count: number }[] {
  const min = lo ?? Math.min(...xs);
  const max = hi ?? Math.max(...xs);
  const w = (max - min) / bins || 1;
  const out = Array.from({ length: bins }, (_, i) => ({ x0: min + i * w, x1: min + (i + 1) * w, count: 0 }));
  for (const x of xs) {
    const b = Math.min(bins - 1, Math.max(0, Math.floor((x - min) / w)));
    out[b].count++;
  }
  return out;
}
