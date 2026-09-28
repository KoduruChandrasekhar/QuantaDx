/** A realistic OpenAPI 3.1 document served at /openapi.json by the mock backend (mirrors the FastAPI app). */

interface Op {
  method: 'get' | 'post' | 'delete';
  path: string;
  tag: string;
  summary: string;
  deliverable: string;
  body?: Record<string, unknown>;
  response: string;
  params?: { name: string; in: 'path' | 'query'; required?: boolean; description?: string }[];
}

const OPS: Op[] = [
  { method: 'get', path: '/health', tag: 'Platform', summary: 'Service health, versions and backend counts', deliverable: 'D5', response: 'Health' },
  { method: 'post', path: '/datasets/upload', tag: 'Datasets', summary: 'Upload a CSV/XLSX, or a ZIP of images + labels.csv (multipart)', deliverable: 'D1, D5', response: 'Dataset', body: { file: '<binary>', mode: 'tabular | genomics | imaging' } },
  { method: 'get', path: '/datasets', tag: 'Datasets', summary: 'List datasets', deliverable: 'D1, D5', response: 'Dataset[]' },
  { method: 'get', path: '/datasets/benchmarks', tag: 'Datasets', summary: 'Built-in benchmark datasets', deliverable: 'D1, D5', response: 'Dataset[]' },
  { method: 'get', path: '/datasets/{id}', tag: 'Datasets', summary: 'Dataset detail', deliverable: 'D1, D5', response: 'Dataset', params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'get', path: '/datasets/{id}/profile', tag: 'Datasets', summary: 'Schema, missingness, outliers, noise estimate, quality score', deliverable: 'D1', response: 'DatasetProfile', params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'post', path: '/datasets/{id}/extract-features', tag: 'Datasets', summary: 'CNN / radiomics embeddings for image datasets (async job)', deliverable: 'D1', response: 'FeatureExtractionResult', params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'post', path: '/preprocess', tag: 'Pre-processing', summary: 'Fit + apply the pre-processing pipeline (train split only)', deliverable: 'D1', response: 'PreprocessResult', body: { datasetId: 'wdbc', config: { steps: [], split: { train: 70, val: 15, test: 15, stratified: true, seed: 42 } } } },
  { method: 'post', path: '/preprocess/preview', tag: 'Pre-processing', summary: 'Before/after preview for a config (no persistence)', deliverable: 'D1', response: 'PreprocessPreview' },
  { method: 'post', path: '/circuit/preview', tag: 'Quantum', summary: 'CircuitSpec from a quantum config (no training)', deliverable: 'D2, D3', response: 'CircuitSpec', body: { nQubits: 6, quantum: { encoding: 'zz_feature_map', encodingReps: 2, ansatz: 'real_amplitudes', layers: 2 } } },
  { method: 'post', path: '/kernel/preview', tag: 'Quantum', summary: 'Kernel matrix on a sample for a feature map + bandwidth', deliverable: 'D3', response: 'KernelMatrix', body: { datasetId: 'wdbc', bandwidth: 0.2 } },
  { method: 'get', path: '/backends', tag: 'Quantum', summary: 'Simulators + IBM Quantum hardware with status and queue', deliverable: 'D2, O4', response: 'QuantumBackend[]' },
  { method: 'post', path: '/experiments', tag: 'Experiments', summary: 'Start a training experiment (Celery job)', deliverable: 'D3, D5', response: '{ experiment_id }', body: { name: 'My run', datasetId: 'wdbc', models: [{ kind: 'qsvm' }, { kind: 'logreg' }] } },
  { method: 'get', path: '/experiments', tag: 'Experiments', summary: 'List experiments', deliverable: 'D5', response: 'Experiment[]' },
  { method: 'get', path: '/experiments/{id}', tag: 'Experiments', summary: 'Experiment detail', deliverable: 'D5', response: 'Experiment', params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'post', path: '/experiments/{id}/cancel', tag: 'Experiments', summary: 'Cancel a running experiment', deliverable: 'D5', response: 'Experiment', params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'delete', path: '/experiments/{id}', tag: 'Experiments', summary: 'Delete an experiment', deliverable: 'D5', response: '{ deleted }', params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'get', path: '/experiments/{id}/stream', tag: 'Experiments', summary: 'WebSocket: TrainingEvent messages (Redis pub/sub)', deliverable: 'D5', response: 'TrainingEvent (ws)', params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'get', path: '/experiments/{id}/results', tag: 'Evaluation', summary: 'Metrics, CV folds, curves, significance, noise and scaling series', deliverable: 'O3, O6', response: 'ExperimentResults', params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'get', path: '/experiments/{id}/circuit', tag: 'Quantum', summary: 'Trained CircuitSpec', deliverable: 'D3', response: 'CircuitSpec', params: [{ name: 'id', in: 'path', required: true }, { name: 'model_id', in: 'query' }] },
  { method: 'get', path: '/experiments/{id}/explain', tag: 'Explainability', summary: 'Global SHAP / permutation importance', deliverable: 'O5', response: 'GlobalExplanation', params: [{ name: 'id', in: 'path', required: true }, { name: 'model_id', in: 'query' }] },
  { method: 'post', path: '/explain/local', tag: 'Explainability', summary: 'Local explanation for one sample', deliverable: 'O5, D4', response: 'LocalExplanation' },
  { method: 'get', path: '/experiments/{id}/kernel', tag: 'Quantum', summary: 'Quantum kernel matrix', deliverable: 'D3', response: 'KernelMatrix', params: [{ name: 'id', in: 'path', required: true }, { name: 'model_id', in: 'query' }] },
  { method: 'get', path: '/experiments/{id}/landscape', tag: 'Quantum', summary: '2-parameter loss-landscape slice', deliverable: 'D3', response: 'LossLandscape', params: [{ name: 'id', in: 'path', required: true }, { name: 'model_id', in: 'query' }] },
  { method: 'post', path: '/experiments/{id}/external-validation', tag: 'Evaluation', summary: 'Evaluate on another dataset / held-out site', deliverable: 'O6', response: 'ExternalValidation', params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'post', path: '/models/{id}/deploy', tag: 'Models', summary: 'Promote a model to production (MLflow registry)', deliverable: 'D4, D5', response: 'DeployedModel', params: [{ name: 'id', in: 'path', required: true }] },
  { method: 'get', path: '/models/deployed', tag: 'Models', summary: 'Serving status', deliverable: 'D4, D5', response: 'DeployedModel[]' },
  { method: 'post', path: '/predict', tag: 'Prediction', summary: 'Single-patient disease probability, risk band and factors', deliverable: 'D4', response: 'Prediction', body: { datasetId: 'wdbc', features: { radius_mean: 17.99, texture_mean: 10.38, concave_points_worst: 0.265 }, threshold: 0.5 } },
  { method: 'post', path: '/predict/batch', tag: 'Prediction', summary: 'Cohort predictions with risk stratification', deliverable: 'D4', response: 'BatchPrediction' },
  { method: 'get', path: '/openapi.json', tag: 'Platform', summary: 'This OpenAPI document', deliverable: 'D5', response: 'OpenAPI' },
];

export function openApiSpec(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const o of OPS) {
    paths[o.path] ??= {};
    paths[o.path][o.method] = {
      tags: [o.tag],
      summary: o.summary,
      'x-deliverable': o.deliverable,
      parameters: (o.params ?? []).map((p) => ({ name: p.name, in: p.in, required: !!p.required, schema: { type: 'string' } })),
      ...(o.body ? { requestBody: { content: { 'application/json': { example: o.body } } } } : {}),
      responses: { '200': { description: o.response }, '422': { description: 'Validation error' } },
      security: [{ ApiKeyHeader: [] }],
    };
  }
  return {
    openapi: '3.1.0',
    info: { title: 'QuantaDx API', version: '1.0.0', description: 'Hybrid quantum-classical AI platform for early disease detection' },
    servers: [{ url: 'http://localhost:8000' }],
    components: { securitySchemes: { ApiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-API-Key' } } },
    paths,
  };
}

export const API_OPS = OPS;
