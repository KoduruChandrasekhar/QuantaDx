/** SHAP-style explanations (O5) + kernel matrix + loss landscape mocks, all derived from the model basis. */
import type { ExperimentResults, GlobalExplanation, KernelMatrix, LocalExplanation, LossLandscape } from '@/types/api';
import { gaussian, hashSeed, mulberry32, round } from '@/lib/prng';
import { fidelityKernel, kernelTargetAlignment } from '@/lib/quantum/kernel';
import { contributions, encodeRow, factorText, getBasis, prettyName } from './modelBasis';
import { getTable } from './data';

/** Map result-sample index → table row with the same class (results are pooled out-of-fold predictions). */
export function sampleRow(datasetId: string, labels: number[], i: number): number {
  const t = getTable(datasetId);
  const same = labels.slice(0, i).filter((l) => l === labels[i]).length;
  const rows = t.y.map((y, r) => (y === labels[i] ? r : -1)).filter((r) => r >= 0);
  return rows[same % rows.length];
}

function filledRow(datasetId: string, r: number): number[] {
  const b = getBasis(datasetId);
  return getTable(datasetId).X[r].slice(0, b.names.length).map((v, j) => (v === null ? b.median[j] : v));
}

const PC_IMPORTANCE = [0.41, 0.19, 0.12, 0.08, 0.05, 0.04];

export function globalExplanation(res: ExperimentResults, modelId: string): GlobalExplanation {
  const m = res.models.find((x) => x.modelId === modelId) ?? res.models[0];
  const b = getBasis(res.datasetId);
  const rand = mulberry32(hashSeed(modelId));
  const comp = b.components.map((_, k) => Math.max(0.01, (PC_IMPORTANCE[k] ?? 0.03) * (1 + (rand() - 0.5) * (m.family === 'classical' ? 0.3 : 0.6))));
  const original = b.names.map((f, j) => ({ feature: f, importance: b.components.reduce((s, c, k) => s + comp[k] * Math.abs(c[j]), 0) * (0.7 + 0.6 * Math.abs(b.weights[j]) * b.names.length / 3) }));
  const maxO = Math.max(...original.map((o) => o.importance));
  const originalN = original.map((o) => ({ ...o, importance: round((o.importance / maxO) * 0.12, 4) })).sort((a, c) => c.importance - a.importance);
  const t = getTable(res.datasetId);
  const beeswarm = originalN.slice(0, 8).map(({ feature, importance }) => {
    const j = b.names.indexOf(feature);
    const pts = Array.from({ length: 90 }, (_, k) => {
      const row = t.X[(k * 7) % t.X.length];
      const v = row[j] ?? b.median[j];
      const z = (v - b.mean[j]) / b.std[j];
      return { shap: round(Math.sign(b.weights[j] || 1) * z * importance * 0.9 + gaussian(rand) * importance * 0.15, 4), value: round(Math.max(-2.5, Math.min(2.5, z)), 3) };
    });
    return { feature, points: pts };
  });
  const method = m.kind === 'random_forest' || m.kind === 'xgboost' ? 'tree_shap' : m.family === 'classical' ? 'kernel_shap' : 'permutation';
  return {
    modelId: m.modelId,
    method,
    backgroundSize: method === 'kernel_shap' ? 100 : undefined,
    components: comp.map((v, k) => ({ feature: `PC${k + 1}`, importance: round(v, 4) })),
    original: originalN,
    beeswarm,
    qubitImportance: comp.map((v) => round(v / Math.max(...comp), 3)),
    note:
      method === 'permutation'
        ? 'Quantum models use permutation importance (KernelExplainer is too costly per circuit evaluation); SHAP values are estimated from a 100-sample background.'
        : method === 'kernel_shap'
          ? 'KernelExplainer uses a 100-sample background drawn from the training split.'
          : 'TreeExplainer gives exact SHAP values for tree ensembles.',
  };
}

export function localExplanation(res: ExperimentResults, modelId: string, sampleIndex: number, threshold = 0.5): LocalExplanation {
  const m = res.models.find((x) => x.modelId === modelId) ?? res.models[0];
  const b = getBasis(res.datasetId);
  const labels = res.labels ?? [];
  const r = sampleRow(res.datasetId, labels, sampleIndex);
  const row = filledRow(res.datasetId, r);
  const prob = m.scores?.[sampleIndex] ?? 0.5;
  const base = (m.scores ?? [0.5]).reduce((s, v) => s + v, 0) / (m.scores?.length || 1);
  const contrib = contributions(b, row).sort((a, c) => Math.abs(c.contribution) - Math.abs(a.contribution)).slice(0, 10);
  const sum = contrib.reduce((s, c) => s + c.contribution, 0);
  const scale = Math.abs(sum) < 1e-9 ? 0 : (prob - base) / sum;
  // Scale so contributions add exactly to (probability − base value); keep sign pattern.
  const scaled = contrib.map((c) => ({ ...c, contribution: round(c.contribution * Math.abs(scale), 4) }));
  const residual = round(prob - base - scaled.reduce((s, c) => s + c.contribution, 0), 4);
  if (Math.abs(residual) > 1e-4) scaled.push({ feature: 'other features', value: NaN, contribution: residual, z: 0 });
  const top = scaled.filter((c) => c.feature !== 'other features').slice(0, 3);
  const ups = top.filter((c) => c.contribution > 0).map((c) => prettyName(c.feature));
  const downs = top.filter((c) => c.contribution < 0).map((c) => prettyName(c.feature));
  const summary = `${ups.length ? `${ups.join(' and ')} increased the estimated risk` : ''}${ups.length && downs.length ? '; ' : ''}${downs.length ? `${downs.join(' and ')} lowered it` : ''}. Estimated probability ${(prob * 100).toFixed(1)}% vs decision threshold ${(threshold * 100).toFixed(0)}%.`;
  const flip = prob >= threshold ? -1 : 1;
  const cf = top.slice(0, 2).map((c) => {
    const j = b.names.indexOf(c.feature);
    const target = flip < 0 ? b.meanNeg[j] : b.meanPos[j];
    const to = row[j] + (target - row[j]) * Math.min(1, 0.35 + Math.abs(prob - threshold));
    return { feature: prettyName(c.feature), from: round(row[j], 4), to: round(to, 4), unit: b.units[j] };
  });
  return {
    modelId: m.modelId,
    sampleIndex,
    probability: prob,
    baseValue: round(base, 4),
    label: labels[sampleIndex] ?? 0,
    contributions: scaled.map((c) => ({
      feature: c.feature,
      value: c.value,
      contribution: c.contribution,
      text: c.feature === 'other features' ? 'Combined effect of the remaining features.' : factorText(c.feature, c.value, b.units[b.names.indexOf(c.feature)], c.z, c.contribution, false),
    })),
    summary,
    counterfactual: cf,
    encodedX: encodeRow(b, row),
  };
}

export function kernelMatrix(res: ExperimentResults, modelId: string, bandwidth: number): KernelMatrix {
  const b = getBasis(res.datasetId);
  const labels = res.labels ?? [];
  const pick: number[] = [];
  for (let i = 0; i < labels.length && pick.length < 36; i += 7) pick.push(i);
  const xs = pick.map((i) => encodeRow(b, filledRow(res.datasetId, sampleRow(res.datasetId, labels, i))));
  const ys = pick.map((i) => labels[i]);
  const K = fidelityKernel(xs, 'zz_feature_map', bandwidth, 2, 'linear');
  return { modelId, bandwidth, labels: ys, matrix: K.map((r) => r.map((v) => round(v, 4))), alignment: round(kernelTargetAlignment(K, ys), 4) };
}

export function lossLandscape(modelId: string, noisy = false): LossLandscape {
  const rand = mulberry32(hashSeed(modelId) + 5);
  const N = 36;
  const range: [number, number] = [-Math.PI, Math.PI];
  const f = (a: number, c: number) =>
    0.36 - 0.13 * Math.cos(a - 0.8) * Math.cos(c + 0.4) - 0.05 * Math.cos(2 * a + 0.3) + 0.04 * Math.sin(1.5 * c) + 0.03 * Math.cos(a + 2 * c) + (noisy ? 0.06 : 0);
  const grid = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => round(f(range[0] + (i / (N - 1)) * 2 * Math.PI, range[0] + (j / (N - 1)) * 2 * Math.PI) + (rand() - 0.5) * 0.004, 4)),
  );
  let a = -2.4, c = 2.2;
  const path: LossLandscape['path'] = [];
  for (let k = 0; k < 60; k++) {
    const h = 1e-3;
    const ga = (f(a + h, c) - f(a - h, c)) / (2 * h);
    const gc = (f(a, c + h) - f(a, c - h)) / (2 * h);
    a -= 0.9 * ga + (rand() - 0.5) * 0.05;
    c -= 0.9 * gc + (rand() - 0.5) * 0.05;
    path.push({ a: round(a, 3), b: round(c, 3), loss: round(f(a, c), 4) });
  }
  return { modelId, params: ['θ₀', 'θ₁'], grid, range, path };
}
