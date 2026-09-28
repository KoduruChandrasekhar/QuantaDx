/** Types mirroring the FastAPI / Pydantic v2 backend contract (Section 5). */
import type { AnsatzKind, CircuitSpec, EncodingKind, Entanglement } from './quantum';
import type { RiskBands } from '@/lib/risk';

export type { RiskBands };
export type TaskType = 'classification' | 'regression';
export type ModelFamily = 'classical' | 'quantum' | 'hybrid';
export type ModelKind =
  | 'logreg' | 'svm_rbf' | 'random_forest' | 'xgboost' | 'mlp'
  | 'linreg' | 'svr_rbf' | 'rf_regressor'
  | 'qsvm' | 'vqc' | 'qnn' | 'hybrid_nn'
  | 'qsvr' | 'vqr';
export type Modality = 'tabular_ehr' | 'genomics' | 'imaging_features';
export type Disease = 'cancer' | 'cardiovascular' | 'neurological' | 'diabetes' | 'kidney';

export interface Health {
  status: 'ok' | 'degraded';
  mock: boolean;
  versions: Record<string, string>;
  backends: { simulators: number; hardware: number };
  runningJobs: number;
}

export interface ColumnSchema {
  name: string;
  type: 'numeric' | 'categorical' | 'binary' | 'id';
  unit?: string;
  group?: string;
  description?: string;
}

export interface Dataset {
  id: string;
  name: string;
  shortName: string;
  disease: Disease;
  modality: Modality;
  rows: number;
  features: number;
  taskType: TaskType;
  target: string;
  positiveClass?: string;
  classBalance?: { positive: number; negative: number; positiveLabel: string; negativeLabel: string };
  targetRange?: [number, number];
  source: string;
  benchmark: boolean;
  createdAt: string;
  columns: ColumnSchema[];
  hash: string;
}

export interface ColumnProfile {
  name: string;
  type: ColumnSchema['type'];
  missingPct: number;
  unique: number;
  min: number;
  max: number;
  mean: number;
  std: number;
  q1: number;
  median: number;
  q3: number;
  outliersIqr: number;
  outliersZ: number;
  histogram: number[];
  histByClass?: { neg: number[]; pos: number[] };
  unit?: string;
}

export interface DatasetProfile {
  datasetId: string;
  rows: number;
  columns: ColumnProfile[];
  missingMatrix: number[][]; // sampled rows × columns, 1 = missing
  missingPattern: 'none' | 'MCAR-like' | 'MAR-like';
  duplicates: number;
  noiseEstimate: number; // 0–1
  suspiciousRows: { row: number; reason: string }[];
  correlation: { names: string[]; matrix: number[][] };
  classBalance?: { positive: number; negative: number; ratio: number };
  featureSampleRatio: number;
  qualityScore: number;
  qualityBreakdown: { label: string; score: number; max: number }[];
  phiColumns: string[];
  previewRows: (number | string | null)[][];
  previewColumns: string[];
}

export type PreprocessStepKind =
  | 'dedupe' | 'type_fix' | 'impute' | 'outliers' | 'denoise' | 'encode_categorical'
  | 'scale' | 'balance' | 'feature_select' | 'reduce';

export interface PreprocessStep {
  id: string;
  kind: PreprocessStepKind;
  enabled: boolean;
  params: Record<string, string | number | boolean>;
}

export interface PreprocessConfig {
  steps: PreprocessStep[];
  split: { train: number; val: number; test: number; stratified: boolean; seed: number };
  targetQubits?: number;
  encoding: EncodingKind;
}

export interface PreprocessPreview {
  before: { columns: string[]; rows: (number | null)[][] };
  after: { columns: string[]; rows: number[][] };
  missingHandled: number;
  outliersHandled: number;
  duplicatesRemoved: number;
  droppedConstant: string[];
  featureScores: { name: string; score: number; selected: boolean }[];
  explainedVariance: number[];
  pcaScatter: { x: number; y: number; label: number }[];
  loadings: { component: string; weights: { feature: string; weight: number }[] }[];
  distributions: { feature: string; before: number[]; after: number[] }[];
  finalFeatures: string[];
  leakageGuard: { check: string; ok: boolean }[];
  summary: string[];
  balance?: { method: string; before: [number, number]; after: [number, number] };
  splitCounts: { train: number; val: number; test: number };
  encodedSample: { ids: string[]; x: number[][]; y: number[]; raw: (number | null)[][]; rawNames: string[] };
  angleRange: boolean;
}

export interface PreprocessResult extends PreprocessPreview {
  processedDatasetId: string;
  nFeatures: number;
  qubitsNeeded: number;
  split: { train: number; val: number; test: number };
}

export type ExecutionBackend = 'statevector' | 'shots' | 'noisy' | 'hardware';

export interface QuantumConfig {
  encoding: EncodingKind;
  encodingReps: number;
  kernelBandwidth?: number;
  bandwidthSearch?: number[];
  ansatz: AnsatzKind;
  layers: number;
  entanglement: Entanglement;
  optimizer: 'cobyla' | 'spsa' | 'adam' | 'lbfgsb';
  maxIter: number;
  learningRate?: number;
  gradient: 'parameter_shift' | 'adjoint' | 'finite_diff';
  readout: 'expval_z0' | 'parity' | 'multi_expval';
  execution: {
    backend: ExecutionBackend;
    shots?: number;
    noise?: { depolarizing: number; readout: number; t1Us?: number; t2Us?: number; deviceModel?: string };
    deviceName?: string;
    mitigation?: { readout: boolean; zne: boolean };
  };
  seed: number;
}

export interface ModelSpec {
  modelId: string;
  kind: ModelKind;
  label: string;
  family: ModelFamily;
  hyper: Record<string, string | number | boolean>;
}

export interface ExperimentConfig {
  name: string;
  datasetId: string;
  taskType: TaskType;
  models: ModelSpec[];
  quantum: QuantumConfig;
  protocol: { folds: number; repeats: number; holdout: number; primaryMetric: string; externalDatasetId?: string; noiseSweep: boolean; qubitScaling: boolean };
  nQubits: number;
  speed?: number;
}

export type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface TrainingEvent {
  experimentId: string;
  modelId: string;
  type: 'progress' | 'log' | 'status' | 'done' | 'error';
  iteration?: number;
  maxIter?: number;
  loss?: number;
  trainMetric?: number;
  valMetric?: number;
  gradNorm?: number;
  params?: number[];
  circuitExecutions?: number;
  shotsUsed?: number;
  elapsedSec?: number;
  etaSec?: number;
  iterTimeMs?: number;
  message?: string;
  level?: 'info' | 'warn' | 'error';
  status?: JobStatus;
  queuePosition?: number;
}

export interface ModelRun {
  modelId: string;
  kind: ModelKind;
  label: string;
  family: ModelFamily;
  status: JobStatus;
  progress: number;
  etaSec?: number;
}

export interface Experiment {
  id: string;
  name: string;
  datasetId: string;
  datasetName: string;
  taskType: TaskType;
  status: JobStatus;
  createdAt: string;
  durationSec: number;
  backend: string;
  tags: string[];
  models: ModelRun[];
  config: ExperimentConfig;
  bestByFamily: Partial<Record<ModelFamily, { label: string; metric: string; value: number }>>;
  mlflowRunId: string;
  seeds: number[];
  libraryVersions: Record<string, string>;
}

export interface MeanStd {
  mean: number;
  std: number;
  folds: number[];
}

export interface ClassificationMetrics {
  accuracy: MeanStd;
  balancedAccuracy: MeanStd;
  sensitivity: MeanStd;
  specificity: MeanStd;
  precision: MeanStd;
  npv: MeanStd;
  f1: MeanStd;
  rocAuc: MeanStd;
  prAuc: MeanStd;
  mcc: MeanStd;
  brier: MeanStd;
}

export interface RegressionMetrics {
  rmse: MeanStd;
  mae: MeanStd;
  r2: MeanStd;
}

export interface EfficiencyMetrics {
  trainTimeSec: number;
  inferenceMsPerSample: number;
  params: number;
  qubits?: number;
  circuitDepth?: number;
  circuitExecutions?: number;
  shots?: number;
  memoryMb: number;
}

export interface ModelResult {
  modelId: string;
  kind: ModelKind;
  label: string;
  family: ModelFamily;
  note?: string;
  metrics?: ClassificationMetrics;
  regression?: RegressionMetrics;
  confusion?: { tp: number; fp: number; tn: number; fn: number };
  scores?: number[]; // out-of-fold probabilities, aligned with ExperimentResults.labels
  roc?: { fpr: number; tpr: number }[];
  pr?: { recall: number; precision: number }[];
  calibration?: { predicted: number; observed: number; count: number }[];
  predictions?: { actual: number; predicted: number }[];
  efficiency: EfficiencyMetrics;
  trainTestGap: { train: number; test: number };
  learningCurve: { n: number; train: number; val: number }[];
}

export interface SignificanceTest {
  modelA: string;
  modelB: string;
  mcnemar?: { statistic: number; pValue: number; b: number; c: number };
  pairedT: { statistic: number; pValue: number };
  wilcoxon: { statistic: number; pValue: number };
  metric: string;
  verdict: string;
  significant: boolean;
}

export interface ExperimentResults {
  experimentId: string;
  taskType: TaskType;
  datasetId: string;
  nSamples: number;
  folds: number;
  labels?: number[];
  models: ModelResult[];
  significance: SignificanceTest[];
  bandwidthSweep?: { bandwidth: number; accuracy: number; selected: boolean }[];
  noiseRobustness: { level: string; x: number; series: Record<string, number>; mitigated: Record<string, number> }[];
  qubitScaling: { qubits: number; quantumAcc: number; classicalAcc: number; quantumRuntimeSec: number; classicalRuntimeSec: number; memoryMb: number }[];
  externalValidation: { modelId: string; site: string; internal: number; external: number; metric: string }[];
  inputNoise: { sigma: number; series: Record<string, number> }[];
  protocol: string;
  backend: string;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface GlobalExplanation {
  modelId: string;
  method: 'tree_shap' | 'kernel_shap' | 'permutation';
  backgroundSize?: number;
  components: FeatureImportance[]; // PC-level
  original: FeatureImportance[]; // mapped back to clinical features
  beeswarm: { feature: string; points: { shap: number; value: number }[] }[];
  qubitImportance: number[];
  note?: string;
}

export interface LocalExplanation {
  modelId: string;
  sampleIndex: number;
  probability: number;
  baseValue: number;
  label: number;
  contributions: { feature: string; value: number; contribution: number; text: string }[];
  summary: string;
  counterfactual?: { feature: string; from: number; to: number; unit?: string }[];
  encodedX: number[];
}

export interface KernelMatrix {
  modelId: string;
  bandwidth: number;
  labels: number[];
  matrix: number[][];
  alignment: number;
}

export interface LossLandscape {
  modelId: string;
  params: [string, string];
  grid: number[][];
  range: [number, number];
  path: { a: number; b: number; loss: number }[];
}

export interface Prediction {
  probability?: number;
  value?: number;
  riskBand?: 'low' | 'moderate' | 'high';
  threshold: number;
  decision?: 0 | 1;
  uncertainty?: { lower: number; upper: number; method: 'cv_ensemble' | 'shot_noise' | 'conformal' };
  topFactors: { feature: string; value: number; contribution: number; text: string }[];
  modelId: string;
  modelLabel: string;
  backend: string;
  timestamp: string;
  encodedX?: number[];
}

export interface PredictRequest {
  datasetId: string;
  modelId?: string;
  features: Record<string, number>;
  threshold: number;
  bands: RiskBands;
}

export interface BatchPrediction {
  rows: (Prediction & { patientId: string })[];
  schemaErrors: string[];
  summary: { low: number; moderate: number; high: number };
}

export interface QuantumBackend {
  id: string;
  name: string;
  provider: 'Qiskit Aer' | 'PennyLane' | 'IBM Quantum';
  kind: 'statevector' | 'shots' | 'noisy' | 'hardware';
  qubits: number;
  status: 'online' | 'maintenance' | 'offline';
  queue: number;
  basisGates: string[];
  maxDepth?: number;
  connectivity: 'all-to-all' | 'heavy-hex' | 'linear';
  readoutError?: number;
  cxError?: number;
  t1Us?: number;
  t2Us?: number;
  requiresToken: boolean;
}

export interface DeployedModel {
  modelId: string;
  experimentId: string;
  label: string;
  kind: ModelKind;
  family: ModelFamily;
  version: string;
  stage: 'staging' | 'production';
  datasetId: string;
  metrics: { sensitivity?: number; specificity?: number; rocAuc?: number; rmse?: number };
  threshold: number;
  backend: string;
  deployedAt: string;
}

export interface RegisteredModel extends DeployedModel {
  deployed: boolean;
}

export interface CircuitPreviewRequest {
  nQubits: number;
  quantum: QuantumConfig;
  withAnsatz: boolean;
  x?: number[];
  theta?: number[];
}

export type { CircuitSpec };
