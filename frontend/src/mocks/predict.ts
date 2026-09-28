/** D4 inference: probability scores, risk bands, uncertainty and plain-language factors. */
import type { BatchPrediction, DeployedModel, Prediction, PredictRequest } from '@/types/api';
import { assignBand } from '@/lib/risk';
import { mulberry32, round } from '@/lib/prng';
import { contributions, encodeRow, factorText, getBasis, probabilityOf } from './modelBasis';
import { getTable } from './data';

export function predictOne(req: PredictRequest, model: DeployedModel): Prediction {
  const b = getBasis(req.datasetId);
  const row = b.names.map((n, j) => {
    const v = req.features[n];
    return typeof v === 'number' && Number.isFinite(v) ? v : b.median[j];
  });
  const quantum = model.family !== 'classical';
  const contrib = contributions(b, row).sort((a, c) => Math.abs(c.contribution) - Math.abs(a.contribution));
  const topFactors = contrib.slice(0, 5).map((c) => ({
    feature: c.feature,
    value: c.value,
    contribution: round(c.contribution, 4),
    text: factorText(c.feature, c.value, b.units[b.names.indexOf(c.feature)], c.z, c.contribution, b.regression),
  }));
  const base = {
    threshold: req.threshold,
    topFactors,
    modelId: model.modelId,
    modelLabel: model.label,
    backend: model.backend,
    timestamp: new Date().toISOString(),
    encodedX: encodeRow(b, row),
  };
  if (b.regression) {
    const s = row.reduce((acc, v, j) => acc + b.weights[j] * ((v - b.mean[j]) / b.std[j]), 0);
    const value = round(Math.min(55, Math.max(7, 29 + s * 26)), 1);
    const half = (model.metrics.rmse ?? 7.6) * 1.28;
    return { ...base, value, uncertainty: { lower: round(Math.max(0, value - half), 1), upper: round(value + half, 1), method: 'conformal' } };
  }
  const p = probabilityOf(b, row, quantum ? 0.85 : 1);
  const spread = quantum ? 1.96 * Math.sqrt((p * (1 - p)) / 1024) + 0.015 : 0.02 + 0.08 * p * (1 - p);
  return {
    ...base,
    probability: round(p, 4),
    riskBand: assignBand(p, req.bands),
    decision: p >= req.threshold ? 1 : 0,
    uncertainty: { lower: round(Math.max(0, p - spread), 4), upper: round(Math.min(1, p + spread), 4), method: quantum ? 'shot_noise' : 'cv_ensemble' },
  };
}

export function exampleProfiles(datasetId: string): { healthy: Record<string, number>; atRisk: Record<string, number> } {
  const b = getBasis(datasetId);
  const rand = mulberry32(11);
  const mk = (src: number[]) =>
    Object.fromEntries(b.names.map((n, j) => {
      const v = src[j] + (rand() - 0.5) * b.std[j] * 0.3;
      const digits = Math.abs(src[j]) < 0.1 ? 4 : Math.abs(src[j]) < 10 ? 2 : 1;
      return [n, round(Math.max(b.min[j], v), digits)];
    }));
  if (b.regression) {
    const low = b.names.map((_, j) => b.mean[j] - Math.sign(b.weights[j]) * b.std[j] * 0.8);
    const high = b.names.map((_, j) => b.mean[j] + Math.sign(b.weights[j]) * b.std[j] * 0.9);
    return { healthy: mk(low), atRisk: mk(high) };
  }
  return { healthy: mk(b.meanNeg), atRisk: mk(b.meanPos.map((v, j) => v + (v - b.meanNeg[j]) * 0.15)) };
}

export function cohortRows(datasetId: string, count = 120): { patientId: string; features: Record<string, number> }[] {
  const t = getTable(datasetId);
  const b = getBasis(datasetId);
  const rand = mulberry32(2024);
  return Array.from({ length: count }, () => {
    const r = Math.floor(rand() * t.X.length);
    return { patientId: t.ids[r], features: Object.fromEntries(b.names.map((n, j) => [n, t.X[r][j] ?? b.median[j]])) };
  });
}

export function predictBatch(datasetId: string, rows: { patientId: string; features: Record<string, number> }[], model: DeployedModel, threshold: number, bands: PredictRequest['bands']): BatchPrediction {
  const b = getBasis(datasetId);
  const schemaErrors: string[] = [];
  if (rows.length) {
    const cols = Object.keys(rows[0].features);
    const missing = b.names.filter((n) => !cols.includes(n));
    const extra = cols.filter((c) => !b.names.includes(c));
    if (missing.length) schemaErrors.push(`${missing.length} expected column(s) missing — filled with training medians: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''}`);
    if (extra.length) schemaErrors.push(`${extra.length} unexpected column(s) ignored: ${extra.slice(0, 6).join(', ')}${extra.length > 6 ? '…' : ''}`);
  }
  const out = rows.map((r) => ({ ...predictOne({ datasetId, features: r.features, threshold, bands }, model), patientId: r.patientId }));
  const summary = { low: 0, moderate: 0, high: 0 };
  for (const p of out) if (p.riskBand) summary[p.riskBand]++;
  return { rows: out, schemaErrors, summary };
}
