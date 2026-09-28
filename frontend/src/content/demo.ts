/** Guided demo (Section 14): walks the full pipeline in order, < 3 minutes, fully offline. */
export interface DemoStep {
  route: string;
  target: string;
  title: string;
  caption: string;
  tag: string;
  verify: string[];
  ms: number;
}

export const DEMO_STEPS: DemoStep[] = [
  { route: '/', target: 'home-pipeline', tag: 'Overview', title: 'The QuantaDx pipeline', caption: 'Ingest → Pre-process → Quantum encode → Hybrid train (QPU ↔ optimizer loop) → Explain → Decision support. Every step is live in QuantaDx — from raw records to a clinical decision.', verify: [], ms: 12000 },
  { route: '/data', target: 'data-profile', tag: 'Data', title: 'Ingest & profile: Wisconsin Breast Cancer', caption: '569 patients, 30 FNA image features. The profiler flags missing values, IQR/z-score outliers, noise and a 1.68:1 class imbalance before anything is trained.', verify: ['d5-upload', 'd1-missing'], ms: 13000 },
  { route: '/preprocess', target: 'pp-qubit-budget', tag: 'Pre-process', title: 'Pre-processing → 6 qubits', caption: 'Cleaning → median imputation → IQR clipping → StandardScaler → PCA(6) → MinMax [0, π]. The Qubit Budget maps each principal component to its qubit — all fitted on the training split only.', verify: ['d1-clean', 'd1-norm', 'd1-fs', 'd1-dimred'], ms: 14000 },
  { route: '/architecture?follow=1', target: 'arch-follow', tag: 'Architecture', title: 'Follow one patient through the hybrid system', caption: 'Raw record → cleaned → scaled → PCA → rotation angles → encoded state (Bloch grid) → circuit → ⟨Z⟩ → probability → risk band. Real values at every hop.', verify: ['d2-frontend', 'd2-qpu'], ms: 15000 },
  { route: '/architecture?bw=sweep', target: 'arch-encoding', tag: 'Encoding', title: 'Bandwidth beats kernel concentration', caption: 'At bandwidth 1.0 the ZZ kernel is nearly the identity (all patients look alike). Shrinking the bandwidth restores block structure — accuracy 81.5% → 94.0%.', verify: ['d2-encoding'], ms: 14000 },
  { route: '/models', target: 'models-circuit', tag: 'Models', title: 'Model Studio', caption: 'QSVM (bandwidth auto), VQC, QNN and Hybrid NN next to classical baselines — same splits and seeds. The parameterized circuit builds live with resource meters.', verify: ['d3-vqc', 'd3-qsvm', 'd3-qnn', 'd3-pqc'], ms: 13000 },
  { route: '/experiments/exp-poc-001/train?replay=1', target: 'train-charts', tag: 'Training', title: 'Training monitor (3× replay)', caption: 'Streaming loss, validation accuracy and gradient norms; the live circuit updates its trainable θ as the optimizer moves.', verify: [], ms: 14000 },
  { route: '/experiments/exp-poc-001/results', target: 'results-o3', tag: 'Benchmark', title: 'Honest benchmark', caption: 'Tuned QSVM matches the best classical specificity (96.9%) but trails on sensitivity (▼ 5.6 pts). Significance tests, bandwidth sweep and noise robustness follow — no claimed quantum advantage.', verify: ['d5-viz'], ms: 15000 },
  { route: '/experiments/exp-poc-001/explain', target: 'explain-pca', tag: 'Explain', title: 'Explainability clinicians can read', caption: 'SHAP on principal components, mapped back through PCA loadings to clinical features — “worst concave points”, not “PC1”.', verify: [], ms: 13000 },
  { route: '/predict?demo=1', target: 'predict-result', tag: 'Decision', title: 'Decision support', caption: 'Screening preset favours sensitivity. An at-risk patient gets a probability, a risk band with a recommended action, an uncertainty interval and the top factors.', verify: ['d4-prob', 'd4-risk', 'd4-threshold'], ms: 15000 },
  { route: '/api?demo=1', target: 'api-try', tag: 'API', title: 'Hospital integration via API', caption: 'The same prediction through POST /predict — REST + JSON with an OpenAPI explorer and copy-paste snippets.', verify: ['d5-api'], ms: 12000 },
  { route: '/deliverables', target: 'deliverables-page', tag: 'Capabilities', title: 'Every capability, verified', caption: 'Each capability links to the live screen that implements it — data, architecture, models, decision support and the platform.', verify: ['d5-dash'], ms: 12000 },
];
