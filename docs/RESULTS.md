# Proof-of-concept results

Source: the Smart India Hackathon 2026 submission deck (Trace Force_A0). These figures come from the Python PoC
pipeline, not from the in-browser demo backend.

## Setup

| Item | Value |
|---|---|
| Dataset | UCI Breast Cancer Wisconsin (Diagnostic), n = 569, 212 malignant [14] |
| Features | 30 → MI / LASSO selection → PCA to 8 components (93% explained variance) |
| Qubits | 8 |
| Encoding | ZZ feature map, shallow circuit, linear-chain entanglement |
| Model | Hybrid kernel SVM, `K = α·K_Q + (1−α)·K_RBF`; α and kernel bandwidth chosen by inner CV |
| Decision rule | Threshold set on inner folds for ≥95% sensitivity |
| Validation | 5-fold cross-validation |
| Leakage control | Scaling and SMOTE fit on training folds only |
| Baselines | Logistic Regression, SVM (RBF), XGBoost, QSVM (quantum kernel only) |

## Headline result — Hybrid Q+C kernel

| Metric | Value |
|---|---|
| Sensitivity | 96.7% |
| Specificity | 98.0% |
| Accuracy | 97.5% |
| Missed cancers | 7 of 212 |

## Missed cancers (of 212, lower is better)

| Model | Missed cancers |
|---|---|
| Logistic Regression | 14 |
| SVM (RBF) | 10 |
| XGBoost | 12 |
| QSVM (quantum) | 10 |
| **Hybrid Q+C kernel** | **7** |

## Statistical significance

McNemar test on paired cross-validation predictions:

| Comparison | p-value | Conclusion |
|---|---|---|
| Hybrid Q+C vs XGBoost | 0.004 | Significant |
| Hybrid Q+C vs Logistic Regression | 0.12 | Not significant |
| Hybrid Q+C vs SVM (RBF) | 0.22 | Not significant |

## Computational efficiency

KernelSHAP on cached quantum states: 360,000 evaluations in 26 seconds.

## Design findings behind the numbers

- A raw quantum kernel suffers from **kernel concentration**: off-diagonal values collapse as qubits grow [11].
  Bandwidth tuning [10] and mixing with an RBF kernel recover accuracy.
- Deep random circuits are prone to **barren plateaus** [5]. The kernel approach needs no PQC training, and the
  variational models (VQC / QNN) use shallow hardware-efficient ansätze with local cost functions.
- Published evidence of a consistent QML advantage in health is still limited [15], which is why every claim here is
  paired with rigorous classical baselines and a significance test.

## Caveats (please read)

1. Single public dataset. No external validation yet, so generalization is unproven.
2. Simulator results only. No real-QPU run yet; noise is handled via Aer noise models, readout mitigation, ZNE and SPSA in the plan.
3. The hybrid kernel's advantage is statistically significant only against XGBoost.
4. The ≥95% sensitivity target is set on inner folds, so reported sensitivity is an out-of-fold estimate.
5. The seeded results inside the demo web app are an earlier model snapshot (Logistic Regression ranked top, no Hybrid Q+C row). Use this document for the submission figures.

## Next validation steps

1. External validation on held-out public cohorts (Heart Disease, Pima Diabetes, Parkinson's Voice, CKD).
2. Genomics (small-n, high-p) and regression (severity score).
3. Hospital pilot under MoU with de-identified data.
4. Real-QPU benchmarks with noise-aware evaluation.

Reference numbers refer to [REFERENCES.md](REFERENCES.md).
