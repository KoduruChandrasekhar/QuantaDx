/** Documentation content (doubles as repo documentation). Blocks render as paragraphs, lists, formulas, tables. */
export type Block =
  | { p: string }
  | { list: string[] }
  | { tex: string }
  | { table: { head: string[]; rows: string[][] } }
  | { embed: 'architecture' | 'gates' | 'poc' };

export interface DocSection {
  id: string;
  title: string;
  tag?: string;
  blocks: Block[];
}

export const DOCS: DocSection[] = [
  { id: 'overview', title: '1. Overview: the problem QuantaDx solves', tag: 'QuantaDx', blocks: [
    { p: 'QuantaDx is a hybrid quantum-classical AI platform for early disease detection. It turns noisy, high-dimensional biomedical data into a handful of qubits, trains quantum-enhanced models alongside strong classical baselines, and delivers calibrated, explainable risk scores clinicians can act on.' },
    { p: 'Early and accurate detection of disease significantly improves treatment outcomes and reduces healthcare costs. Classical ML struggles with high-dimensional, noisy biomedical data (genomics, imaging, EHR). A hybrid quantum-classical approach uses quantum methods while remaining executable on simulators and near-term (NISQ) devices.' },
    { p: 'The platform integrates classical pre-processing and feature engineering with quantum-enhanced models (QSVM, QNN, VQC) on cancer, cardiovascular and neurological datasets, and supports data ingestion, hybrid training, prediction, explainability and evaluation against classical baselines.' },
    { table: { head: ['Code', 'Module', 'Key components'], rows: [
      ['D1', 'Data Pre-processing & Feature Engineering Module', 'Data cleaning · normalization · dimensionality reduction · feature selection · missing / noisy data'],
      ['D2', 'Hybrid Quantum-Classical Architecture', 'Classical front-end · QPU / simulator · data encoding'],
      ['D3', 'Quantum Machine Learning Models', 'VQC · Quantum SVM · QNN · parameterized quantum circuits'],
      ['D4', 'Prediction & Decision Support Module', 'Disease probability scores · early risk stratification · threshold tuning'],
      ['D5', 'Software Platform / Prototype', 'UI or API · dataset upload · training & evaluation dashboard · result visualization'],
    ] } },
    { list: ['O1 Hybrid architecture for early detection', 'O2 Quantum-enhanced classification / regression on high-dimensional data', 'O3 Accuracy, sensitivity, specificity vs classical baselines', 'O4 Scalable, interpretable, NISQ-compatible', 'O5 Pre-processing, feature selection, explainability', 'O6 Benchmark accuracy, efficiency, generalization'] },
  ] },
  { id: 'architecture', title: '2. System architecture', tag: 'D2', blocks: [
    { p: 'Data Sources → Classical Front-end (CPU) → QPU / Simulator ↔ Classical Optimizer loop → Decision Support, on top of a Platform Layer (React UI ⇄ FastAPI REST + WebSocket ⇄ Celery + Redis ⇄ PostgreSQL + MLflow · Docker).' },
    { embed: 'architecture' },
  ] },
  { id: 'd1', title: '3. D1 · Data pipeline', tag: 'D1', blocks: [
    { list: ['Data cleaning: drop duplicates, fix types, drop constant columns, trim invalid ranges.', 'Missing values: drop rows / mean / median / most frequent / KNN(k) / iterative (MICE) + optional indicator columns.', 'Noise & outliers: IQR clip / z-score clip (threshold) / winsorise; optional smoothing.', 'Categorical encoding: one-hot / ordinal.', 'Normalisation: StandardScaler / MinMax [0,1] / MinMax [0,π] (angle encoding) / Robust.', 'Class imbalance: class weights / SMOTE(k) — training split only.', 'Feature selection: variance, mutual information, ANOVA-F, RFE, LASSO(C) with top-k.', 'Dimensionality reduction: PCA / LDA / autoencoder (latent size).'] },
    { p: 'Leakage guard: every fitted statistic (imputer, scaler, selector, PCA, SMOTE) is fit on the training split only.' },
  ] },
  { id: 'd2', title: '4. D2 · Encodings', tag: 'D2', blocks: [
    { p: 'Angle encoding: each scaled feature xᵢ ∈ [0, π] becomes RY(xᵢ) on qubit i.' },
    { tex: '|\\phi(x)\\rangle=\\bigotimes_i R_Y(x_i)|0\\rangle' },
    { p: 'ZZ feature map (reps 2, linear entanglement):' },
    { tex: 'U_\\phi(x)=\\Big[\\prod_{(i,j)}\\mathrm{CX}_{ij}P\\big(2(\\pi-x_i)(\\pi-x_j)\\big)_j\\mathrm{CX}_{ij}\\prod_iP(2x_i)H^{\\otimes n}\\Big]^{2}' },
    { p: 'Amplitude encoding stores a normalised 2ⁿ vector in n qubits (30 features → 5 qubits).' },
    { tex: '|x\\rangle=\\sum_{i}\\frac{x_i}{\\lVert x\\rVert}|i\\rangle' },
    { p: 'Bandwidth b rescales features before encoding (x → b·x) and is chosen by inner CV to avoid kernel concentration.' },
  ] },
  { id: 'd3', title: '5. D3 · Models', tag: 'D3', blocks: [
    { p: 'QSVM: fidelity kernel + classical SVM.' },
    { tex: 'k(x,x\')=|\\langle\\phi(bx)|\\phi(bx\')\\rangle|^2' },
    { p: 'VQC: feature map + ansatz W(θ); read-out p = (1 + ⟨Z₀⟩)/2. QNN: PennyLane QNode with multi-qubit read-out. Hybrid NN: Dense → quantum layer → Dense → sigmoid. QSVR / VQR for regression.' },
    { p: 'Ansätze: RealAmplitudes, EfficientSU2, StronglyEntanglingLayers, BasicEntanglerLayers. Optimisers: COBYLA, SPSA (noisy/hardware), Adam, L-BFGS-B.' },
    { p: 'Parameter-shift rule (exact gradients on hardware):' },
    { tex: '\\frac{\\partial f}{\\partial\\theta}=\\tfrac12\\big[f(\\theta+\\tfrac\\pi2)-f(\\theta-\\tfrac\\pi2)\\big]' },
  ] },
  { id: 'd4', title: '6. D4 · Decision support', tag: 'D4', blocks: [
    { p: 'Probabilities are calibrated (reliability diagram, Brier score). Risk bands default to Low 0–0.3, Moderate 0.3–0.7, High 0.7–1 and are editable with per-band actions.' },
    { list: ["Balanced: Youden's J = sensitivity + specificity − 1, maximised.", 'Cost-weighted: minimise c_FN·FN + c_FP·FP.', 'Sensitivity-constrained: highest threshold with sensitivity ≥ target (screening).', 'Specificity-constrained: lowest threshold with specificity ≥ target (confirmatory).'] },
  ] },
  { id: 'd5', title: '7. D5 · Platform & API', tag: 'D5', blocks: [
    { p: 'Every page maps to deliverables (see /deliverables). The REST + WebSocket API is documented at /api with an OpenAPI explorer and a live /predict console.' },
    { table: { head: ['Page', 'Purpose'], rows: [['/data', 'Upload & profile'], ['/preprocess', 'D1 pipeline'], ['/architecture', 'D2 system & encodings'], ['/models', 'D3 Model Studio'], ['/experiments/:id/train', 'Live training'], ['/experiments/:id/results', 'O3/O6 benchmark'], ['/experiments/:id/explain', 'O5 explainability'], ['/predict', 'D4 decision support'], ['/api', 'Integration'], ['/lab', 'Quantum playground']] } },
  ] },
  { id: 'metrics', title: '8. Evaluation protocol & metric formulas', blocks: [
    { p: 'Stratified k-fold CV (default 5, seed 42) with an untouched hold-out; mean ± std over folds; out-of-fold predictions pooled for curves.' },
    { tex: '\\text{Sensitivity}=\\frac{TP}{TP+FN}\\qquad\\text{Specificity}=\\frac{TN}{TN+FP}\\qquad\\text{PPV}=\\frac{TP}{TP+FP}\\qquad\\text{NPV}=\\frac{TN}{TN+FN}' },
    { tex: 'F_1=\\frac{2\\,PPV\\cdot Sens}{PPV+Sens}\\qquad MCC=\\frac{TP\\cdot TN-FP\\cdot FN}{\\sqrt{(TP+FP)(TP+FN)(TN+FP)(TN+FN)}}' },
    { tex: '\\text{Brier}=\\frac1N\\sum_i(p_i-y_i)^2\\qquad RMSE=\\sqrt{\\tfrac1N\\sum(y-\\hat y)^2}\\qquad R^2=1-\\frac{\\sum(y-\\hat y)^2}{\\sum(y-\\bar y)^2}' },
    { p: 'ROC-AUC = area under sensitivity vs 1 − specificity; PR-AUC = average precision.' },
  ] },
  { id: 'stats', title: '9. Statistical tests', blocks: [
    { p: 'McNemar (paired predictions, continuity-corrected):' },
    { tex: '\\chi^2=\\frac{(|b-c|-1)^2}{b+c}' },
    { p: 'Paired t-test and exact Wilcoxon signed-rank on per-fold scores. With 5 folds the smallest achievable two-sided Wilcoxon p is 0.0625 — so fold-level tests alone can never declare significance at 0.05.' },
  ] },
  { id: 'poc', title: '10. Proof-of-concept results', tag: 'PoC', blocks: [
    { p: 'Wisconsin Breast Cancer (569 patients, 30 features, malignant positive). StandardScaler → PCA(6) → MinMax [0, π] → ZZ feature map (reps 2, linear) → statevector → 5-fold stratified CV (seed 42).' },
    { embed: 'poc' },
    { p: 'Bandwidth tuning fixed kernel concentration (81.5% → 94.0%). The tuned kernel matches the best classical specificity (96.9%) but trails on sensitivity. Next: threshold tuning and hybrid models.' },
  ] },
  { id: 'nisq', title: '11. NISQ limitations & honesty statement', blocks: [
    { list: ['Qubit counts: 6–8 qubits in the PoC; statevector memory 16 B × 2ⁿ.', 'Noise: depolarizing, readout, T1/T2 — mitigated with readout correction and ZNE, but not eliminated.', 'Barren plateaus: deep random circuits have vanishing gradients; we keep ansätze shallow.', 'Kernel concentration: fidelity kernels collapse without bandwidth tuning.', 'Quantum advantage is not assumed — it is measured, and on this dataset it is not observed.'] },
  ] },
  { id: 'gates', title: '12. Gate reference', blocks: [{ embed: 'gates' }] },
  { id: 'ethics', title: '13. Privacy & ethics', blocks: [
    { list: ['DPDP Act 2023: data minimisation, purpose limitation, consent.', 'ICMR ethical guidelines for AI in healthcare: human oversight, transparency, accountability.', 'De-identification: PHI-like columns are detected and can be dropped before upload; no PHI in URLs, logs or analytics; tokens never in localStorage.', 'Decision support only — never a diagnosis.'] },
  ] },
  { id: 'refs', title: '14. References', blocks: [
    { list: ['Havlíček et al., “Supervised learning with quantum-enhanced feature spaces”, Nature 2019.', 'Schuld & Killoran, “Quantum machine learning in feature Hilbert spaces”, PRL 2019.', 'Shaydulin & Wild, “Importance of kernel bandwidth in quantum machine learning”, PRA 2022.', 'Thanasilp et al., “Exponential concentration in quantum kernel methods”, 2022.', 'McClean et al., “Barren plateaus in quantum neural network training landscapes”, Nat. Commun. 2018.', 'Mitarai et al., “Quantum circuit learning”, PRA 2018 (parameter shift).', 'Temme, Bravyi & Gambetta, “Error mitigation for short-depth circuits”, PRL 2017 (ZNE).', 'Lundberg & Lee, “A unified approach to interpreting model predictions”, NeurIPS 2017 (SHAP).', 'Street, Wolberg & Mangasarian, “Nuclear feature extraction for breast tumor diagnosis”, 1993 (WDBC).', 'WHO NCD fact sheet 2025; ICMR-NCRP 2022; SEER 2016–2022.'] },
  ] },
  { id: 'about', title: '15. About', blocks: [
    { p: 'QuantaDx — hybrid quantum-classical AI for early disease detection. Built by a multidisciplinary team spanning quantum computing, machine learning, data engineering and clinical practice.' },
    { table: { head: ['Role', 'Responsibility'], rows: [['Quantum ML lead', 'Feature maps, kernels, VQC/QNN'], ['Classical ML lead', 'Baselines, CV, statistics'], ['Data engineer', 'D1 pipeline, profiling'], ['Full-stack', 'FastAPI, Celery, this UI'], ['Clinical liaison', 'Risk bands, actions, explainability wording'], ['Research & docs', 'Benchmarks, references, compliance']] } },
  ] },
];
