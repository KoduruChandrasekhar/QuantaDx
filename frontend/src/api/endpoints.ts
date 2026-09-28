/** One typed function per endpoint (Section 5.2). */
import type {
  BatchPrediction, CircuitPreviewRequest, CircuitSpec, Dataset, DatasetProfile, DeployedModel, Experiment, ExperimentConfig, ExperimentResults,
  GlobalExplanation, Health, KernelMatrix, LocalExplanation, LossLandscape, Prediction, PredictRequest, PreprocessConfig, PreprocessPreview,
  PreprocessResult, QuantumBackend, RegisteredModel, TrainingEvent,
} from '@/types/api';
import { request, upload } from './client';

const enc = encodeURIComponent;

export const api = {
  health: () => request<Health>('GET', '/health'),
  datasets: () => request<Dataset[]>('GET', '/datasets'),
  benchmarks: () => request<Dataset[]>('GET', '/datasets/benchmarks'),
  dataset: (id: string) => request<Dataset>('GET', `/datasets/${enc(id)}`),
  profile: (id: string) => request<DatasetProfile>('GET', `/datasets/${enc(id)}/profile`),
  examples: (id: string) => request<{ healthy: Record<string, number>; atRisk: Record<string, number> }>('GET', `/datasets/${enc(id)}/examples`),
  cohort: (id: string, n = 120) => request<{ patientId: string; features: Record<string, number> }[]>('GET', `/datasets/${enc(id)}/cohort?n=${n}`),
  upload: (file: File, mode: 'tabular' | 'genomics' | 'imaging', onProgress: (p: number) => void) => upload<Dataset>('/datasets/upload', file, { mode }, onProgress),
  extractFeatures: (id: string) => request<{ datasetId: string; features: number; method: string }>('POST', `/datasets/${enc(id)}/extract-features`),
  preprocessPreview: (datasetId: string, config: PreprocessConfig) => request<PreprocessPreview>('POST', '/preprocess/preview', { datasetId, config }),
  preprocess: (datasetId: string, config: PreprocessConfig) => request<PreprocessResult>('POST', '/preprocess', { datasetId, config }),
  circuitPreview: (req: CircuitPreviewRequest) => request<CircuitSpec>('POST', '/circuit/preview', req),
  kernelPreview: (datasetId: string, bandwidth: number) => request<KernelMatrix>('POST', '/kernel/preview', { datasetId, bandwidth }),
  backends: () => request<QuantumBackend[]>('GET', '/backends'),
  experiments: () => request<Experiment[]>('GET', '/experiments'),
  experiment: (id: string) => request<Experiment>('GET', `/experiments/${enc(id)}`),
  startExperiment: (cfg: ExperimentConfig) => request<{ experiment_id: string }>('POST', '/experiments', cfg),
  cancelExperiment: (id: string) => request<Experiment>('POST', `/experiments/${enc(id)}/cancel`),
  deleteExperiment: (id: string) => request<{ deleted: boolean }>('DELETE', `/experiments/${enc(id)}`),
  replay: (id: string, speed = 3) => request<{ replaying: boolean }>('POST', `/experiments/${enc(id)}/replay?speed=${speed}`),
  history: (id: string) => request<TrainingEvent[]>('GET', `/experiments/${enc(id)}/history`),
  results: (id: string) => request<ExperimentResults>('GET', `/experiments/${enc(id)}/results`),
  trainedCircuit: (id: string, modelId: string) => request<CircuitSpec>('GET', `/experiments/${enc(id)}/circuit?model_id=${enc(modelId)}`),
  explain: (id: string, modelId: string) => request<GlobalExplanation>('GET', `/experiments/${enc(id)}/explain?model_id=${enc(modelId)}`),
  explainLocal: (experimentId: string, modelId: string, sampleIndex: number, threshold: number) =>
    request<LocalExplanation>('POST', '/explain/local', { experimentId, modelId, sampleIndex, threshold }),
  kernel: (id: string, modelId: string, bandwidth: number) => request<KernelMatrix>('GET', `/experiments/${enc(id)}/kernel?model_id=${enc(modelId)}&bandwidth=${bandwidth}`),
  landscape: (id: string, modelId: string) => request<LossLandscape>('GET', `/experiments/${enc(id)}/landscape?model_id=${enc(modelId)}`),
  models: () => request<RegisteredModel[]>('GET', '/models'),
  deployed: (datasetId?: string) => request<DeployedModel[]>('GET', `/models/deployed${datasetId ? `?dataset=${enc(datasetId)}` : ''}`),
  deploy: (modelId: string) => request<DeployedModel>('POST', `/models/${enc(modelId)}/deploy`),
  predict: (req: PredictRequest) => request<Prediction>('POST', '/predict', req),
  predictBatch: (req: PredictRequest & { rows: { patientId: string; features: Record<string, number> }[] }) => request<BatchPrediction>('POST', '/predict/batch', req),
  openapi: () => request<Record<string, unknown>>('GET', '/openapi.json'),
};
