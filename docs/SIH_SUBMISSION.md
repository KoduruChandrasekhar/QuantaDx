# Smart India Hackathon 2026 — Submission details

| Field | Value |
|---|---|
| Hackathon | Smart India Hackathon 2026 |
| Problem Statement ID | **26139** |
| Problem Statement Title | Hybrid Quantum Machine Learning Platform for Early Disease Detection |
| Theme | MedTech / BioTech / HealthTech |
| PS Category | Software |
| Team ID | **176689** |
| Team Name | **Trace Force_A0** |
| Project | **QuantaDx** — Hybrid Quantum–Classical AI for Early Disease Detection |

## Links

| Resource | Link |
|---|---|
| Live demo | https://quantadx.vercel.app |
| Demo video | https://youtu.be/jIR71ZNFoB8 |
| GitHub repository | https://github.com/KoduruChandrasekhar/QuantaDx |
| Submission deck | [`SIH_Submission_Deck_TraceForce_A0.pdf`](SIH_Submission_Deck_TraceForce_A0.pdf) (6 slides: solution, technical approach, feasibility, impact, research) |

## One-paragraph summary

QuantaDx fuses a classical RBF kernel with a ZZ-map quantum kernel on 8 qubits (`K = α·K_Q + (1−α)·K_RBF`) after
classical cleaning, MI / LASSO selection and PCA (30 → 8). A sensitivity-first threshold (≥95%) and SHAP explanations
turn the model into screening decision support. On UCI WDBC with 5-fold CV the hybrid kernel reaches 96.7% sensitivity,
98.0% specificity and 97.5% accuracy, missing 7 of 212 cancers against 12 for XGBoost (McNemar p = 0.004).

## Deliverables checklist (from the problem statement)

| ID | Deliverable | Status | Where |
|---|---|---|---|
| D1 | Data pre-processing & feature engineering module | Done in the app (interactive pipeline); Python PoC pipeline per deck | `/data`, `/preprocess` |
| D2 | Hybrid quantum-classical architecture | Done (system diagram, targets, encoding visualiser) | `/architecture`, `/lab` |
| D3 | Quantum ML models (VQC, QSVM, QNN, PQC) | Done (model catalog, circuit builder, training view) | `/models`, `/experiments/:id/train` |
| D4 | Prediction & decision support | Done (probability, risk tiers, threshold tuning) | `/predict` |
| D5 | Software platform / prototype | Done (dashboard, upload, results, API console) | `/dashboard`, `/api`, `/experiments/:id/results` |

| Objective | Evidence |
|---|---|
| O1 Hybrid architecture | 6-step pipeline, architecture page |
| O2 Quantum models on high-dimensional data | 30 → 8 feature reduction, QSVM / VQC / QNN |
| O3 Beat classical on accuracy, sensitivity, specificity | [RESULTS.md](RESULTS.md) |
| O4 Scalable, interpretable, NISQ-compatible | 8 qubits, shallow circuits, Qiskit / PennyLane |
| O5 Pre-processing, feature selection, explainability | D1 module + SHAP |
| O6 Benchmark on accuracy, efficiency, generalization | Results page, McNemar testing |

Full component-level traceability: [../frontend/docs/TRACEABILITY.md](../frontend/docs/TRACEABILITY.md).

## What to evaluate in the live demo (3-minute path)

1. Open the live demo and click **Demo** in the top bar.
2. Follow the tour: data profile → pre-processing and qubit budget → follow one patient → bandwidth sweep → Model Studio → training replay → benchmark → explainability → decision support → API call.
3. Open **Deliverables** to see every D1–D5 component verified, each with a "Show me" link.

## Impact (summary)

- **Patients and rural communities:** earlier risk identification, fewer missed cancers, affordable screening support, a clear risk report.
- **Doctors:** SHAP reasons on clinical features, faster triage, tunable sensitivity, a second opinion in busy OPDs.
- **Hospitals and labs:** automated screening workflow, HIS / EHR integration via REST API, scales PHC to tertiary care.
- **Government:** population NCD screening, ABDM and Ayushman Bharat alignment, supports UHC and SDG 3.
- **Researchers and industry:** open QML benchmark suite, reproducible via MLflow, a real NISQ healthcare use case, support for the National Quantum Mission [19].
- **Environmental:** paperless reports, fewer repeat scans and patient trips, shared cloud compute with no new hardware.

SDG alignment: **SDG 3**, **SDG 9**, **SDG 10**.

## Evidence boundary and honesty notes

- All reported metrics are on one public diagnostic dataset (UCI WDBC). Next steps: external validation, hospital pilot, real-QPU validation.
- The hybrid kernel is significantly better than XGBoost (p = 0.004) but **not** significantly different from Logistic Regression (p = 0.12) or SVM (p = 0.22).
- The repository contains the web application; the demo runs on a seeded in-browser mock backend. See "Current scope and limitations" in the [README](../README.md).
- QuantaDx supports screening decisions; it does not diagnose.

## Pre-submission checklist

- [ ] Team member names and roles added to the [README](../README.md#team)
- [ ] Live demo URL opens and the guided tour runs end to end
- [ ] Demo video link is public (or unlisted) and plays
- [ ] GitHub repository is public and the `main` branch contains the latest code
- [ ] `npm run test`, `npm run typecheck`, `npm run lint` and `npm run build` pass
- [ ] LICENSE reviewed and approved by the whole team
