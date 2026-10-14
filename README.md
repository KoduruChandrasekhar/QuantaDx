<div align="center">

# QuantaDx

### Hybrid Quantum–Classical AI for Early Disease Detection

**Smart India Hackathon 2026** · Problem Statement **26139** · Team **Trace Force_A0** (ID 176689)
Theme: MedTech / BioTech / HealthTech · Category: Software

[**Live demo**](https://quantadx.vercel.app) · [**Demo video**](https://youtu.be/jIR71ZNFoB8) · [**SIH submission details**](docs/SIH_SUBMISSION.md) · [**Results**](docs/RESULTS.md)

![License](https://img.shields.io/badge/license-MIT-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6)
![Vite](https://img.shields.io/badge/Vite-6-646cff)
![Qubits](https://img.shields.io/badge/qubits-8-7b3fa0)

</div>

---

## Table of contents

1. [The problem](#the-problem)
2. [Our solution](#our-solution)
3. [Proof-of-concept results](#proof-of-concept-results)
4. [Features](#features)
5. [Mapping to the problem statement](#mapping-to-the-problem-statement)
6. [Architecture](#architecture)
7. [Tech stack](#tech-stack)
8. [Getting started](#getting-started)
9. [Demo walkthrough](#demo-walkthrough)
10. [Repository layout](#repository-layout)
11. [Feasibility, risks and compliance](#feasibility-risks-and-compliance)
12. [Roadmap](#roadmap)
13. [Current scope and limitations](#current-scope-and-limitations)
14. [Documentation index](#documentation-index)
15. [Team](#team)
16. [References](#references)
17. [License](#license)

---

## The problem

Cancer, cardiovascular and neurological diseases are often caught late. Biomedical data (EHR, genomics, imaging) is
high-dimensional, noisy and imbalanced, which leads to missed positives and black-box models. Near-term (NISQ) quantum
devices are small and noisy, so they cannot simply be pointed at raw clinical data.

| Statistic | Source |
|---|---|
| 43 M deaths per year from non-communicable diseases | WHO [16] |
| 14.6 lakh cancer cases in India (2022) | ICMR-NCRP [17] |
| Breast cancer 5-year survival drops from ~100% (localized) to 34% (distant) | NCI SEER [18] |

Reference numbers in brackets point to [docs/REFERENCES.md](docs/REFERENCES.md).

## Our solution

**QuantaDx** is a hybrid quantum–classical machine-learning platform for early disease detection and screening support.
The CPU cleans and compresses the data for a small QPU, the QPU learns a quantum similarity, and the CPU then decides
and explains.

> **CPU compresses → QPU learns → CPU decides & explains**

### The 6-step hybrid pipeline

| # | Stage | What happens |
|---|---|---|
| 1 | **Data ingestion** | EHR / lab tables / CSV, PHI checks |
| 2 | **Pre-processing** | KNN imputation, IQR clipping, SMOTE (training folds only) |
| 3 | **Feature reduction** | Feature engineering, MI / LASSO selection, PCA **30 → 8** features (93% variance) |
| 4 | **Quantum encoding** | ZZ feature map → entangled **8-qubit** state |
| 5 | **Hybrid kernel SVM** | `K = α·K_Q + (1−α)·K_RBF`, α and bandwidth tuned by inner CV; VQC / QNN benchmarked |
| 6 | **Calibrate & explain** | ≥95% sensitivity threshold, Low / Medium / High risk tier, SHAP on clinical features |

### Why this design

- **Why quantum?** A ZZ-map quantum kernel uses superposition and entanglement to build an alternative feature-space
  similarity that may capture structure classical kernels miss [3, 4].
- **Why hybrid?** The CPU reduces dimension to fit a small NISQ QPU, and fusing `K_Q` with `K_RBF` combines
  complementary similarities.
- **Why sensitivity-first?** The threshold is set for ≥95% sensitivity on inner folds, so a screening tool produces fewer
  false negatives.
- **Why not just XGBoost?** Under the same 5-fold CV the hybrid kernel missed 7 cancers against XGBoost's 12
  (McNemar p = 0.004).

### What is new here

- Hybrid quantum + classical kernel (α-mix) rather than a purely quantum model
- Bandwidth tuning (plus the α-mix) to counter kernel concentration [10, 11]
- Sensitivity-first screening threshold
- Honest benchmarking: k-fold CV with McNemar significance testing, including the cases where we are *not* significantly better
- Interpretability: SHAP on clinical features, fast enough on quantum models (KernelSHAP on cached states, 360k evaluations in 26 s)
- Hardware-agnostic: Qiskit, PennyLane and IBM back-ends

## Proof-of-concept results

Dataset: **UCI Breast Cancer Wisconsin (Diagnostic)**, n = 569 (212 malignant) [14]. PCA to 8 qubits, ≥95% sensitivity
threshold chosen on inner folds, 5-fold cross-validation.

| Metric (Hybrid Q+C kernel) | Value |
|---|---|
| Sensitivity | **96.7%** |
| Specificity | **98.0%** |
| Accuracy | **97.5%** |
| Missed cancers | **7 of 212** |

**Missed cancers out of 212 (lower is better)**

| Model | Missed |
|---|---|
| Logistic Regression | 14 |
| SVM (RBF) | 10 |
| XGBoost | 12 |
| QSVM (quantum only) | 10 |
| **Hybrid Q+C** | **7** |

**Significance (McNemar, paired CV predictions):** significant against XGBoost (p = 0.004); *not* significant against
Logistic Regression (p = 0.12) or SVM (p = 0.22). We report this plainly: the hybrid kernel is competitive with strong
classical baselines and clearly ahead of XGBoost on missed cancers, not a blanket quantum win.

> **Evidence boundary.** These are results on a public diagnostic dataset. The next steps are external validation,
> a hospital pilot, and real-QPU validation. QuantaDx is **decision support, not diagnosis**.

Full table, method notes and caveats: [docs/RESULTS.md](docs/RESULTS.md).

## Features

### D1 · Data ingestion and pre-processing
- Dataset picker with public benchmarks: UCI Breast Cancer Wisconsin (WDBC), Heart Disease (Cleveland), Pima Diabetes, Parkinson's Voice, Parkinson's Telemonitoring (UPDRS regression), Chronic Kidney Disease, and Leukemia ALL/AML gene expression (small-n, high-p). TCGA genomics is on the roadmap
- Upload your own **CSV**, wide genomics CSV or image ZIP. Nothing is sent until you confirm
- **PHI check**: PHI-like columns are detected and can be dropped before anything is used
- Data profiling tabs: missingness, distributions, outliers, class imbalance, correlations
- Drag-to-reorder, toggleable pre-processing pipeline: de-duplication, imputation (mean / median / KNN / iterative), IQR / noise clipping, scaling, SMOTE (train folds only), feature selection (MI / LASSO), dimensionality reduction (PCA, LDA, autoencoder)
- **Live qubit budget** and before/after preview as steps change

### D2 · Hybrid architecture and data encoding
- Interactive system diagram: classical front-end → QPU / simulator → classical decision layer
- Execution targets: Aer simulator, IBM QPU (via Qiskit Runtime), PennyLane devices
- Encoding visualiser: angle, ZZ, Pauli, IQP and amplitude encodings
- **Follow one patient**: trace a single record through the whole pipeline, with a tiny VQC trained in your browser (SPSA)
- Kernel heatmaps with class-sort animation, a bandwidth slider and kernel-concentration diagnostics
- Noise visualiser for NISQ effects

### D3 · Quantum machine-learning models
- Model catalog: **Quantum SVM (QSVM), Variational Quantum Classifier (VQC), Quantum Neural Network (QNN), Hybrid NN**, alongside Logistic Regression, SVM (RBF), Random Forest, XGBoost and MLP baselines
- Parameterised-circuit builder with ansätze: RealAmplitudes, EfficientSU2, StronglyEntangling, BasicEntangler
- Circuit viewer: build / step / live modes, block grouping, zoom, minimap, export to SVG / PNG / **QASM**
- Resource meters (qubits, depth, parameters, shots)
- Live training view: loss and metric curves, circuit parameters, parameter heatmap, loss landscape (3D), logs

### D4 · Prediction and decision support
- **Disease probability score** with an animated risk gauge and uncertainty
- **Early risk stratification**: draggable Low / Medium / High bands
- **Threshold tuning**: screening (sensitivity-first), Youden, and confirmatory presets, cost-weighted and sensitivity-constrained thresholds
- Plain-language contributing factors for clinicians
- Batch scoring of cohorts and a downloadable **patient PDF report**

### D5 · Platform, dashboard and API
- Training and evaluation **dashboard** with KPIs, experiment list and model registry
- **Results**: leaderboard (hover a row to link every chart), confusion matrices, ROC / PR, calibration, threshold explorer, bandwidth sweep, noise robustness, PDF / CSV export
- **Benchmarking (O3 / O6)**: accuracy, sensitivity, specificity, computational efficiency, generalization, and significance tests (McNemar, paired t-test, exact Wilcoxon)
- **Explainability (O5)**: PCA-aware SHAP, beeswarm, classical-vs-quantum reliance, false-negative explorer with waterfall and counterfactuals, clinician view
- **API console**: typed REST client, "try it" for `/predict`, code snippets, built-in OpenAPI explorer
- **Deliverables page**: every official component with a "Show me" link, verified by the guided demo

### Quality-of-life
- Guided demo tour covering D1 → D5 in about three minutes
- `Ctrl/⌘ K` command palette, keyboard shortcuts (`?`), glossary hover cards (52 terms)
- Light and dark themes, reduced-motion toggle, accessible chart encodings
- In-memory-only handling of tokens and API keys (never `localStorage`)
- Vercel-ready deployment

## Mapping to the problem statement

Problem Statement 26139: *Hybrid Quantum Machine Learning Platform for Early Disease Detection.*

| ID | Deliverable | Where in QuantaDx |
|---|---|---|
| D1 | Data pre-processing & feature engineering | `/data`, `/preprocess` |
| D2 | Hybrid quantum-classical architecture | `/architecture`, `/lab` |
| D3 | Quantum ML models (VQC, QSVM, QNN, PQCs) | `/models`, `/experiments/:id/train` |
| D4 | Prediction & decision support | `/predict`, `/experiments/:id/explain` |
| D5 | Software platform / prototype | `/dashboard`, `/api`, `/experiments/:id/results` |

| Objective | Addressed by |
|---|---|
| O1 Hybrid architecture for early detection | 6-step pipeline, `/architecture` |
| O2 Quantum models on high-dimensional data | PCA/MI/LASSO → 8 qubits, QSVM / VQC / QNN |
| O3 Better accuracy, sensitivity, specificity vs classical | Hybrid Q+C: 96.7% / 98.0% / 97.5% |
| O4 Scalable, interpretable, NISQ and simulator compatible | Shallow 8-qubit circuits, Qiskit / PennyLane, Docker |
| O5 Pre-processing, feature selection, explainability | D1 module, SHAP |
| O6 Benchmark on accuracy, efficiency, generalization | Results page, McNemar testing |

The component-level mapping is in [frontend/docs/TRACEABILITY.md](frontend/docs/TRACEABILITY.md) and is checked by a unit test.

## Architecture

```
React + Vite dashboard
        │  REST + WebSocket  (auth, validation)
        ▼
FastAPI  ──►  Celery + Redis (async jobs)
                    │
                    ▼
           ML inference: quantum kernel + RBF kernel
           (Qiskit · PennyLane · Aer / IBM QPU)
                    │
                    ▼
        PostgreSQL  +  MLflow model registry      (Docker · CI/CD)
```

Quantum design choices: 8 qubits, shallow ZZ-map circuits, linear-chain entanglement that maps onto an IBM heavy-hex
path with no SWAP overhead, and readout mitigation, ZNE and SPSA / COBYLA for noise. The workflow is simulator-first,
then real-QPU validation.

More detail: [frontend/docs/ARCHITECTURE.md](frontend/docs/ARCHITECTURE.md).

## Tech stack

| Layer | Technologies |
|---|---|
| Quantum | Qiskit, PennyLane, IBM QPU, Aer simulator, Qiskit Runtime, ZNE error mitigation |
| AI / ML | Python, scikit-learn, PyTorch, XGBoost, SHAP, Pandas |
| Backend | FastAPI, Celery, Redis, PostgreSQL, MLflow, Docker |
| Frontend (this repo) | React 18, TypeScript, Vite, Tailwind CSS v4, TanStack Query, Zustand, Recharts, Three.js / React Three Fiber, Framer Motion, Zod, jsPDF |
| Tooling | Vitest, ESLint, Vercel (CI/CD planned with the back-end) |

## Getting started

**Prerequisites:** Node.js ≥ 18.18 and npm.

```bash
git clone https://github.com/KoduruChandrasekhar/QuantaDx.git
cd QuantaDx/frontend
npm install
npm run dev          # http://localhost:5173  (offline, seeded mock backend)
```

Other scripts:

```bash
npm run test         # Vitest: simulator, metrics, risk, stats, mock consistency, traceability
npm run typecheck
npm run lint
npm run build        # production build to dist/
npm run preview      # serve the production build locally
```

### Configuration

Copy `frontend/.env.example` to `frontend/.env` if you want to change the defaults.

| Variable | Default | Meaning |
|---|---|---|
| `VITE_USE_MOCK` | `true` | `true` = in-browser seeded mock backend (works offline). `false` = call a real backend |
| `VITE_API_URL` | `http://localhost:8000` | FastAPI base URL |
| `VITE_WS_URL` | `ws://localhost:8000` | WebSocket base URL for the training stream |

### Deploy on Vercel

Import the repository and set **Root Directory** to `frontend`. Everything else is configured in
[`frontend/vercel.json`](frontend/vercel.json) (SPA rewrites, immutable asset caching, security headers).

## Demo walkthrough

Click **Demo** in the top bar for a guided tour (about 3 minutes): Home pipeline → D1 profile → D1 pre-processing and
qubit budget → D2 follow-one-patient → D2/D3 bandwidth sweep → D3 Model Studio → training replay → O3/O6 honest
benchmark → O5 explainability → D4 decision support → D5 live API call → Deliverables verified.
Keys: ← → navigate, space pause, Esc exit. A step-by-step manual is in [frontend/docs/USER_GUIDE.md](frontend/docs/USER_GUIDE.md).

Prefer video? Watch the [demo walkthrough](https://youtu.be/jIR71ZNFoB8).

## Repository layout

```
QuantaDx/
├── README.md                 this file
├── LICENSE
├── CONTRIBUTING.md
├── docs/                     submission and project documentation
│   ├── SIH_SUBMISSION.md     problem statement, team, links, checklist
│   ├── RESULTS.md            PoC results, method, caveats
│   ├── ETHICS_AND_COMPLIANCE.md
│   └── REFERENCES.md         19 references with DOIs
└── frontend/                 React + TypeScript web app
    ├── docs/                 PROBLEM_STATEMENT, ARCHITECTURE, USER_GUIDE, TRACEABILITY
    └── src/
        ├── pages/            one file per route
        ├── features/         page sections (data, preprocess, models, train, results, explain, predict …)
        ├── components/       UI primitives, charts, quantum visuals, effects
        ├── api/              typed client, TanStack Query hooks, WebSocket stream
        ├── mocks/            seeded in-browser mock backend
        ├── lib/              metrics, risk, stats, PDF report, quantum statevector simulator
        ├── content/          deliverables, glossary, gates, docs, demo tour
        └── store/            Zustand stores
```

## Feasibility, risks and compliance

| Dimension | Assessment |
|---|---|
| Technical | Open-source Qiskit and PennyLane; 8-qubit shallow NISQ-ready kernels; PoC done |
| Data | Public benchmark first (UCI) → external validation; hospital data via MoU |
| Hardware | Aer simulator first → real-QPU validation; noise-aware evaluation, ZNE and readout mitigation |
| Economic | Open-source stack, simulator-first PoC, no licence cost |
| Operational | Web app + Docker; clinician-friendly workflow, no quantum expertise needed |
| Regulatory | DPDP Act 2023, ICMR AI-ethics guidelines; de-identification and access control; decision support, not diagnosis |

| Risk | Level | Mitigation |
|---|---|---|
| Barren plateaus | High | Shallow hardware-efficient ansatz, local cost; kernels need no PQC training |
| NISQ noise and decoherence | High | Noise-aware Aer training, readout mitigation, ZNE, SPSA |
| Few qubits vs high-dimensional data | Medium | MI / LASSO + PCA to the qubit budget, data re-uploading |
| Kernel concentration | Medium | Bandwidth tuning + α-mix with RBF, chosen by inner CV |
| Privacy and data leakage | High | De-identification, DPDP 2023; SMOTE and scaling fit on train folds only |
| Cost of XAI on quantum models | Medium | KernelSHAP on cached states: 360k evaluations in 26 s |

See [docs/ETHICS_AND_COMPLIANCE.md](docs/ETHICS_AND_COMPLIANCE.md) for the intended-use statement and safeguards.

## Roadmap

| Phase | Focus |
|---|---|
| **1 · Now** | PoC on EHR / lab tables and UCI benchmarks; Hybrid Q+C; 5-fold CV |
| **2** | External validation; genomics (small-n, high-p); regression (severity score) |
| **3** | Clinical translation: hospital pilot, imaging / ECG, workflow integration |
| **4** | Quantum validation: real-QPU benchmarks, noise-aware evaluation, scaling |

Aligned with SDG 3 (health), SDG 9 (innovation) and SDG 10 (reduced inequalities), ABDM / Ayushman Bharat, and India's
National Quantum Mission [19].

## Current scope and limitations

Being upfront about what this repository is:

- **This repository is the QuantaDx web application (frontend).** It runs against a seeded, in-browser mock backend
  (`VITE_USE_MOCK=true`), which is what powers the live demo. The FastAPI / Celery / MLflow back-end described in the
  architecture is specified by the typed API contract in `frontend/src/types/api.ts`, and the client switches to it with
  `VITE_USE_MOCK=false`.
- **The in-app statevector simulator** (`frontend/src/lib/quantum`) is exact for ≤ 8 qubits and is used for the
  visualisations and the "follow one patient" VQC. It is not the Qiskit / PennyLane / Aer pipeline that produced the
  headline PoC numbers above.
- **Demo data vs. headline numbers.** The headline Hybrid Q+C figures come from the Python PoC pipeline. The seeded
  results shown inside the demo app are an earlier model snapshot and do not include a Hybrid Q+C row. Treat
  [docs/RESULTS.md](docs/RESULTS.md) as the source for submission figures.
- XLSX parsing and image feature extraction are simulated (CSV upload is parsed for real). WDBC demo data has ~0.8%
  injected missingness so the imputation step has something to do (labelled in the UI).
- Results are on a single public dataset. No real-QPU run, hospital data or clinical validation yet.
- Intended as **screening / decision support, not a diagnostic device.**

## Documentation index

| Document | Contents |
|---|---|
| [docs/SIH_SUBMISSION.md](docs/SIH_SUBMISSION.md) | Problem statement, team details, links, deliverable checklist |
| [docs/SIH_Submission_Deck_TraceForce_A0.pdf](docs/SIH_Submission_Deck_TraceForce_A0.pdf) | The 6-slide SIH 2026 submission deck |
| [docs/RESULTS.md](docs/RESULTS.md) | PoC method, metrics, baselines, significance, caveats |
| [docs/ETHICS_AND_COMPLIANCE.md](docs/ETHICS_AND_COMPLIANCE.md) | Intended use, DPDP / ICMR alignment, privacy safeguards |
| [docs/REFERENCES.md](docs/REFERENCES.md) | 19 references with DOIs and the design choices they motivate |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow and checks |
| [frontend/README.md](frontend/README.md) | Frontend details, environment, Vercel notes |
| [frontend/docs/PROBLEM_STATEMENT.md](frontend/docs/PROBLEM_STATEMENT.md) | Official PS text, objectives O1–O6, deliverables D1–D5 |
| [frontend/docs/TRACEABILITY.md](frontend/docs/TRACEABILITY.md) | Deliverable → page → component map |
| [frontend/docs/ARCHITECTURE.md](frontend/docs/ARCHITECTURE.md) | Frontend architecture |
| [frontend/docs/USER_GUIDE.md](frontend/docs/USER_GUIDE.md) | Ten-step user guide |
| [frontend/DECISIONS.md](frontend/DECISIONS.md) | Design and engineering decisions |

## Team

**Trace Force_A0** · Team ID 176689 · Smart India Hackathon 2026

| Name | Role |
|---|---|
| _Add team member_ | _Role_ |

_Fill in the team table before submitting. Team member names were not part of the submission PDF._

## References

Selected (full list with DOIs in [docs/REFERENCES.md](docs/REFERENCES.md)):

- Havlíček et al., *Supervised learning with quantum-enhanced feature spaces*, Nature 567 (2019)
- Thanasilp et al., *Exponential concentration in quantum kernel methods*, Nat. Commun. 15 (2024)
- Shaydulin & Wild, *Importance of kernel bandwidth in quantum machine learning*, Phys. Rev. A 106 (2022)
- McClean et al., *Barren plateaus in quantum neural network training landscapes*, Nat. Commun. 9 (2018)
- Lundberg & Lee, *A unified approach to interpreting model predictions (SHAP)*, NeurIPS (2017)
- Gupta et al., *Systematic review of QML for digital health*, npj Digit. Med. 8 (2025)

## License

Released under the [MIT License](LICENSE).
