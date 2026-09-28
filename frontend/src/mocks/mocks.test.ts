import { describe, expect, it } from 'vitest';
import { pocResults, regressionResults } from './results';
import { confusionAt, metricsFromConfusion, regressionMetrics, rocAuc, rocCurve, trapezoidAuc } from '@/lib/metrics';
import { profileDataset } from './profile';
import { runPipeline } from './preprocess';
import { quantumReadyPreset } from '@/content/preprocess';

const r = pocResults();
const get = (id: string) => r.models.find((m) => m.modelId === id)!;

describe('PoC demo experiment (Section 6.4)', () => {
  it.each([
    ['logreg', 0.961, 0.948, 0.969, 0.995],
    ['svm_rbf', 0.961, 0.948, 0.969, 0.995],
    ['random_forest', 0.953, 0.929, 0.967, 0.988],
    ['qsvm_raw', 0.808, 0.722, 0.86, 0.885],
    ['qsvm_bw', 0.94, 0.892, 0.969, 0.985],
  ])('%s reports exactly the PoC numbers', (id, acc, sens, spec, auc) => {
    const m = get(id).metrics!;
    expect(m.accuracy.mean).toBe(acc);
    expect(m.sensitivity.mean).toBe(sens);
    expect(m.specificity.mean).toBe(spec);
    expect(m.rocAuc.mean).toBe(auc);
  });

  it('confusion matrices sum to 569 and sens/spec recomputed from them match the reported values', () => {
    for (const m of r.models) {
      const c = m.confusion!;
      expect(c.tp + c.fp + c.tn + c.fn).toBe(569);
      const k = metricsFromConfusion(c);
      expect(Math.abs(k.sensitivity - m.metrics!.sensitivity.mean)).toBeLessThanOrEqual(0.005);
      expect(Math.abs(k.specificity - m.metrics!.specificity.mean)).toBeLessThanOrEqual(0.005);
      expect(Math.abs(k.accuracy - m.metrics!.accuracy.mean)).toBeLessThanOrEqual(0.005);
    }
  });

  it('confusion matrix is reproduced from the scores at threshold 0.5', () => {
    for (const m of r.models) expect(confusionAt(m.scores!, r.labels!, 0.5)).toEqual(m.confusion);
  });

  it('ROC curves are monotonic and AUC matches within ±0.005', () => {
    for (const m of r.models) {
      const full = rocCurve(m.scores!, r.labels!);
      expect(Math.abs(rocAuc(full) - m.metrics!.rocAuc.mean)).toBeLessThanOrEqual(0.005);
      for (let i = 1; i < m.roc!.length; i++) {
        expect(m.roc![i].fpr).toBeGreaterThanOrEqual(m.roc![i - 1].fpr);
        expect(m.roc![i].tpr).toBeGreaterThanOrEqual(m.roc![i - 1].tpr);
      }
      expect(Math.abs(trapezoidAuc(m.roc!.map((p) => ({ x: p.fpr, y: p.tpr }))) - m.metrics!.rocAuc.mean)).toBeLessThanOrEqual(0.006);
    }
  });

  it('fold values average to the reported mean', () => {
    for (const m of r.models)
      for (const ms of Object.values(m.metrics!)) {
        const avg = ms.folds.reduce((s: number, v: number) => s + v, 0) / ms.folds.length;
        expect(Math.abs(avg - ms.mean)).toBeLessThan(0.0006);
      }
  });

  it('quantum models never beat the best classical model on every metric', () => {
    const best = get('logreg').metrics!;
    for (const m of r.models.filter((x) => x.family !== 'classical')) {
      const k = m.metrics!;
      const beatsAll = k.accuracy.mean > best.accuracy.mean && k.sensitivity.mean > best.sensitivity.mean && k.specificity.mean > best.specificity.mean && k.rocAuc.mean > best.rocAuc.mean;
      expect(beatsAll).toBe(false);
    }
  });

  it('bandwidth sweep matches the PoC and selects 0.2', () => {
    expect(r.bandwidthSweep!.map((b) => b.accuracy)).toEqual([0.917, 0.939, 0.94, 0.917, 0.912, 0.815]);
    expect(r.bandwidthSweep!.find((b) => b.selected)!.bandwidth).toBe(0.2);
  });
});

describe('regression mock', () => {
  it('reported RMSE/MAE/R² equal the metrics recomputed from residuals', () => {
    const rr = regressionResults('x', [{ modelId: 'linreg', kind: 'linreg' }, { modelId: 'rf', kind: 'rf_regressor' }]);
    for (const m of rr.models) {
      const k = regressionMetrics(m.predictions!.map((p) => p.actual), m.predictions!.map((p) => p.predicted));
      expect(Math.abs(k.rmse - m.regression!.rmse.mean)).toBeLessThan(1e-3);
      expect(Math.abs(k.mae - m.regression!.mae.mean)).toBeLessThan(1e-3);
      expect(Math.abs(k.r2 - m.regression!.r2.mean)).toBeLessThan(1e-3);
    }
  });
});

describe('D1 pipeline mock', () => {
  it('profiles WDBC with missingness and duplicates', () => {
    const p = profileDataset('wdbc');
    expect(p.rows).toBe(569);
    expect(p.columns).toHaveLength(30);
    expect(p.columns.some((c) => c.missingPct > 0)).toBe(true);
    expect(p.classBalance!.positive).toBe(212);
  });
  it('quantum-ready preset produces 6 features in [0, π]', () => {
    const out = runPipeline('wdbc', quantumReadyPreset());
    expect(out.finalFeatures).toHaveLength(6);
    for (const row of out.finalX)
      for (const v of row) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(Math.PI + 1e-9);
      }
    expect(out.leakageGuard.every((g) => g.ok)).toBe(true);
  });
});
