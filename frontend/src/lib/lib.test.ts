import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { confusionAt, metricsFromConfusion, regressionMetrics, rocAuc, rocCurve } from './metrics';
import { assignBand, bandsFromCuts, costWeightedThreshold, normalizeCuts, sensitivityConstrainedThreshold, youdenThreshold, DEFAULT_BANDS } from './risk';
import { mcnemar, pairedTTest, wilcoxonSignedRank } from './stats';
import { deltaPts, duration, pct1, bytes } from './format';
import { DELIVERABLES, EXPECTED_SOLUTION } from '@/content/deliverables';
import { GLOSSARY } from '@/content/glossary';

describe('metrics', () => {
  it('confusion-matrix metrics', () => {
    const m = metricsFromConfusion({ tp: 201, fn: 11, tn: 346, fp: 11 });
    expect(m.sensitivity).toBeCloseTo(0.948, 3);
    expect(m.specificity).toBeCloseTo(0.969, 3);
    expect(m.accuracy).toBeCloseTo(547 / 569, 9);
  });
  it('MCC handles zero division', () => {
    expect(metricsFromConfusion({ tp: 0, fn: 0, tn: 10, fp: 0 }).mcc).toBe(0);
  });
  it('threshold recomputation', () => {
    const s = [0.1, 0.4, 0.6, 0.9], y = [0, 0, 1, 1];
    expect(confusionAt(s, y, 0.5)).toEqual({ tp: 2, fp: 0, tn: 2, fn: 0 });
    expect(confusionAt(s, y, 0.05)).toEqual({ tp: 2, fp: 2, tn: 0, fn: 0 });
    expect(rocAuc(rocCurve(s, y))).toBeCloseTo(1, 9);
  });
  it('RMSE / MAE / R²', () => {
    const r = regressionMetrics([1, 2, 3], [1, 2, 4]);
    expect(r.rmse).toBeCloseTo(Math.sqrt(1 / 3), 9);
    expect(r.mae).toBeCloseTo(1 / 3, 9);
    expect(r.r2).toBeCloseTo(0.5, 9);
  });
});

describe('risk', () => {
  const s = [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95], y = [0, 0, 0, 1, 0, 1, 1];
  it('band assignment', () => {
    expect(assignBand(0.1, DEFAULT_BANDS)).toBe('low');
    expect(assignBand(0.5, DEFAULT_BANDS)).toBe('moderate');
    expect(assignBand(0.7, DEFAULT_BANDS)).toBe('high');
  });
  it('cut-points stay ordered and non-overlapping', () => {
    const [a, b] = normalizeCuts(0.8, 0.2);
    expect(a).toBeLessThan(b);
    const [c, d] = normalizeCuts(0.5, 0.5);
    expect(d - c).toBeGreaterThanOrEqual(0.02 - 1e-9);
    const bands = bandsFromCuts(0.9, 0.1);
    expect(bands.low[1]).toBe(bands.moderate[0]);
    expect(bands.moderate[1]).toBe(bands.high[0]);
  });
  it('Youden, cost-weighted and sensitivity-constrained thresholds', () => {
    const t = youdenThreshold(s, y);
    expect(t).toBeGreaterThan(0.35);
    expect(t).toBeLessThanOrEqual(0.5);
    expect(costWeightedThreshold(s, y, 100, 1)).toBeLessThanOrEqual(0.5);
    const ts = sensitivityConstrainedThreshold(s, y, 1);
    expect(metricsFromConfusion(confusionAt(s, y, ts)).sensitivity).toBe(1);
  });
});

describe('stats', () => {
  it('McNemar counts discordant pairs', () => {
    const r = mcnemar([true, true, false, true], [false, true, true, false]);
    expect(r.b).toBe(2);
    expect(r.c).toBe(1);
    expect(r.pValue).toBeGreaterThan(0.05);
  });
  it('Wilcoxon with 5 folds cannot go below 0.0625', () => {
    expect(wilcoxonSignedRank([0.9, 0.91, 0.92, 0.93, 0.94], [0.8, 0.8, 0.8, 0.8, 0.8]).pValue).toBeCloseTo(0.0625, 6);
  });
  it('paired t-test detects a consistent shift', () => {
    expect(pairedTTest([0.9, 0.91, 0.92, 0.9, 0.93], [0.8, 0.82, 0.8, 0.81, 0.8]).pValue).toBeLessThan(0.01);
  });
});

describe('format', () => {
  it('formats clinical numbers', () => {
    expect(pct1(0.9687)).toBe('96.9%');
    expect(deltaPts(-0.021)).toBe('▼ 2.1 pts');
    expect(deltaPts(0)).toBe('● tied');
    expect(duration(0.42)).toBe('420 ms');
    expect(bytes(1024)).toBe('1.0 KB');
  });
});

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? sources(p) : /\.tsx?$/.test(f) && !f.includes('.test.') ? [p] : [];
  });
}

describe('traceability', () => {
  const all = sources(join(__dirname, '..')).map((p) => readFileSync(p, 'utf8')).join('\n');
  const router = readFileSync(join(__dirname, '..', 'app', 'router.tsx'), 'utf8');
  it('every D1–D5 key component points to an existing route and UI element', () => {
    for (const d of DELIVERABLES)
      for (const c of d.components) {
        const route = c.route.replace(/\/experiments\/[^/]+\//, '/experiments/:id/');
        expect(router, `${c.id} route ${route}`).toContain(`path: '${route}'`);
        const found = all.includes(`data-tour="${c.tourId}"`) || all.includes(`tourId="${c.tourId}"`) || all.includes(`data-tour={\`pp-step-\${step.kind}\`}`);
        expect(found, `${c.id} tour id ${c.tourId}`).toBe(true);
      }
  });
  it('expected-solution checklist targets exist', () => {
    for (const e of EXPECTED_SOLUTION) expect(all.includes(`data-tour="${e.tourId}"`) || all.includes(`tourId="${e.tourId}"`), e.tourId).toBe(true);
  });
  it('glossary has ≥ 45 terms', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(45);
  });
});
