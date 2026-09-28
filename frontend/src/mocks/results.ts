/**
 * Seeded, mathematically consistent experiment results.
 * Scores are placed on class-conditional normal quantiles so that at threshold 0.5 the confusion matrix
 * reproduces the target sensitivity/specificity exactly; every other metric is COMPUTED from the scores.
 */
import type { ClassificationMetrics, ExperimentResults, MeanStd, ModelFamily, ModelKind, ModelResult, SignificanceTest } from '@/types/api';
import { averagePrecision, brier, calibrationBins, confusionAt, metricsFromConfusion, prCurve, regressionMetrics, rocAuc, rocCurve, thinRoc } from '@/lib/metrics';
import { gaussian, hashSeed, mulberry32, normInv, round, shuffle, sigmoid, valuesWithMeanStd } from '@/lib/prng';
import { mcnemar, pairedTTest, wilcoxonSignedRank } from '@/lib/stats';
import { modelMeta } from '@/content/models';

export interface ModelPlan {
  modelId: string;
  kind: ModelKind;
  label?: string;
  family?: ModelFamily;
  sens: number;
  spec: number;
  /** Reported CV means/stds that override the pooled values (PoC table). */
  reported?: Partial<Record<'accuracy' | 'sensitivity' | 'specificity' | 'rocAuc', [number, number]>>;
  note?: string;
}

/** Section 6.4 — the real proof of concept, reproduced exactly. */
export const POC_PLANS: ModelPlan[] = [
  { modelId: 'logreg', kind: 'logreg', sens: 0.948, spec: 0.969, reported: { accuracy: [0.961, 0.015], sensitivity: [0.948, 0.05], specificity: [0.969, 0.027], rocAuc: [0.995, 0.004] } },
  { modelId: 'svm_rbf', kind: 'svm_rbf', sens: 0.948, spec: 0.969, reported: { accuracy: [0.961, 0.02], sensitivity: [0.948, 0.045], specificity: [0.969, 0.027], rocAuc: [0.995, 0.005] } },
  { modelId: 'random_forest', kind: 'random_forest', sens: 0.929, spec: 0.967, reported: { accuracy: [0.953, 0.023], sensitivity: [0.929, 0.049], specificity: [0.967, 0.039], rocAuc: [0.988, 0.009] } },
  { modelId: 'xgboost', kind: 'xgboost', sens: 0.939, spec: 0.964 },
  { modelId: 'qsvm_raw', kind: 'qsvm', label: 'QSVM · raw ZZ kernel (bw 1.0)', sens: 0.722, spec: 0.86,
    reported: { accuracy: [0.808, 0.021], sensitivity: [0.722, 0.061], specificity: [0.86, 0.051], rocAuc: [0.885, 0.015] },
    note: 'Kernel concentration: off-diagonal kernel values collapse toward 0.' },
  { modelId: 'qsvm_bw', kind: 'qsvm', label: 'QSVM · bandwidth-tuned', sens: 0.892, spec: 0.969,
    reported: { accuracy: [0.94, 0.013], sensitivity: [0.892, 0.047], specificity: [0.969, 0.028], rocAuc: [0.985, 0.008] },
    note: 'Bandwidth chosen by inner 3-fold CV from {0.05, 0.1, 0.2, 0.3, 0.5, 1.0}; selected 0.1–0.2.' },
  { modelId: 'vqc', kind: 'vqc', sens: 0.868, spec: 0.944 },
  { modelId: 'qnn', kind: 'qnn', sens: 0.877, spec: 0.95 },
  { modelId: 'hybrid_nn', kind: 'hybrid_nn', sens: 0.906, spec: 0.958 },
];

export const POC_BANDWIDTH_SWEEP = [
  { bandwidth: 0.05, accuracy: 0.917 }, { bandwidth: 0.1, accuracy: 0.939 }, { bandwidth: 0.2, accuracy: 0.94 },
  { bandwidth: 0.3, accuracy: 0.917 }, { bandwidth: 0.5, accuracy: 0.912 }, { bandwidth: 1.0, accuracy: 0.815 },
];

const EFFICIENCY: Record<ModelKind, { t: number; inf: number; params: number; mem: number }> = {
  logreg: { t: 0.08, inf: 0.004, params: 7, mem: 2 }, svm_rbf: { t: 0.21, inf: 0.03, params: 120, mem: 4 },
  random_forest: { t: 1.9, inf: 0.09, params: 41200, mem: 18 }, xgboost: { t: 2.6, inf: 0.05, params: 23800, mem: 12 },
  mlp: { t: 3.1, inf: 0.02, params: 481, mem: 6 }, qsvm: { t: 164, inf: 58, params: 118, mem: 41 }, vqc: { t: 412, inf: 3.6, params: 18, mem: 9 },
  qnn: { t: 386, inf: 4.1, params: 26, mem: 9 }, hybrid_nn: { t: 305, inf: 3.9, params: 257, mem: 11 },
  linreg: { t: 0.05, inf: 0.003, params: 17, mem: 2 }, svr_rbf: { t: 9.4, inf: 0.6, params: 1400, mem: 30 }, rf_regressor: { t: 14.2, inf: 0.12, params: 88000, mem: 64 },
  qsvr: { t: 690, inf: 61, params: 1400, mem: 120 }, vqr: { t: 520, inf: 3.8, params: 18, mem: 9 },
};

const DEFAULT_STD: Record<string, number> = { accuracy: 0.02, balancedAccuracy: 0.021, sensitivity: 0.05, specificity: 0.03, precision: 0.035, npv: 0.03, f1: 0.03, rocAuc: 0.008, prAuc: 0.012, mcc: 0.04, brier: 0.006 };

function meanStd(mean: number, std: number, z: number[]): MeanStd {
  const folds = valuesWithMeanStd(z, mean, std).map((v) => round(Math.min(1, Math.max(0, v)), 4));
  // re-centre after clipping so folds average to the reported mean
  const drift = mean - folds.reduce((s, v) => s + v, 0) / folds.length;
  return { mean: round(mean, 4), std: round(std, 4), folds: folds.map((v) => round(v + drift, 4)) };
}

export function classificationResults(experimentId: string, datasetId: string, plans: ModelPlan[], nPos: number, nNeg: number, folds = 5, seed = 42): ExperimentResults {
  const rand = mulberry32(seed + hashSeed(datasetId));
  const n = nPos + nNeg;
  const labels = shuffle([...new Array<number>(nPos).fill(1), ...new Array<number>(nNeg).fill(0)], rand);
  const posIdx = labels.map((l, i) => (l ? i : -1)).filter((i) => i >= 0);
  const negIdx = labels.map((l, i) => (l ? -1 : i)).filter((i) => i >= 0);
  const baseRank = new Map<number, number>();
  shuffle(posIdx, rand).forEach((i, r) => baseRank.set(i, r));
  shuffle(negIdx, rand).forEach((i, r) => baseRank.set(i, r));
  const sharedFold = Array.from({ length: folds }, () => gaussian(rand));

  const models: ModelResult[] = plans.map((p) => {
    const meta = modelMeta(p.kind);
    const family = p.family ?? meta.family;
    const quantum = family !== 'classical';
    const r2 = mulberry32(hashSeed(p.modelId) + seed);
    const jitter = quantum ? 0.22 : 0.12;
    const rankWithin = (idx: number[], size: number) => {
      const noisy = idx.map((i) => ({ i, v: baseRank.get(i)! + gaussian(r2) * jitter * size }));
      noisy.sort((a, b) => a.v - b.v);
      const out = new Map<number, number>();
      noisy.forEach((o, r) => out.set(o.i, r));
      return out;
    };
    const rp = rankWithin(posIdx, nPos);
    const rn = rankWithin(negIdx, nNeg);
    const c = normInv(p.spec);
    const mu = c + normInv(p.sens);
    const k = quantum ? 1.25 : 1.7;
    const scores = labels.map((l, i) => {
      const z = l ? mu + normInv((rp.get(i)! + 0.5) / nPos) : normInv((rn.get(i)! + 0.5) / nNeg);
      return round(sigmoid(k * (z - c)), 5);
    });
    const cm = confusionAt(scores, labels, 0.5);
    const pooled = metricsFromConfusion(cm);
    const roc = rocCurve(scores, labels);
    const pr = prCurve(scores, labels);
    const pooledAll: Record<keyof ClassificationMetrics, number> = {
      ...pooled,
      rocAuc: rocAuc(roc),
      prAuc: averagePrecision(pr),
      brier: brier(scores, labels),
    };
    const own = Array.from({ length: folds }, () => gaussian(r2));
    const z = own.map((v, f) => 0.7 * sharedFold[f] + 0.71 * v);
    const metrics = {} as ClassificationMetrics;
    (Object.keys(pooledAll) as (keyof ClassificationMetrics)[]).forEach((key) => {
      const rep = p.reported?.[key as 'accuracy'];
      const base = rep ? rep[0] : pooledAll[key];
      const s = rep ? rep[1] : DEFAULT_STD[key] * (quantum ? 1.25 : 1);
      metrics[key] = meanStd(base, s, key === 'brier' ? z.map((v) => -v) : z);
    });
    const eff = EFFICIENCY[p.kind];
    const acc = metrics.accuracy.mean;
    const gap = p.kind === 'random_forest' || p.kind === 'xgboost' ? 0.045 : quantum ? 0.012 + r2() * 0.01 : 0.01 + r2() * 0.01;
    const sizes = [60, 120, 200, 300, 380, 455];
    return {
      modelId: p.modelId,
      kind: p.kind,
      label: p.label ?? meta.label,
      family,
      note: p.note,
      metrics,
      confusion: cm,
      scores,
      roc: thinRoc(roc, 140).map(({ fpr, tpr }) => ({ fpr: round(fpr, 4), tpr: round(tpr, 4) })),
      pr: pr.filter((_, i) => i % Math.max(1, Math.floor(pr.length / 140)) === 0).map((q) => ({ recall: round(q.recall, 4), precision: round(q.precision, 4) })),
      calibration: calibrationBins(scores, labels, 10).map((b) => ({ predicted: round(b.predicted, 3), observed: round(b.observed, 3), count: b.count })),
      efficiency: {
        trainTimeSec: eff.t,
        inferenceMsPerSample: eff.inf,
        params: eff.params,
        qubits: quantum ? 6 : undefined,
        circuitDepth: quantum ? (p.kind === 'qsvm' ? 17 : 21) : undefined,
        circuitExecutions: quantum ? (p.kind === 'qsvm' ? Math.round((n * 0.8) ** 2 / 2) : 100 * 455 * 2 * 18) : undefined,
        shots: quantum ? 0 : undefined,
        memoryMb: eff.mem,
      },
      trainTestGap: { train: round(Math.min(1, acc + gap), 3), test: round(acc, 3) },
      learningCurve: sizes.map((s, i) => {
        const frac = (i + 1) / sizes.length;
        const val = acc - (quantum ? 0.11 : 0.06) * (1 - frac) ** 1.6 + (r2() - 0.5) * 0.006;
        return { n: s, val: round(val, 3), train: round(Math.min(1, acc + gap + 0.04 * (1 - frac)), 3) };
      }),
    };
  });

  const significance = significanceTests(models, labels);
  return {
    experimentId,
    taskType: 'classification',
    datasetId,
    nSamples: n,
    folds,
    labels,
    models,
    significance,
    bandwidthSweep: undefined,
    noiseRobustness: [],
    qubitScaling: [],
    externalValidation: [],
    inputNoise: [],
    protocol: `${folds}-fold stratified CV (seed ${seed}) · out-of-fold predictions pooled for curves`,
    backend: 'Aer statevector',
  };
}

export function significanceTests(models: ModelResult[], labels: number[]): SignificanceTest[] {
  const classical = models.filter((m) => m.family === 'classical');
  const best = [...classical].sort((a, b) => (b.metrics!.accuracy.mean - a.metrics!.accuracy.mean) || (b.metrics!.rocAuc.mean - a.metrics!.rocAuc.mean))[0];
  if (!best) return [];
  const correct = (m: ModelResult) => m.scores!.map((s, i) => (s >= 0.5 ? 1 : 0) === labels[i]);
  const out: SignificanceTest[] = [];
  for (const q of models.filter((m) => m.family !== 'classical')) {
    for (const c of [best, ...classical.filter((m) => m !== best).slice(0, 1)]) {
      const mc = mcnemar(correct(q), correct(c));
      const t = pairedTTest(q.metrics!.accuracy.folds, c.metrics!.accuracy.folds);
      const w = wilcoxonSignedRank(q.metrics!.accuracy.folds, c.metrics!.accuracy.folds);
      const sig = mc.pValue < 0.05 && t.pValue < 0.05;
      const diff = q.metrics!.accuracy.mean - c.metrics!.accuracy.mean;
      const verdict = sig
        ? `${q.label} is significantly ${diff < 0 ? 'worse' : 'better'} than ${c.label} (both McNemar and paired t-test p < 0.05).`
        : mc.pValue < 0.05 || t.pValue < 0.05
          ? `Mixed evidence: one test is below 0.05, the other is not — treat the ${Math.abs(diff * 100).toFixed(1)}-pt gap as inconclusive.`
          : `No statistically significant difference between ${q.label} and ${c.label}.`;
      out.push({ modelA: q.modelId, modelB: c.modelId, metric: 'accuracy', mcnemar: { statistic: round(mc.statistic, 3), pValue: round(mc.pValue, 4), b: mc.b, c: mc.c }, pairedT: { statistic: round(t.statistic, 3), pValue: round(t.pValue, 4) }, wilcoxon: { statistic: w.statistic, pValue: round(w.pValue, 4) }, verdict, significant: sig });
    }
  }
  return out;
}

export function pocResults(experimentId = 'exp-poc-001', plans: ModelPlan[] = POC_PLANS): ExperimentResults {
  const r = classificationResults(experimentId, 'wdbc', plans, 212, 357, 5, 42);
  const ids = r.models.map((m) => m.modelId);
  const has = (id: string) => ids.includes(id);
  r.bandwidthSweep = has('qsvm_bw') || has('qsvm_raw') ? POC_BANDWIDTH_SWEEP.map((b) => ({ ...b, selected: b.bandwidth === 0.2 })) : undefined;
  const qModels = r.models.filter((m) => m.family !== 'classical').map((m) => m.modelId);
  const levels = [
    ['Ideal (statevector)', 0], ['Shots · 1024', 1], ['Noisy sim · p=0.001', 2], ['Noisy sim · p=0.005', 3], ['Noisy sim · p=0.01', 4], ['fake_manila model', 5], ['ibm_brisbane (1 run)', 6],
  ] as const;
  const drop = [0, 0.006, 0.014, 0.041, 0.078, 0.052, 0.067];
  r.noiseRobustness = levels.map(([level, x]) => {
    const series: Record<string, number> = {};
    const mitigated: Record<string, number> = {};
    for (const id of qModels) {
      const m = r.models.find((mm) => mm.modelId === id)!;
      const sens = m.kind === 'qsvm' ? 1.15 : m.kind === 'hybrid_nn' ? 0.8 : 1;
      series[id] = round(m.metrics!.accuracy.mean - drop[x] * sens, 3);
      mitigated[id] = round(m.metrics!.accuracy.mean - drop[x] * sens * 0.45, 3);
    }
    const lr = r.models.find((mm) => mm.modelId === 'logreg');
    if (lr) series.logreg = mitigated.logreg = lr.metrics!.accuracy.mean;
    return { level, x, series, mitigated };
  });
  r.qubitScaling = [4, 6, 8, 10, 12].map((q, i) => ({
    qubits: q,
    quantumAcc: [0.921, 0.94, 0.944, 0.938, 0.929][i],
    classicalAcc: [0.947, 0.958, 0.961, 0.963, 0.963][i],
    quantumRuntimeSec: [12, 41, 160, 690, 2900][i],
    classicalRuntimeSec: [0.2, 0.21, 0.23, 0.26, 0.3][i],
    memoryMb: round((16 * 2 ** q) / 1e6, 4),
  }));
  const ext: [string, number][] = [['logreg', -0.033], ['random_forest', -0.047], ['xgboost', -0.041], ['qsvm_bw', -0.034], ['vqc', -0.052], ['hybrid_nn', -0.038]];
  r.externalValidation = ext.filter(([id]) => has(id)).map(([id, d]) => {
    const m = r.models.find((mm) => mm.modelId === id)!;
    return { modelId: id, site: 'Site B · independent FNA cohort', internal: m.metrics!.rocAuc.mean, external: round(m.metrics!.rocAuc.mean + d, 3), metric: 'ROC-AUC' };
  });
  const sig = [0, 0.1, 0.2, 0.3, 0.5, 0.75, 1];
  const slope: Record<string, number> = { logreg: 0.07, svm_rbf: 0.075, random_forest: 0.06, xgboost: 0.065, qsvm_bw: 0.08, qsvm_raw: 0.03, vqc: 0.1, qnn: 0.095, hybrid_nn: 0.07 };
  r.inputNoise = sig.map((s) => {
    const series: Record<string, number> = {};
    for (const m of r.models) series[m.modelId] = round(Math.max(0.5, m.metrics!.accuracy.mean - (slope[m.modelId] ?? 0.08) * s ** 1.4), 3);
    return { sigma: s, series };
  });
  r.protocol = 'StandardScaler → PCA(6) → MinMax [0, π] → ZZ feature map (reps 2, linear) · 5-fold stratified CV (seed 42)';
  return r;
}

/** Generic seeded results for the other benchmark datasets. */
const DATASET_BASE: Record<string, [number, number]> = { heart: [0.8, 0.86], pima: [0.6, 0.86], parkinsons: [0.95, 0.75], ckd: [0.98, 0.99], leukemia: [0.88, 0.96] };
const KIND_OFFSET: Partial<Record<ModelKind, number>> = { logreg: 0, svm_rbf: 0.006, random_forest: 0.01, xgboost: 0.012, mlp: -0.004, qsvm: -0.018, vqc: -0.04, qnn: -0.03, hybrid_nn: -0.008 };

export function genericClassification(experimentId: string, datasetId: string, kinds: { modelId: string; kind: ModelKind }[], nPos: number, nNeg: number, folds: number): ExperimentResults {
  const [bs, bp] = DATASET_BASE[datasetId] ?? [0.82, 0.85];
  const plans: ModelPlan[] = kinds.map(({ modelId, kind }) => {
    const o = KIND_OFFSET[kind] ?? 0;
    return { modelId, kind, sens: Math.min(0.995, Math.max(0.3, bs + o * 1.3)), spec: Math.min(0.995, Math.max(0.3, bp + o)) };
  });
  const r = classificationResults(experimentId, datasetId, plans, nPos, nNeg, folds, 42);
  r.noiseRobustness = ['Ideal (statevector)', 'Shots · 1024', 'Noisy sim · p=0.005', 'Noisy sim · p=0.01'].map((level, x) => {
    const series: Record<string, number> = {};
    const mitigated: Record<string, number> = {};
    for (const m of r.models.filter((mm) => mm.family !== 'classical')) {
      series[m.modelId] = round(m.metrics!.accuracy.mean - [0, 0.007, 0.04, 0.075][x], 3);
      mitigated[m.modelId] = round(m.metrics!.accuracy.mean - [0, 0.003, 0.018, 0.034][x], 3);
    }
    return { level, x, series, mitigated };
  });
  return r;
}

/** Regression showcase: Parkinson's Telemonitoring (total_UPDRS). */
export function regressionResults(experimentId: string, kinds: { modelId: string; kind: ModelKind }[], folds = 5): ExperimentResults {
  const targets: Partial<Record<ModelKind, number>> = { linreg: 9.8, svr_rbf: 8.1, rf_regressor: 4.9, qsvr: 7.6, vqr: 8.9 };
  const rand = mulberry32(777);
  const actual = Array.from({ length: 420 }, () => round(Math.min(55, Math.max(7, 29 + 10.7 * gaussian(rand))), 2));
  const mean = actual.reduce((s, v) => s + v, 0) / actual.length;
  const models: ModelResult[] = kinds.map(({ modelId, kind }) => {
    const meta = modelMeta(kind);
    const rmseT = targets[kind] ?? 9;
    const r2 = mulberry32(hashSeed(modelId));
    const shrink = Math.max(0.2, 1 - (rmseT / 10.7) ** 2 * 0.6);
    const noise = actual.map(() => gaussian(r2));
    const base = actual.map((a) => mean + shrink * (a - mean));
    const resid0 = actual.map((a, i) => a - base[i]);
    const needVar = rmseT ** 2 - resid0.reduce((s, v) => s + v * v, 0) / actual.length;
    const scale = Math.sqrt(Math.max(0.01, needVar) / (noise.reduce((s, v) => s + v * v, 0) / noise.length));
    const predicted = base.map((b, i) => round(b + noise[i] * scale, 2));
    const m = regressionMetrics(actual, predicted);
    const z = Array.from({ length: folds }, () => gaussian(r2));
    const eff = EFFICIENCY[kind];
    const quantum = meta.family !== 'classical';
    return {
      modelId, kind, label: meta.label, family: meta.family,
      regression: { rmse: meanStd(m.rmse, m.rmse * 0.05, z), mae: meanStd(m.mae, m.mae * 0.05, z), r2: meanStd(m.r2, 0.03, z.map((v) => -v)) },
      predictions: actual.map((a, i) => ({ actual: a, predicted: predicted[i] })),
      efficiency: { trainTimeSec: eff.t, inferenceMsPerSample: eff.inf, params: eff.params, qubits: quantum ? 6 : undefined, circuitDepth: quantum ? 19 : undefined, memoryMb: eff.mem },
      trainTestGap: { train: round(m.rmse * (kind === 'rf_regressor' ? 0.45 : 0.93), 2), test: round(m.rmse, 2) },
      learningCurve: [500, 1000, 2000, 3000, 4000, 4700].map((n, i) => ({ n, train: round(m.rmse * (0.8 + i * 0.02), 2), val: round(m.rmse * (1.35 - i * 0.07), 2) })),
    };
  });
  return {
    experimentId, taskType: 'regression', datasetId: 'telemonitoring', nSamples: 5875, folds, models, significance: [],
    noiseRobustness: [], qubitScaling: [], externalValidation: [], inputNoise: [],
    protocol: `${folds}-fold CV grouped by subject · 420 held-out visits plotted`, backend: 'Aer statevector',
  };
}
