/** Small dense linear algebra: standardisation, covariance, Jacobi eigen-decomposition, PCA. */

export type Matrix = number[][];

export function columnStats(X: Matrix): { mean: number[]; std: number[] } {
  const n = X.length;
  const d = X[0]?.length ?? 0;
  const mean = new Array<number>(d).fill(0);
  const sd = new Array<number>(d).fill(0);
  for (const row of X) for (let j = 0; j < d; j++) mean[j] += row[j] / n;
  for (const row of X) for (let j = 0; j < d; j++) sd[j] += (row[j] - mean[j]) ** 2 / Math.max(1, n - 1);
  return { mean, std: sd.map((v) => Math.sqrt(v) || 1) };
}

export function standardize(X: Matrix, stats = columnStats(X)): Matrix {
  return X.map((row) => row.map((v, j) => (v - stats.mean[j]) / stats.std[j]));
}

export function covariance(Z: Matrix): Matrix {
  const n = Z.length;
  const d = Z[0]?.length ?? 0;
  const C: Matrix = Array.from({ length: d }, () => new Array<number>(d).fill(0));
  for (const row of Z)
    for (let i = 0; i < d; i++) {
      const ri = row[i];
      for (let j = i; j < d; j++) C[i][j] += (ri * row[j]) / Math.max(1, n - 1);
    }
  for (let i = 0; i < d; i++) for (let j = 0; j < i; j++) C[i][j] = C[j][i];
  return C;
}

export function correlation(X: Matrix): Matrix {
  return covariance(standardize(X));
}

/** Cyclic Jacobi eigenvalue algorithm for symmetric matrices. Returns eigenpairs sorted descending. */
export function jacobiEigen(Ain: Matrix, maxSweeps = 60): { values: number[]; vectors: Matrix } {
  const n = Ain.length;
  const A = Ain.map((r) => r.slice());
  const V: Matrix = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
    if (off < 1e-18) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-15) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
  }
  const pairs = A.map((row, i) => ({ value: row[i], vec: V.map((r) => r[i]) })).sort((a, b) => b.value - a.value);
  return { values: pairs.map((p) => p.value), vectors: pairs.map((p) => p.vec) };
}

export interface PcaResult {
  components: Matrix; // k × d loadings (unit vectors)
  explained: number[]; // explained-variance ratio for every component
  scores: Matrix; // n × k projections
  mean: number[];
  std: number[];
}

export function pca(X: Matrix, k: number): PcaResult {
  const stats = columnStats(X);
  const Z = standardize(X, stats);
  const { values, vectors } = jacobiEigen(covariance(Z));
  const total = values.reduce((s, v) => s + Math.max(0, v), 0) || 1;
  const comps = vectors.slice(0, k).map((v) => {
    // deterministic sign: largest-magnitude loading positive
    let mi = 0;
    for (let i = 1; i < v.length; i++) if (Math.abs(v[i]) > Math.abs(v[mi])) mi = i;
    return v[mi] < 0 ? v.map((x) => -x) : v;
  });
  const scores = Z.map((row) => comps.map((c) => c.reduce((s, w, j) => s + w * row[j], 0)));
  return { components: comps, explained: values.map((v) => Math.max(0, v) / total), scores, mean: stats.mean, std: stats.std };
}

export function minMaxScale(X: Matrix, lo: number, hi: number): { scaled: Matrix; min: number[]; max: number[] } {
  const d = X[0]?.length ?? 0;
  const min = new Array<number>(d).fill(Infinity);
  const max = new Array<number>(d).fill(-Infinity);
  for (const r of X)
    for (let j = 0; j < d; j++) {
      if (r[j] < min[j]) min[j] = r[j];
      if (r[j] > max[j]) max[j] = r[j];
    }
  const scaled = X.map((r) => r.map((v, j) => lo + ((v - min[j]) / (max[j] - min[j] || 1)) * (hi - lo)));
  return { scaled, min, max };
}
