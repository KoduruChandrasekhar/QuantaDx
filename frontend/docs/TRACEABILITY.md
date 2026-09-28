# Traceability: deliverables → pages → components

Source of truth: `src/content/deliverables.ts` (checked by `src/lib/lib.test.ts › traceability`). In the app: `/deliverables`, with “Show me” links.

| Deliverable | Key component | Route | Component (`data-tour`) |
|---|---|---|---|
| D1 | Data cleaning | /preprocess | StepCard(dedupe) `pp-step-dedupe` |
| D1 | Normalization | /preprocess | StepCard(scale) `pp-step-scale` |
| D1 | Dimensionality reduction | /preprocess | StepCard(reduce) + scree plot `pp-step-reduce` |
| D1 | Feature selection | /preprocess | StepCard(feature_select) `pp-step-feature_select` |
| D1 | Missing / noisy data | /data | Profile tabs `data-profile` |
| D2 | Classical front-end | /architecture | SystemDiagram `arch-diagram` |
| D2 | QPU / simulator | /architecture | ExecutionTargets `arch-backends` |
| D2 | Data encoding | /architecture | EncodingVisualizer + KernelPanel `arch-encoding` |
| D3 | VQC · QSVM · QNN | /models | ModelCatalog `models-catalog` |
| D3 | Parameterized quantum circuits | /models | CircuitViewer (build mode) `models-circuit` |
| D4 | Disease probability scores | /predict | PatientForm + RiskGauge `predict-form` / `predict-result` |
| D4 | Early risk stratification | /predict | RiskBandEditor `predict-bands` |
| D4 | Threshold tuning | /predict | DecisionSettings `predict-settings` |
| D5 | UI or API | /api | TryPredict `api-try` |
| D5 | Dataset upload | /data | UploadZone `data-upload` |
| D5 | Training & evaluation dashboard | /dashboard | KPIs `dash-kpis` |
| D5 | Result visualization | /experiments/:id/results | Leaderboard `results-leaderboard` |

| Route | Deliverables | Objectives |
|---|---|---|
| / | D2, D5 | O1 |
| /dashboard | D5 | O3, O6 |
| /data | D1, D5 | O5 |
| /preprocess | D1 | O2, O5 |
| /architecture | D2 | O1, O4 |
| /models | D2, D3 | O2, O4 |
| /experiments/:id/train | D3, D5 | O4 |
| /experiments/:id/results | D5 | O3, O6 |
| /experiments/:id/explain | D3, D4 | O5 |
| /predict | D4, D5 | O3 |
| /experiments | D5 | O6 |
| /api | D5 | O4 |
| /deliverables | D1–D5 | O1–O6 |
| /lab | D2, D3 | O1 |
| /docs | all | all |
| /settings | D5 | O4 |
