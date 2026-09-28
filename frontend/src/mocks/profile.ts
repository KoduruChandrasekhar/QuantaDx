/** Dataset profiling (D1): schema stats, missingness, outliers, noise, correlations, balance, quality score, PHI detection. */
import type { ColumnProfile, DatasetProfile } from '@/types/api';
import { correlation } from '@/lib/linalg';
import { quantile } from '@/lib/metrics';
import { mulberry32 } from '@/lib/prng';
import { getDataset, getTable } from './data';

import { PHI_PATTERN } from '@/lib/phi';

function hist(xs: number[], lo: number, hi: number, bins = 16): number[] {
  const out = new Array<number>(bins).fill(0);
  const w = (hi - lo) / bins || 1;
  for (const x of xs) out[Math.min(bins - 1, Math.max(0, Math.floor((x - lo) / w)))]++;
  return out;
}

export function profileDataset(id: string): DatasetProfile {
  const ds = getDataset(id);
  const t = getTable(id);
  if (!t.columns.length) throw Object.assign(new Error('This image dataset has no features yet — run "Extract features" first.'), { status: 409 });
  const n = t.X.length;
  const maxCols = Math.min(t.columns.length, 40);
  const isClass = ds.taskType === 'classification';

  const columns: ColumnProfile[] = [];
  for (let j = 0; j < maxCols; j++) {
    const col = t.columns[j];
    const vals: number[] = [];
    const neg: number[] = [];
    const pos: number[] = [];
    let missing = 0;
    for (let i = 0; i < n; i++) {
      const v = t.X[i][j];
      if (v === null || Number.isNaN(v)) missing++;
      else {
        vals.push(v);
        (t.y[i] === 1 ? pos : neg).push(v);
      }
    }
    const sorted = [...vals].sort((a, b) => a - b);
    const mean = vals.reduce((s, v) => s + v, 0) / (vals.length || 1);
    const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, vals.length - 1));
    const q1 = quantile(sorted, 0.25), q3 = quantile(sorted, 0.75), iqr = q3 - q1;
    const lo = sorted[0] ?? 0, hi = sorted[sorted.length - 1] ?? 1;
    columns.push({
      name: col.name,
      type: col.type,
      unit: col.unit,
      missingPct: missing / n,
      unique: new Set(vals).size,
      min: lo,
      max: hi,
      mean,
      std: sd,
      q1,
      median: quantile(sorted, 0.5),
      q3,
      outliersIqr: iqr > 0 ? vals.filter((v) => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr).length : 0,
      outliersZ: sd > 0 ? vals.filter((v) => Math.abs((v - mean) / sd) > 3).length : 0,
      histogram: hist(vals, lo, hi),
      histByClass: isClass ? { neg: hist(neg, lo, hi), pos: hist(pos, lo, hi) } : undefined,
    });
  }

  // Missingness matrix on a deterministic row sample.
  const rand = mulberry32(99);
  const sampleRows = Array.from({ length: Math.min(80, n) }, () => Math.floor(rand() * n)).sort((a, b) => a - b);
  const missingMatrix = sampleRows.map((i) => t.columns.slice(0, Math.min(30, maxCols)).map((_, j) => (t.X[i][j] === null ? 1 : 0)));

  // Duplicates
  const seen = new Set<string>();
  let duplicates = 0;
  for (const row of t.X) {
    const key = row.slice(0, 40).join('|');
    if (seen.has(key)) duplicates++;
    else seen.add(key);
  }

  // Correlation on complete-ish rows (median-filled) of the first ≤ 30 numeric columns.
  const corrCols = Math.min(30, maxCols);
  const filled = t.X.map((r) => r.slice(0, corrCols).map((v, j) => (v === null ? columns[j].median : v)));
  const corr = correlation(filled);

  const totalMissing = columns.reduce((s, c) => s + c.missingPct, 0) / columns.length;
  const outlierRate = columns.reduce((s, c) => s + c.outliersZ, 0) / (n * columns.length);
  const suspiciousRows: DatasetProfile['suspiciousRows'] = [];
  for (let i = 0; i < n && suspiciousRows.length < 8; i++) {
    let extreme = 0;
    t.X[i].slice(0, maxCols).forEach((v, j) => {
      const c = columns[j];
      if (v !== null && c.std > 0 && Math.abs((v - c.mean) / c.std) > 3.2) extreme++;
    });
    if (extreme >= 2) suspiciousRows.push({ row: i, reason: `${extreme} features beyond 3.2 SD` });
  }

  const pos = t.y.filter((v) => v === 1).length;
  const classBalance = isClass ? { positive: pos, negative: n - pos, ratio: Math.max(pos, n - pos) / Math.max(1, Math.min(pos, n - pos)) } : undefined;
  const ratio = ds.features / n;
  const phiColumns = t.columns.map((c) => c.name).filter((c) => PHI_PATTERN.test(c));

  const qb = [
    { label: 'Completeness', max: 25, score: Math.round(25 * Math.max(0, 1 - totalMissing * 6)) },
    { label: 'Uniqueness (no duplicates)', max: 15, score: Math.round(15 * Math.max(0, 1 - (duplicates / n) * 20)) },
    { label: 'Outliers / noise', max: 15, score: Math.round(15 * Math.max(0, 1 - outlierRate * 25)) },
    { label: 'Class balance', max: 15, score: classBalance ? Math.round(15 * Math.min(1, 1.5 / classBalance.ratio)) : 15 },
    { label: 'Dimensionality', max: 20, score: Math.round(20 * Math.min(1, 0.5 / Math.max(ratio, 0.01))) },
    { label: 'Privacy (no PHI)', max: 10, score: phiColumns.length ? 0 : 10 },
  ];

  const previewCols = t.columns.slice(0, Math.min(t.columns.length, 60)).map((c) => c.name);
  const negShort = ds.classBalance?.negativeLabel.match(/\(([^)]+)\)/)?.[1] ?? '0';
  return {
    datasetId: id,
    rows: n,
    columns,
    missingMatrix,
    missingPattern: totalMissing === 0 ? 'none' : 'MCAR-like',
    duplicates,
    noiseEstimate: Math.min(1, outlierRate * 8 + totalMissing),
    suspiciousRows,
    correlation: { names: columns.slice(0, corrCols).map((c) => c.name), matrix: corr },
    classBalance,
    featureSampleRatio: ratio,
    qualityScore: qb.reduce((s, b) => s + b.score, 0),
    qualityBreakdown: qb,
    phiColumns,
    previewColumns: [ds.target, ...previewCols],
    previewRows: t.X.map((r, i) => [ds.taskType === 'regression' ? t.y[i] : t.y[i] === 1 ? ds.positiveClass ?? '1' : negShort, ...r.slice(0, previewCols.length)]),
  };
}
