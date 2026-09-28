/** Risk stratification + threshold-selection helpers (D4). */
import { confusionAt, metricsFromConfusion, rocCurve } from './metrics';

export type RiskBand = 'low' | 'moderate' | 'high';

export interface RiskBands {
  low: [number, number];
  moderate: [number, number];
  high: [number, number];
}

export const DEFAULT_BANDS: RiskBands = { low: [0, 0.3], moderate: [0.3, 0.7], high: [0.7, 1] };

export function bandsFromCuts(c1: number, c2: number): RiskBands {
  const [a, b] = normalizeCuts(c1, c2);
  return { low: [0, a], moderate: [a, b], high: [b, 1] };
}

/** Keeps cut-points ordered, inside (0,1) and at least `gap` apart. */
export function normalizeCuts(c1: number, c2: number, gap = 0.02): [number, number] {
  let a = Math.min(Math.max(c1, gap), 1 - 2 * gap);
  let b = Math.min(Math.max(c2, gap * 2), 1 - gap);
  if (a > b) [a, b] = [b, a];
  if (b - a < gap) {
    if (a + gap <= 1 - gap) b = a + gap;
    else a = b - gap;
  }
  return [Number(a.toFixed(4)), Number(b.toFixed(4))];
}

export function assignBand(p: number, bands: RiskBands): RiskBand {
  if (p < bands.low[1]) return 'low';
  if (p < bands.moderate[1]) return 'moderate';
  return 'high';
}

/** Youden's J = sensitivity + specificity − 1, maximised over thresholds. */
export function youdenThreshold(scores: ArrayLike<number>, labels: ArrayLike<number>): number {
  const roc = rocCurve(scores, labels);
  let best = roc[0];
  let bestJ = -1;
  for (const p of roc) {
    const j = p.tpr - p.fpr;
    if (j > bestJ) {
      bestJ = j;
      best = p;
    }
  }
  return Math.min(0.99, Math.max(0.01, best.threshold));
}

/** Minimises expected cost: costFN·FN + costFP·FP over a threshold grid. */
export function costWeightedThreshold(
  scores: ArrayLike<number>,
  labels: ArrayLike<number>,
  costFN: number,
  costFP: number,
): number {
  let best = 0.5;
  let bestCost = Infinity;
  for (let t = 0.01; t <= 0.99; t += 0.005) {
    const c = confusionAt(scores, labels, t);
    const cost = costFN * c.fn + costFP * c.fp;
    if (cost < bestCost - 1e-9) {
      bestCost = cost;
      best = t;
    }
  }
  return Number(best.toFixed(3));
}

/** Highest threshold whose sensitivity still meets the minimum (maximises specificity under the constraint). */
export function sensitivityConstrainedThreshold(scores: ArrayLike<number>, labels: ArrayLike<number>, minSens: number): number {
  let best = 0.01;
  for (let t = 0.01; t <= 0.99; t += 0.005) {
    const m = metricsFromConfusion(confusionAt(scores, labels, t));
    if (m.sensitivity >= minSens) best = t;
  }
  return Number(best.toFixed(3));
}

/** Lowest threshold whose specificity meets the minimum (maximises sensitivity under the constraint). */
export function specificityConstrainedThreshold(scores: ArrayLike<number>, labels: ArrayLike<number>, minSpec: number): number {
  for (let t = 0.01; t <= 0.99; t += 0.005) {
    const m = metricsFromConfusion(confusionAt(scores, labels, t));
    if (m.specificity >= minSpec) return Number(t.toFixed(3));
  }
  return 0.99;
}

export const BAND_META: Record<RiskBand, { label: string; color: string; tint: string; action: string }> = {
  low: { label: 'Low risk', color: 'var(--green)', tint: 'var(--tint-green)', action: 'Routine screening at the standard interval.' },
  moderate: {
    label: 'Moderate risk',
    color: 'var(--saffron)',
    tint: 'var(--tint-saffron)',
    action: 'Diagnostic imaging and specialist review within 4 weeks.',
  },
  high: { label: 'High risk', color: 'var(--red)', tint: 'var(--tint-red)', action: 'Urgent referral for biopsy within 2 weeks.' },
};
