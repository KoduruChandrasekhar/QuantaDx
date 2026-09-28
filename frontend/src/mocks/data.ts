/** In-memory "database" of tabular datasets for the mock backend. Seeded → identical on every run. */
import type { ColumnSchema, Dataset } from '@/types/api';
import { gaussian, hashSeed, mulberry32, shuffle } from '@/lib/prng';
import { SPECS, type DatasetSpec, type FeatureSpec } from './datasetSpecs';

export interface TableData {
  columns: ColumnSchema[];
  X: (number | null)[][];
  y: number[];
  ids: string[];
}

const tables = new Map<string, TableData>();
const datasets = new Map<string, Dataset>();

function sampleFeature(f: FeatureSpec, cls: number, latent: Record<string, number>, rand: () => number): number {
  const [m, s] = cls === 1 && f.pos ? f.pos : f.neg;
  if (f.kind === 'bin') return rand() < m ? 1 : 0;
  const e = gaussian(rand);
  const z = f.latent ? 0.85 * latent[f.latent] + 0.53 * e : e;
  let v: number;
  const cv = m > 0 ? s / m : 0;
  if ((f.min ?? -Infinity) >= 0 && cv > 0.35) {
    const sig = Math.sqrt(Math.log(1 + cv * cv));
    v = m * Math.exp(sig * z - (sig * sig) / 2);
  } else v = m + s * z;
  if (f.min !== undefined && v < f.min) v = f.min + Math.abs(gaussian(rand)) * s * 0.05;
  if (f.max !== undefined && v > f.max) v = f.max;
  if (f.kind === 'int') v = Math.round(v);
  const mag = Math.abs(m);
  const digits = mag === 0 ? 3 : mag < 0.001 ? 7 : mag < 0.1 ? 5 : mag < 10 ? 3 : mag < 1000 ? 2 : 0;
  return Number(v.toFixed(digits));
}

function generate(spec: DatasetSpec): TableData {
  const rand = mulberry32(hashSeed(spec.meta.id));
  const n = spec.meta.rows;
  const prefix = spec.idColumn ?? 'id';
  const ids = Array.from({ length: n }, (_, i) => `${prefix.split('_')[0].toUpperCase().slice(0, 3)}-${(842000 + i * 17).toString()}`);

  if (spec.generatedGenes) {
    const labels = shuffle([...new Array<number>(spec.nPos).fill(1), ...new Array<number>(n - spec.nPos).fill(0)], rand);
    const G = spec.generatedGenes.total;
    const named = ['AFFX-BioB-5_at', 'AFFX-BioB-M_at', 'AFFX-BioC-5_at', 'CD33_at', 'MPO_at', 'CST3_at', 'Zyxin_at', 'LYN_at', 'MB-1_at', 'CD19_at'];
    const columns: ColumnSchema[] = Array.from({ length: G }, (_, g) => ({ name: named[g] ?? `G${String(g).padStart(4, '0')}_at`, type: 'numeric', unit: 'log₂ expr', group: 'Gene expression' }));
    const base = Array.from({ length: G }, () => 6 + rand() * 4);
    const informative = new Set(Array.from({ length: spec.generatedGenes.informative }, (_, k) => (k < 7 ? k + 3 : Math.floor(rand() * G))));
    const shift = Array.from({ length: G }, (_, g) => (informative.has(g) ? (rand() < 0.5 ? -1 : 1) * (1 + rand() * 1.2) : 0));
    const X = labels.map((l) => base.map((b, g) => Number((b + shift[g] * l + gaussian(rand) * 0.9).toFixed(3))));
    return { columns, X, y: labels, ids };
  }

  const columns: ColumnSchema[] = spec.features.map((f) => ({
    name: f.name,
    type: f.kind === 'bin' ? 'binary' : 'numeric',
    unit: f.unit || undefined,
    group: f.group,
    description: f.description,
  }));

  let y: number[];
  const X: (number | null)[][] = [];
  if (spec.regression) {
    const r = spec.regression;
    y = Array.from({ length: n }, () => Number(Math.min(r.max, Math.max(r.min, r.mean + r.sd * gaussian(rand))).toFixed(2)));
    for (let i = 0; i < n; i++) {
      const t = (y[i] - r.mean) / r.sd;
      const latent = { voice: gaussian(rand), size: 0, shape: 0 };
      X.push(
        spec.features.map((f) => {
          const k = f.slope ?? 0;
          const shifted: FeatureSpec = { ...f, neg: [f.neg[0] * (1 + 1.6 * k * t), f.neg[1]] };
          return rand() < (f.missing ?? 0) ? null : sampleFeature(shifted, 0, latent, rand);
        }),
      );
    }
  } else {
    y = shuffle([...new Array<number>(spec.nPos).fill(1), ...new Array<number>(n - spec.nPos).fill(0)], rand);
    for (let i = 0; i < n; i++) {
      const latent = { size: gaussian(rand), shape: gaussian(rand), voice: gaussian(rand) };
      X.push(spec.features.map((f) => (rand() < (f.missing ?? 0) ? null : sampleFeature(f, y[i], latent, rand))));
    }
  }
  for (let d = 0; d < (spec.duplicates ?? 0); d++) {
    const src = Math.floor(rand() * n);
    let dst = Math.floor(rand() * n);
    if (spec.regression) {
      if (dst === src) dst = (dst + 1) % n;
      y[dst] = y[src];
    } else while (y[dst] !== y[src] || dst === src) dst = (dst + 1) % n; // same class → balance unchanged
    X[dst] = X[src].slice();
  }
  return { columns, X, y, ids };
}

function hashTable(t: TableData): string {
  let h = 0x811c9dc5;
  const rows = Math.min(t.X.length, 400);
  for (let i = 0; i < rows; i++) for (const v of t.X[i].slice(0, 40)) h = Math.imul(h ^ Math.round((v ?? -1) * 1000), 16777619);
  return `sha256:${(h >>> 0).toString(16).padStart(8, '0')}${hashSeed(t.columns.map((c) => c.name).join()).toString(16)}`;
}

function ensure(id: string): void {
  if (tables.has(id)) return;
  const spec = SPECS.find((s) => s.meta.id === id);
  if (!spec) throw new Error(`Unknown dataset ${id}`);
  const t = generate(spec);
  tables.set(id, t);
}

export function getTable(id: string): TableData {
  ensure(id);
  return tables.get(id)!;
}

export function getDataset(id: string): Dataset {
  const existing = datasets.get(id);
  if (existing) return existing;
  const spec = SPECS.find((s) => s.meta.id === id);
  if (!spec) throw new Error(`Dataset ${id} not found`);
  // Genomics tables are generated lazily; keep the listing cheap.
  const columns: ColumnSchema[] = spec.generatedGenes
    ? [{ name: `${spec.generatedGenes.total} gene-expression columns`, type: 'numeric', group: 'Gene expression' }]
    : spec.features.map((f) => ({ name: f.name, type: f.kind === 'bin' ? 'binary' : 'numeric', unit: f.unit || undefined, group: f.group, description: f.description }));
  const ds: Dataset = {
    ...spec.meta,
    columns,
    createdAt: '2026-09-01T09:00:00.000Z',
    hash: `sha256:${hashSeed(spec.meta.id + 'v1').toString(16)}c0ffee`,
  };
  datasets.set(id, ds);
  return ds;
}

export function listBenchmarks(): Dataset[] {
  return SPECS.map((s) => getDataset(s.meta.id));
}

export function listAll(): Dataset[] {
  const uploaded = [...datasets.values()].filter((d) => !d.benchmark);
  return [...listBenchmarks(), ...uploaded];
}

export function registerUploaded(ds: Omit<Dataset, 'hash'>, table: TableData): Dataset {
  const full: Dataset = { ...ds, hash: hashTable(table) };
  datasets.set(ds.id, full);
  tables.set(ds.id, table);
  return full;
}

export function getSpec(id: string): DatasetSpec | undefined {
  return SPECS.find((s) => s.meta.id === id);
}

export function idColumnOf(id: string): string {
  return getSpec(id)?.idColumn ?? 'row_id';
}
