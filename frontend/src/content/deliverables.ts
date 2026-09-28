/** Platform modules and objectives → routes and component IDs. Single source for traceability. */

export type DeliverableId = 'D1' | 'D2' | 'D3' | 'D4' | 'D5';
export type ObjectiveId = 'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6';

export interface KeyComponent {
  id: string;
  name: string;
  route: string;
  tourId: string; // data-tour attribute of the implementing element
  component: string; // implementing React component
}

export interface Deliverable {
  id: DeliverableId;
  name: string;
  description: string;
  short: string;
  color: string;
  components: KeyComponent[];
}

export const DELIVERABLES: Deliverable[] = [
  {
    id: 'D1', short: 'Data engine', name: 'Data Pre-processing & Feature Engineering Module', description: 'Pipeline for handling biomedical data', color: 'var(--blue)',
    components: [
      { id: 'd1-clean', name: 'Data cleaning', route: '/preprocess', tourId: 'pp-step-dedupe', component: 'PipelineBuilder › StepCard(dedupe)' },
      { id: 'd1-norm', name: 'Normalization', route: '/preprocess', tourId: 'pp-step-scale', component: 'PipelineBuilder › StepCard(scale)' },
      { id: 'd1-dimred', name: 'Dimensionality reduction', route: '/preprocess', tourId: 'pp-step-reduce', component: 'PipelineBuilder › StepCard(reduce) + ScreePlot' },
      { id: 'd1-fs', name: 'Feature selection', route: '/preprocess', tourId: 'pp-step-feature_select', component: 'PipelineBuilder › StepCard(feature_select)' },
      { id: 'd1-missing', name: 'Handling of missing / noisy data', route: '/data', tourId: 'data-profile', component: 'ProfileTabs › Missing + Noise & outliers' },
    ],
  },
  {
    id: 'D2', short: 'Hybrid architecture', name: 'Hybrid Quantum-Classical Architecture', description: 'Overall system design', color: 'var(--navy)',
    components: [
      { id: 'd2-frontend', name: 'Classical front-end', route: '/architecture', tourId: 'arch-diagram', component: 'SystemDiagram' },
      { id: 'd2-qpu', name: 'Quantum processing unit (QPU / simulator)', route: '/architecture', tourId: 'arch-backends', component: 'ExecutionTargets' },
      { id: 'd2-encoding', name: 'Data encoding', route: '/architecture', tourId: 'arch-encoding', component: 'EncodingVisualizer' },
    ],
  },
  {
    id: 'D3', short: 'Quantum models', name: 'Quantum Machine Learning Models', description: 'Core predictive models', color: 'var(--purple)',
    components: [
      { id: 'd3-vqc', name: 'Variational Quantum Classifier (VQC)', route: '/models', tourId: 'models-catalog', component: 'ModelCatalog › VQC' },
      { id: 'd3-qsvm', name: 'Quantum SVM', route: '/models', tourId: 'models-catalog', component: 'ModelCatalog › QSVM (+ bandwidth tuning)' },
      { id: 'd3-qnn', name: 'Quantum Neural Network', route: '/models', tourId: 'models-catalog', component: 'ModelCatalog › QNN / Hybrid NN' },
      { id: 'd3-pqc', name: 'Parameterized quantum circuits', route: '/models', tourId: 'models-circuit', component: 'CircuitViewer(mode="build")' },
    ],
  },
  {
    id: 'D4', short: 'Decision support', name: 'Prediction & Decision Support Module', description: 'Inference and output generation', color: 'var(--green)',
    components: [
      { id: 'd4-prob', name: 'Disease probability scores', route: '/predict', tourId: 'predict-form', component: 'PatientForm + RiskGauge' },
      { id: 'd4-risk', name: 'Early risk stratification', route: '/predict', tourId: 'predict-bands', component: 'RiskBandEditor' },
      { id: 'd4-threshold', name: 'Threshold tuning for sensitivity/specificity', route: '/predict', tourId: 'predict-settings', component: 'DecisionSettings' },
    ],
  },
  {
    id: 'D5', short: 'Platform & API', name: 'Software Platform / Prototype', description: 'End-to-end usable system', color: 'var(--saffron)',
    components: [
      { id: 'd5-api', name: 'User interface or API', route: '/api', tourId: 'api-try', component: 'ApiConsole › TryIt' },
      { id: 'd5-upload', name: 'Dataset upload', route: '/data', tourId: 'data-upload', component: 'UploadZone' },
      { id: 'd5-dash', name: 'Model training & evaluation dashboard', route: '/dashboard', tourId: 'dash-kpis', component: 'Dashboard' },
      { id: 'd5-viz', name: 'Result visualization', route: '/experiments/exp-poc-001/results', tourId: 'results-leaderboard', component: 'ResultsPage' },
    ],
  },
];

export const OBJECTIVES: { id: ObjectiveId; text: string; how: string; pages: string[] }[] = [
  { id: 'O1', text: 'Design a hybrid quantum-classical ML architecture suitable for early disease detection.', how: 'System diagram with classical front-end, QPU/simulator ↔ optimizer loop and decision support; follow-one-patient trace.', pages: ['/', '/architecture', '/lab'] },
  { id: 'O2', text: 'Develop quantum-enhanced classification / regression models for high-dimensional biomedical data.', how: 'QSVM, VQC, QNN, Hybrid NN (classification) and QSVR/VQR (regression); PCA/LASSO reduce 7,129 genes to 8 qubits.', pages: ['/preprocess', '/models'] },
  { id: 'O3', text: 'Improve detection accuracy, sensitivity and specificity compared with classical ML baselines.', how: 'Measured, not assumed: the live O3 scorecard reports deltas with 95% CIs and significance tests.', pages: ['/dashboard', '/experiments/exp-poc-001/results', '/predict'] },
  { id: 'O4', text: 'Ensure the platform is scalable, interpretable, and compatible with NISQ hardware and simulators.', how: 'Backend compatibility checks, resource meters, noise-aware training, Celery/Redis scaling, IBM Quantum targets.', pages: ['/architecture', '/models', '/experiments/exp-poc-001/train', '/api', '/settings'] },
  { id: 'O5', text: 'Incorporate data pre-processing, feature selection and model explainability modules.', how: 'Drag-and-drop D1 pipeline; SHAP mapped back from PCs to clinical features; clinician plain-language view.', pages: ['/data', '/preprocess', '/experiments/exp-poc-001/explain'] },
  { id: 'O6', text: 'Benchmark the hybrid approach against classical models on accuracy, efficiency and generalization.', how: 'k-fold CV, McNemar/Wilcoxon, learning curves, external validation, noise robustness, efficiency frontier, qubit scaling.', pages: ['/dashboard', '/experiments/exp-poc-001/results', '/experiments'] },
];

export const EXPECTED_SOLUTION: { item: string; route: string; tourId: string }[] = [
  { item: 'Data-handling pipelines', route: '/preprocess', tourId: 'pp-builder' },
  { item: 'Hybrid quantum-classical model implementation', route: '/models', tourId: 'models-circuit' },
  { item: 'Training & inference workflows', route: '/experiments/exp-poc-001/train', tourId: 'train-charts' },
  { item: 'Performance evaluation', route: '/experiments/exp-poc-001/results', tourId: 'results-o3' },
  { item: 'Explainability features', route: '/experiments/exp-poc-001/explain', tourId: 'explain-global' },
  { item: 'Comprehensive documentation', route: '/docs', tourId: 'docs-toc' },
];

/** Page → deliverables / objectives (Section 10). */
export const ROUTE_TRACE: Record<string, { d: DeliverableId[]; o: ObjectiveId[] }> = {
  home: { d: ['D2', 'D5'], o: ['O1'] },
  dashboard: { d: ['D5'], o: ['O3', 'O6'] },
  data: { d: ['D1', 'D5'], o: ['O5'] },
  preprocess: { d: ['D1'], o: ['O2', 'O5'] },
  architecture: { d: ['D2'], o: ['O1', 'O4'] },
  models: { d: ['D2', 'D3'], o: ['O2', 'O4'] },
  train: { d: ['D3', 'D5'], o: ['O4'] },
  results: { d: ['D5'], o: ['O3', 'O6'] },
  explain: { d: ['D3', 'D4'], o: ['O5'] },
  predict: { d: ['D4', 'D5'], o: ['O3'] },
  experiments: { d: ['D5'], o: ['O6'] },
  api: { d: ['D5'], o: ['O4'] },
  deliverables: { d: ['D1', 'D2', 'D3', 'D4', 'D5'], o: ['O1', 'O2', 'O3', 'O4', 'O5', 'O6'] },
  lab: { d: ['D2', 'D3'], o: ['O1'] },
  docs: { d: ['D1', 'D2', 'D3', 'D4', 'D5'], o: ['O1', 'O2', 'O3', 'O4', 'O5', 'O6'] },
  settings: { d: ['D5'], o: ['O4'] },
};

export const D_COLORS: Record<DeliverableId, string> = { D1: 'var(--blue)', D2: 'var(--navy)', D3: 'var(--purple)', D4: 'var(--green)', D5: 'var(--saffron)' };
