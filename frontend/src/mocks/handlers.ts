/**
 * In-process mock backend (replaces MSW — see DECISIONS.md). Every endpoint from Section 5.2 is served here with
 * 200–800 ms simulated latency. Switching VITE_USE_MOCK=false sends the same requests to FastAPI instead.
 */
import type { CircuitPreviewRequest, Dataset, ExperimentConfig, PredictRequest, PreprocessConfig, TrainingEvent } from '@/types/api';
import { buildCircuit, encodingQubits } from '@/lib/quantum/circuits';
import { mulberry32 } from '@/lib/prng';
import { listBackends } from './backends';
import { getDataset, getTable, listAll, listBenchmarks, registerUploaded, type TableData } from './data';
import * as X from './experiments';
import { globalExplanation, kernelMatrix, localExplanation, lossLandscape } from './explain';
import { openApiSpec } from './openapi';
import { cohortRows, exampleProfiles, predictBatch, predictOne } from './predict';
import { runPipeline } from './preprocess';
import { profileDataset } from './profile';

export class MockHttpError extends Error {
  constructor(public status: number, message: string, public code = 'error') {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = <T,>(v: T): T => (v === undefined ? v : structuredClone(v));

type Body = Record<string, unknown>;
type Route = [string, RegExp, (m: RegExpMatchArray, q: URLSearchParams, body: Body) => unknown];

function deployedFor(datasetId: string) {
  const d = X.getDeployed(datasetId)[0];
  if (!d) throw new MockHttpError(404, `No model deployed for dataset ${datasetId}. Deploy one from the Experiment Registry.`, 'no_deployed_model');
  return d;
}

const routes: Route[] = [
  ['GET', /^\/health$/, () => ({
    status: 'ok', mock: true, runningJobs: X.runningCount(),
    versions: { api: '1.0.0', pennylane: '0.38.0', qiskit: '1.2.4', 'scikit-learn': '1.5.2', shap: '0.46.0' },
    backends: { simulators: 5, hardware: 2 },
  })],
  ['GET', /^\/datasets$/, () => listAll()],
  ['GET', /^\/datasets\/benchmarks$/, () => listBenchmarks()],
  ['GET', /^\/datasets\/([\w-]+)$/, (m) => getDataset(m[1])],
  ['GET', /^\/datasets\/([\w-]+)\/profile$/, (m) => profileDataset(m[1])],
  ['GET', /^\/datasets\/([\w-]+)\/examples$/, (m) => exampleProfiles(m[1])],
  ['GET', /^\/datasets\/([\w-]+)\/cohort$/, (m, q) => cohortRows(m[1], Number(q.get('n') ?? 120))],
  ['POST', /^\/datasets\/([\w-]+)\/extract-features$/, (m) => extractFeatures(m[1])],
  ['POST', /^\/preprocess\/preview$/, (_m, _q, b) => {
    const { finalX: _fx, y: _y, ...rest } = runPipeline(String(b.datasetId), b.config as PreprocessConfig);
    return rest;
  }],
  ['POST', /^\/preprocess$/, (_m, _q, b) => {
    const cfg = b.config as PreprocessConfig;
    const { finalX, y: _y, ...rest } = runPipeline(String(b.datasetId), cfg);
    const nF = finalX[0]?.length ?? 0;
    return { ...rest, processedDatasetId: `${b.datasetId}-pp-${nF}f`, nFeatures: nF, qubitsNeeded: encodingQubits(cfg.encoding, nF), split: rest.splitCounts };
  }],
  ['POST', /^\/circuit\/preview$/, (_m, _q, b) => {
    const r = b as unknown as CircuitPreviewRequest;
    return buildCircuit({ nQubits: r.nQubits, encoding: r.quantum.encoding, encodingReps: r.quantum.encodingReps, bandwidth: r.quantum.kernelBandwidth ?? 1, entanglement: r.quantum.entanglement, ansatz: r.withAnsatz ? r.quantum.ansatz : null, layers: r.quantum.layers, x: r.x, theta: r.theta, seed: r.quantum.seed });
  }],
  ['POST', /^\/kernel\/preview$/, (_m, _q, b) => kernelMatrix(X.getResults('exp-poc-001'), 'qsvm_bw', Number(b.bandwidth ?? 0.2))],
  ['GET', /^\/backends$/, () => listBackends()],
  ['GET', /^\/experiments$/, () => X.listExperiments()],
  ['POST', /^\/experiments$/, (_m, _q, b) => X.startExperiment(b as unknown as ExperimentConfig)],
  ['GET', /^\/experiments\/([\w-]+)$/, (m) => X.getExperiment(m[1])],
  ['DELETE', /^\/experiments\/([\w-]+)$/, (m) => X.deleteExperiment(m[1])],
  ['POST', /^\/experiments\/([\w-]+)\/cancel$/, (m) => X.cancelExperiment(m[1])],
  ['POST', /^\/experiments\/([\w-]+)\/replay$/, (m, q) => (X.replayExperiment(m[1], Number(q.get('speed') ?? 3)), { replaying: true })],
  ['GET', /^\/experiments\/([\w-]+)\/history$/, (m) => X.getHistory(m[1])],
  ['GET', /^\/experiments\/([\w-]+)\/results$/, (m) => X.getResults(m[1])],
  ['GET', /^\/experiments\/([\w-]+)\/circuit$/, (m, q) => {
    const exp = X.getExperiment(m[1]);
    const c = exp.config;
    const model = c.models.find((mm) => mm.modelId === q.get('model_id')) ?? c.models.find((mm) => mm.family !== 'classical');
    return buildCircuit({ nQubits: c.nQubits, encoding: c.quantum.encoding, encodingReps: c.quantum.encodingReps, bandwidth: c.quantum.kernelBandwidth ?? 1, entanglement: c.quantum.entanglement, ansatz: model?.kind === 'qsvm' ? null : c.quantum.ansatz, layers: c.quantum.layers, seed: 99 });
  }],
  ['GET', /^\/experiments\/([\w-]+)\/explain$/, (m, q) => globalExplanation(X.getResults(m[1]), q.get('model_id') ?? '')],
  ['POST', /^\/explain\/local$/, (_m, _q, b) => localExplanation(X.getResults(String(b.experimentId)), String(b.modelId), Number(b.sampleIndex), Number(b.threshold ?? 0.5))],
  ['GET', /^\/experiments\/([\w-]+)\/kernel$/, (m, q) => kernelMatrix(X.getResults(m[1]), q.get('model_id') ?? 'qsvm_bw', Number(q.get('bandwidth') ?? 0.2))],
  ['GET', /^\/experiments\/([\w-]+)\/landscape$/, (m, q) => lossLandscape(q.get('model_id') ?? 'vqc', X.getExperiment(m[1]).config.quantum.execution.backend !== 'statevector')],
  ['POST', /^\/experiments\/([\w-]+)\/external-validation$/, (m) => X.getResults(m[1]).externalValidation],
  ['GET', /^\/models$/, () => X.listRegistered()],
  ['GET', /^\/models\/deployed$/, (_m, q) => X.getDeployed(q.get('dataset') ?? undefined)],
  ['POST', /^\/models\/([^/]+)\/deploy$/, (m) => X.deployModel(decodeURIComponent(m[1]))],
  ['POST', /^\/predict$/, (_m, _q, b) => {
    const r = b as unknown as PredictRequest;
    const model = r.modelId ? X.listRegistered().find((x) => x.modelId === r.modelId) ?? deployedFor(r.datasetId) : deployedFor(r.datasetId);
    return predictOne(r, model);
  }],
  ['POST', /^\/predict\/batch$/, (_m, _q, b) => {
    const r = b as unknown as PredictRequest & { rows: { patientId: string; features: Record<string, number> }[] };
    const model = r.modelId ? X.listRegistered().find((x) => x.modelId === r.modelId) ?? deployedFor(r.datasetId) : deployedFor(r.datasetId);
    return predictBatch(r.datasetId, r.rows, model, r.threshold, r.bands);
  }],
  ['GET', /^\/openapi\.json$/, () => openApiSpec()],
];

export async function mockRequest(method: string, fullPath: string, body?: unknown): Promise<unknown> {
  const [path, qs] = fullPath.split('?');
  const q = new URLSearchParams(qs ?? '');
  await sleep(200 + Math.random() * 600);
  for (const [m, re, fn] of routes) {
    if (m !== method) continue;
    const match = path.match(re);
    if (!match) continue;
    try {
      return clone(fn(match, q, (body ?? {}) as Body));
    } catch (e) {
      if (e instanceof MockHttpError) throw e;
      const status = (e as { status?: number }).status ?? 500;
      throw new MockHttpError(status, (e as Error).message);
    }
  }
  throw new MockHttpError(404, `No route for ${method} ${path}`, 'not_found');
}

export function mockSubscribe(experimentId: string, fn: (e: TrainingEvent) => void): () => void {
  X.init();
  return X.subscribe(experimentId, fn);
}

/* ───────── Uploads (parsed in the browser, never sent anywhere in mock mode) ───────── */
const TARGET_HINTS = /^(target|label|class|diagnosis|outcome|status|y|disease|num|total_updrs)$/i;

export async function mockUpload(file: File, mode: 'tabular' | 'genomics' | 'imaging', onProgress: (p: number) => void): Promise<Dataset> {
  for (let p = 0; p <= 100; p += 8 + Math.random() * 10) {
    onProgress(Math.min(99, p));
    await sleep(60 + Math.random() * 80);
  }
  if (/\.xlsx?$/i.test(file.name)) throw new MockHttpError(415, 'XLSX files are parsed server-side. In offline mock mode, export the sheet as CSV.', 'unsupported_offline');
  if (mode === 'imaging' || /\.zip$/i.test(file.name)) {
    onProgress(100);
    return registerImaging(file.name);
  }
  const text = await file.text();
  if (!text.trim()) throw new MockHttpError(422, 'The file is empty.', 'empty_file');
  const Papa = (await import('papaparse')).default;
  const parsed = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true });
  const cols = parsed.meta.fields ?? [];
  const rows = parsed.data;
  if (!rows.length || cols.length < 2) throw new MockHttpError(422, 'Could not find a header row and at least two columns.', 'bad_csv');
  const isNum = (c: string) => rows.slice(0, 200).every((r) => r[c] === '' || r[c] === undefined || !Number.isNaN(Number(r[c])));
  const numeric = cols.filter(isNum);
  const target = cols.find((c) => TARGET_HINTS.test(c)) ?? cols[cols.length - 1];
  const featureCols = numeric.filter((c) => c !== target && !/(^id$|_id$|^patient|^record)/i.test(c));
  if (!featureCols.length) throw new MockHttpError(422, 'No numeric feature columns were found.', 'no_numeric');
  const targetVals = rows.map((r) => r[target]);
  const uniq = [...new Set(targetVals)];
  const regression = uniq.length > 10 && targetVals.every((v) => !Number.isNaN(Number(v)));
  if (!regression && uniq.length < 2) throw new MockHttpError(422, `Target column "${target}" has a single class — cannot train a classifier.`, 'single_class');
  const pos = regression ? '' : (uniq.find((u) => /^(1|m|yes|true|pos|positive|ckd|aml|disease)$/i.test(u)) ?? uniq[1]);
  const seen = new Set<string>();
  let dup = 0;
  for (const r of rows) {
    const k = featureCols.map((c) => r[c]).join('|');
    if (seen.has(k)) dup++;
    else seen.add(k);
  }
  const table: TableData = {
    columns: featureCols.map((c) => ({ name: c, type: 'numeric' })),
    X: rows.map((r) => featureCols.map((c) => (r[c] === '' || r[c] === undefined ? null : Number(r[c])))),
    y: rows.map((r) => (regression ? Number(r[target]) : r[target] === pos ? 1 : 0)),
    ids: rows.map((_, i) => `UP-${1000 + i}`),
  };
  const nPos = table.y.filter((v) => v === 1).length;
  const id = `up-${file.name.replace(/\W+/g, '-').toLowerCase().slice(0, 24)}-${rows.length}`;
  const ds = registerUploaded(
    {
      id, name: file.name, shortName: file.name.replace(/\.\w+$/, ''), disease: 'cancer', modality: mode === 'genomics' ? 'genomics' : 'tabular_ehr',
      rows: rows.length, features: featureCols.length, taskType: regression ? 'regression' : 'classification', target, positiveClass: regression ? undefined : pos,
      classBalance: regression ? undefined : { positive: nPos, negative: rows.length - nPos, positiveLabel: pos, negativeLabel: 'other' },
      targetRange: regression ? [Math.min(...table.y), Math.max(...table.y)] : undefined,
      source: `Uploaded · ${(file.size / 1024).toFixed(1)} KB${dup / rows.length > 0.3 ? ' · ⚠ >30% duplicate rows' : ''}`, benchmark: false, createdAt: new Date().toISOString(),
      columns: [...cols.filter((c) => !featureCols.includes(c) && c !== target).map((c) => ({ name: c, type: 'id' as const })), ...table.columns],
    },
    table,
  );
  onProgress(100);
  return ds;
}

function registerImaging(name: string): Dataset {
  const rand = mulberry32(31);
  const n = 240;
  const y = Array.from({ length: n }, (_, i) => (i % 3 === 0 ? 1 : 0));
  const table: TableData = { columns: [], X: y.map(() => []), y, ids: y.map((_, i) => `IMG-${String(i).padStart(4, '0')}.png`) };
  void rand;
  return registerUploaded(
    {
      id: `img-${name.replace(/\W+/g, '-').toLowerCase().slice(0, 20)}`, name, shortName: name.replace(/\.\w+$/, ''), disease: 'cancer', modality: 'imaging_features',
      rows: n, features: 0, taskType: 'classification', target: 'label', positiveClass: 'malignant',
      classBalance: { positive: 80, negative: 160, positiveLabel: 'malignant', negativeLabel: 'benign' }, source: 'Uploaded image archive · 240 images + labels.csv', benchmark: false,
      createdAt: new Date().toISOString(), columns: [],
    },
    table,
  );
}

function extractFeatures(id: string): { datasetId: string; features: number; method: string } {
  const t = getTable(id);
  const ds = getDataset(id);
  const rand = mulberry32(77);
  const d = 64;
  t.columns = Array.from({ length: d }, (_, j) => ({ name: j < 16 ? `radiomics_${['glcm_contrast', 'glcm_energy', 'shape_sphericity', 'firstorder_entropy', 'glrlm_rlnu', 'shape_elongation', 'firstorder_kurtosis', 'glszm_zone', 'ngtdm_busyness', 'shape_flatness', 'firstorder_skew', 'glcm_idm', 'gldm_dependence', 'shape_area', 'firstorder_mean', 'glcm_corr'][j]}` : `cnn_emb_${String(j - 16).padStart(2, '0')}`, type: 'numeric' as const }));
  const shift = t.columns.map(() => (rand() - 0.5) * 1.6);
  t.X = t.y.map((l) => t.columns.map((_, j) => Number((shift[j] * l + (rand() + rand() + rand() - 1.5) * 1.2).toFixed(4))));
  ds.features = d;
  ds.columns = t.columns;
  return { datasetId: id, features: d, method: 'ResNet-18 embeddings (48-d) + PyRadiomics (16)' };
}
