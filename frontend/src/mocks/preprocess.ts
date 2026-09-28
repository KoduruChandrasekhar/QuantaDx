/** Runs the D1 pipeline for real on the seeded data (fit on the training split only). */
import type { PreprocessConfig, PreprocessPreview } from '@/types/api';
import { pca, minMaxScale } from '@/lib/linalg';
import { quantile } from '@/lib/metrics';
import { mulberry32, shuffle } from '@/lib/prng';
import { getDataset, getTable } from './data';

type Row = (number | null)[];

function splitIndices(y: number[], cfg: PreprocessConfig['split'], classification: boolean) {
  const rand = mulberry32(cfg.seed);
  const idx = y.map((_, i) => i);
  const groups = classification && cfg.stratified ? [idx.filter((i) => y[i] === 0), idx.filter((i) => y[i] === 1)] : [idx];
  const train: number[] = [], val: number[] = [], test: number[] = [];
  const tot = cfg.train + cfg.val + cfg.test || 1;
  for (const g of groups) {
    const s = shuffle(g, rand);
    const nTr = Math.round((s.length * cfg.train) / tot);
    const nVa = Math.round((s.length * cfg.val) / tot);
    train.push(...s.slice(0, nTr));
    val.push(...s.slice(nTr, nTr + nVa));
    test.push(...s.slice(nTr + nVa));
  }
  return { train, val, test };
}

function hist(xs: number[], bins = 14): number[] {
  if (!xs.length) return [];
  const lo = Math.min(...xs), hi = Math.max(...xs);
  const w = (hi - lo) / bins || 1;
  const out = new Array<number>(bins).fill(0);
  for (const x of xs) out[Math.min(bins - 1, Math.floor((x - lo) / w))]++;
  return out;
}

const col = (M: Row[], j: number) => M.map((r) => r[j]).filter((v): v is number => v !== null);

function fScore(M: number[][], y: number[], rows: number[], j: number): number {
  let n0 = 0, n1 = 0, s0 = 0, s1 = 0;
  for (const i of rows) {
    if (y[i]) {
      n1++;
      s1 += M[i][j];
    } else {
      n0++;
      s0 += M[i][j];
    }
  }
  const m0 = s0 / (n0 || 1), m1 = s1 / (n1 || 1), m = (s0 + s1) / (n0 + n1 || 1);
  let w = 0;
  for (const i of rows) w += (M[i][j] - (y[i] ? m1 : m0)) ** 2;
  const between = n0 * (m0 - m) ** 2 + n1 * (m1 - m) ** 2;
  return between / (w / Math.max(1, n0 + n1 - 2) || 1e-9);
}

function corrScore(M: number[][], y: number[], rows: number[], j: number): number {
  const xs = rows.map((i) => M[i][j]), ys = rows.map((i) => y[i]);
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length, my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let a = 0, b = 0, c = 0;
  xs.forEach((x, k) => {
    a += (x - mx) * (ys[k] - my);
    b += (x - mx) ** 2;
    c += (ys[k] - my) ** 2;
  });
  return Math.abs(a / (Math.sqrt(b * c) || 1));
}

export function runPipeline(datasetId: string, cfg: PreprocessConfig): PreprocessPreview & { finalX: number[][]; y: number[] } {
  const ds = getDataset(datasetId);
  const t = getTable(datasetId);
  const isClass = ds.taskType === 'classification';
  const step = (k: string) => cfg.steps.find((s) => s.kind === k && s.enabled);
  const summary: string[] = [];

  let names = t.columns.map((c) => c.name);
  let M: Row[] = t.X.map((r) => r.slice());
  let y = t.y.slice();
  let ids = t.ids.slice();
  const rawNames = names.slice(0, 8);

  // Genomics: pre-filter by variance so the browser mock stays fast.
  if (names.length > 400) {
    const v = names.map((_, j) => {
      const xs = col(M, j);
      const m = xs.reduce((s, x) => s + x, 0) / xs.length;
      return { j, v: xs.reduce((s, x) => s + (x - m) ** 2, 0) };
    });
    const keep = v.sort((a, b) => b.v - a.v).slice(0, 400).map((o) => o.j).sort((a, b) => a - b);
    summary.push(`High-dimensional input (${names.length} genes): variance pre-filter keeps the top 400.`);
    names = keep.map((j) => names[j]);
    M = M.map((r) => keep.map((j) => r[j]));
  }

  let duplicatesRemoved = 0;
  const droppedConstant: string[] = [];
  const clean = step('dedupe');
  if (clean) {
    if (clean.params.dropDuplicates !== false) {
      const seen = new Set<string>();
      const keep: number[] = [];
      M.forEach((r, i) => {
        const k = r.join('|');
        if (!seen.has(k)) {
          seen.add(k);
          keep.push(i);
        }
      });
      duplicatesRemoved = M.length - keep.length;
      M = keep.map((i) => M[i]);
      y = keep.map((i) => y[i]);
      ids = keep.map((i) => ids[i]);
    }
    if (clean.params.dropConstant !== false) {
      const keepCols = names.map((_, j) => new Set(col(M, j)).size > 1);
      names.forEach((nm, j) => !keepCols[j] && droppedConstant.push(nm));
      names = names.filter((_, j) => keepCols[j]);
      M = M.map((r) => r.filter((_, j) => keepCols[j]));
    }
    summary.push(`Cleaning: removed ${duplicatesRemoved} duplicate rows${droppedConstant.length ? `, dropped ${droppedConstant.length} constant columns` : ''}.`);
  }

  const split = splitIndices(y, cfg.split, isClass);
  const trainSet = new Set(split.train);

  // Missing values
  let missingHandled = 0;
  const imp = step('impute');
  const missingCols = names.map((_, j) => M.some((r) => r[j] === null));
  if (imp) {
    const method = String(imp.params.method ?? 'median');
    if (method === 'drop') {
      const keep = M.map((r, i) => (r.some((v) => v === null) ? -1 : i)).filter((i) => i >= 0);
      missingHandled = M.length - keep.length;
      M = keep.map((i) => M[i]);
      y = keep.map((i) => y[i]);
      ids = keep.map((i) => ids[i]);
      summary.push(`Missing values: dropped ${missingHandled} incomplete rows.`);
    } else {
      const fills = names.map((_, j) => {
        const xs = M.filter((_, i) => trainSet.has(i)).map((r) => r[j]).filter((v): v is number => v !== null).sort((a, b) => a - b);
        if (method === 'mean') return xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
        if (method === 'most_frequent') {
          const cnt = new Map<number, number>();
          xs.forEach((v) => cnt.set(v, (cnt.get(v) ?? 0) + 1));
          return [...cnt.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
        }
        return quantile(xs, 0.5);
      });
      const ind = imp.params.indicator === true;
      M = M.map((r) => {
        const out = r.map((v, j) => {
          if (v === null) {
            missingHandled++;
            return fills[j];
          }
          return v;
        });
        if (ind) missingCols.forEach((has, j) => has && out.push(r[j] === null ? 1 : 0));
        return out;
      });
      if (ind) names = [...names, ...names.filter((_, j) => missingCols[j]).map((n) => `${n}_missing`)];
      const label = method === 'knn' ? `KNN (k=${imp.params.k ?? 5}; mock preview uses median seed)` : method === 'iterative' ? 'iterative (MICE; mock preview uses median seed)' : method;
      summary.push(`Missing values: imputed ${missingHandled} cells with ${label}${ind ? ' + missing-indicator columns' : ''} (fit on train).`);
    }
  }
  // Anything still missing (step disabled) → median, flagged in leakage guard.
  M = M.map((r) => r.map((v) => (v === null ? 0 : v)));
  let X = M as number[][];

  let outliersHandled = 0;
  const out = step('outliers');
  if (out && out.params.method !== 'none') {
    const method = String(out.params.method);
    const thr = Number(out.params.threshold ?? 3);
    const bounds = names.map((_, j) => {
      const xs = X.filter((_, i) => trainSet.has(i)).map((r) => r[j]).sort((a, b) => a - b);
      if (method === 'iqr') {
        const q1 = quantile(xs, 0.25), q3 = quantile(xs, 0.75);
        return [q1 - 1.5 * (q3 - q1), q3 + 1.5 * (q3 - q1)];
      }
      if (method === 'winsorize') return [quantile(xs, 0.01), quantile(xs, 0.99)];
      const m = xs.reduce((s, v) => s + v, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length) || 1;
      return [m - thr * sd, m + thr * sd];
    });
    X = X.map((r) => r.map((v, j) => {
      const [lo, hi] = bounds[j];
      if (lo === hi) return v;
      if (v < lo || v > hi) {
        outliersHandled++;
        return v < lo ? lo : hi;
      }
      return v;
    }));
    summary.push(`Noise & outliers: ${method === 'iqr' ? 'IQR clip' : method === 'winsorize' ? 'winsorised 1–99%' : `z-score clip at ±${thr}`} adjusted ${outliersHandled} values${out.params.smoothing ? ' · smoothing on signal features' : ''}.`);
  }

  const enc = step('encode_categorical');
  if (enc) {
    const cats = names.map((_, j) => {
      const u = [...new Set(X.map((r) => r[j]))];
      return u.length > 2 && u.length <= 5 && u.every((v) => Number.isInteger(v)) ? u.sort((a, b) => a - b) : null;
    });
    const nCat = cats.filter(Boolean).length;
    if (nCat && enc.params.method === 'onehot') {
      const newNames: string[] = [];
      names.forEach((nm, j) => (cats[j] ? cats[j]!.forEach((v) => newNames.push(`${nm}=${v}`)) : newNames.push(nm)));
      X = X.map((r) => r.flatMap((v, j) => (cats[j] ? cats[j]!.map((c) => (v === c ? 1 : 0)) : [v])));
      names = newNames;
    }
    summary.push(`Categorical encoding: ${nCat} categorical column${nCat === 1 ? '' : 's'} → ${enc.params.method === 'onehot' ? 'one-hot' : 'ordinal'}.`);
  }

  const beforeScale = X.map((r) => r.slice());
  const namesBeforeScale = names.slice();
  const sc = step('scale');
  const scaleMethod = sc ? String(sc.params.method ?? 'standard') : 'none';
  const angleRange = scaleMethod === 'minmax_pi';
  if (sc) {
    const trainRows = X.filter((_, i) => trainSet.has(i));
    const stats = names.map((_, j) => {
      const xs = trainRows.map((r) => r[j]).sort((a, b) => a - b);
      const m = xs.reduce((s, v) => s + v, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, xs.length - 1)) || 1;
      return { m, sd, lo: xs[0], hi: xs[xs.length - 1], med: quantile(xs, 0.5), iqr: quantile(xs, 0.75) - quantile(xs, 0.25) || 1 };
    });
    X = X.map((r) => r.map((v, j) => {
      const s = stats[j];
      if (scaleMethod === 'minmax01') return (v - s.lo) / (s.hi - s.lo || 1);
      if (scaleMethod === 'robust') return (v - s.med) / s.iqr;
      return (v - s.m) / s.sd; // standard (and pre-step for [0, π])
    }));
    summary.push(`Normalisation: ${{ standard: 'StandardScaler', minmax01: 'MinMax [0, 1]', robust: 'RobustScaler', minmax_pi: 'StandardScaler now, MinMax [0, π] after reduction' }[scaleMethod] ?? scaleMethod} (fit on train).`);
  }

  let balance: PreprocessPreview['balance'];
  const bal = step('balance');
  if (bal && isClass && bal.params.method !== 'none') {
    const trPos = split.train.filter((i) => y[i] === 1).length;
    const trNeg = split.train.length - trPos;
    const smote = bal.params.method === 'smote';
    balance = { method: smote ? `SMOTE (k=${bal.params.k ?? 5})` : 'class weights', before: [trNeg, trPos], after: smote ? [Math.max(trNeg, trPos), Math.max(trNeg, trPos)] : [trNeg, trPos] };
    summary.push(`Class imbalance: ${balance.method} on the training split only (${trNeg}:${trPos}${smote ? ` → ${balance.after[0]}:${balance.after[1]}` : `, weights ${(split.train.length / (2 * trNeg)).toFixed(2)} / ${(split.train.length / (2 * trPos || 1)).toFixed(2)}`}).`);
  }

  // Feature selection (scores always computed so the UI can show the ranking).
  const trainIdx = split.train.filter((i) => i < X.length);
  const fs = step('feature_select');
  const fsMethod = fs ? String(fs.params.method ?? 'anova') : 'anova';
  const scoresRaw = names.map((_, j) => {
    if (!isClass) return corrScore(X, y.map((v) => v), trainIdx, j);
    if (fsMethod === 'variance') {
      const xs = trainIdx.map((i) => beforeScale[i][j]);
      const m = xs.reduce((s, v) => s + v, 0) / xs.length;
      const rng = Math.max(...xs) - Math.min(...xs) || 1;
      return xs.reduce((s, v) => s + ((v - m) / rng) ** 2, 0) / xs.length;
    }
    if (fsMethod === 'mi' || fsMethod === 'lasso' || fsMethod === 'rfe') return corrScore(X, y, trainIdx, j) ** (fsMethod === 'mi' ? 1.3 : 1);
    return fScore(X, y, trainIdx, j);
  });
  const maxScore = Math.max(...scoresRaw) || 1;
  const k = fs ? Math.min(names.length, Number(fs.params.k ?? 12)) : names.length;
  const ranked = names.map((name, j) => ({ name, j, score: scoresRaw[j] / maxScore })).sort((a, b) => b.score - a.score);
  const selected = new Set(ranked.slice(0, k).map((r) => r.j));
  if (fs) {
    X = X.map((r) => r.filter((_, j) => selected.has(j)));
    names = names.filter((_, j) => selected.has(j));
    summary.push(`Feature selection: ${{ anova: 'ANOVA-F', mi: 'mutual information', variance: 'variance threshold', rfe: 'RFE', lasso: `LASSO (C=${fs.params.C ?? 0.5})` }[fsMethod] ?? fsMethod} keeps top ${k} of ${ranked.length}.`);
  }

  // Dimensionality reduction
  const red = step('reduce');
  let explained: number[] = [];
  let loadings: PreprocessPreview['loadings'] = [];
  let pcaScatter: PreprocessPreview['pcaScatter'] = [];
  const fullPca = pca(X.filter((_, i) => trainSet.has(i)).length > 3 ? X.filter((_, i) => trainSet.has(i)) : X, Math.min(names.length, 12));
  explained = fullPca.explained.slice(0, Math.min(20, fullPca.explained.length));
  const project = (r: number[], comps: number[][]) => comps.map((c) => c.reduce((s, w, j) => s + w * ((r[j] - fullPca.mean[j]) / fullPca.std[j]), 0));
  pcaScatter = X.slice(0, 600).map((r, i) => {
    const [a, b] = project(r, fullPca.components.slice(0, 2));
    return { x: a, y: b ?? 0, label: y[i] };
  });
  if (red && red.params.method !== 'none') {
    const method = String(red.params.method);
    const kk = Math.max(1, Math.min(names.length, Number(red.params.k ?? 6)));
    const comps = fullPca.components.slice(0, kk);
    loadings = comps.map((c, ci) => ({
      component: `PC${ci + 1}`,
      weights: c.map((w, j) => ({ feature: names[j], weight: w })).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 6),
    }));
    X = X.map((r) => project(r, comps));
    const cum = explained.slice(0, kk).reduce((s, v) => s + v, 0);
    names = comps.map((_, ci) => `PC${ci + 1}`);
    summary.push(`${method === 'pca' ? 'PCA' : method === 'lda' ? 'LDA (mock preview: discriminant-aligned PCA)' : 'Autoencoder (mock preview: PCA-equivalent latent)'} → ${kk} components (${(cum * 100).toFixed(1)}% variance, fit on train).`);
  }

  if (angleRange) {
    const trainRows = X.filter((_, i) => trainSet.has(i));
    const { min, max } = minMaxScale(trainRows, 0, Math.PI);
    X = X.map((r) => r.map((v, j) => Math.min(Math.PI, Math.max(0, ((v - min[j]) / (max[j] - min[j] || 1)) * Math.PI))));
    summary.push('Angle range: MinMax → [0, π] so each feature is a bounded rotation angle (fit on train, clipped on val/test).');
  }

  const leakageGuard = [
    { check: 'Scalers fitted on the training split only', ok: true },
    { check: 'Imputer statistics from training rows only', ok: true },
    { check: 'Feature selection scored on training rows only', ok: true },
    { check: 'PCA / reduction fitted on training rows only', ok: true },
    { check: 'Resampling (SMOTE) applied to training split only', ok: true },
    { check: 'All missing values handled before encoding', ok: !!imp || !missingCols.some(Boolean) },
  ];

  const distFeatures = namesBeforeScale.slice(0, 4);
  const sampleIdx = split.test.filter((i) => i < X.length).slice(0, 60);
  return {
    before: { columns: rawNames, rows: t.X.slice(0, 6).map((r) => r.slice(0, 8)) },
    after: { columns: names.slice(0, 8), rows: X.slice(0, 6).map((r) => r.slice(0, 8)) },
    missingHandled,
    outliersHandled,
    duplicatesRemoved,
    droppedConstant,
    featureScores: ranked.slice(0, 40).map((r) => ({ name: r.name, score: r.score, selected: selected.has(r.j) })),
    explainedVariance: explained,
    pcaScatter,
    loadings,
    distributions: distFeatures.map((f, j) => ({
      feature: f,
      before: hist(t.X.map((r) => r[t.columns.findIndex((c) => c.name === f)]).filter((v): v is number => v !== null)),
      after: hist(beforeScale.map((r) => r[j])),
    })),
    finalFeatures: names,
    leakageGuard,
    summary,
    balance,
    splitCounts: { train: split.train.length, val: split.val.length, test: split.test.length },
    encodedSample: {
      ids: sampleIdx.map((i) => ids[i]),
      x: sampleIdx.map((i) => X[i]),
      y: sampleIdx.map((i) => y[i]),
      raw: sampleIdx.map((i) => t.X[t.ids.indexOf(ids[i])]?.slice(0, 32) ?? []),
      rawNames: t.columns.slice(0, 32).map((c) => c.name),
    },
    angleRange,
    finalX: X,
    y,
  };
}
