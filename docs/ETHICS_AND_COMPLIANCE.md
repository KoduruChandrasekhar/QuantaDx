# Ethics, privacy and regulatory notes

## Intended use

QuantaDx is **screening and decision-support software** to help clinicians prioritise patients for further
evaluation. It does **not** diagnose disease, replace clinical judgement, or recommend treatment. Every output is a
calibrated risk estimate with an explanation, to be reviewed by a qualified clinician.

It is a research prototype, not a certified medical device. It has not been clinically validated.

## Frameworks we align with

| Framework | How the design responds |
|---|---|
| Digital Personal Data Protection Act, 2023 (India) | Consent-first ingestion, data minimisation, de-identification, access control |
| ICMR ethical guidelines for AI in healthcare | Human oversight, explainability, transparency about limitations, bias checks |
| ABDM / Ayushman Bharat | REST/API-based integration path with HIS / EHR systems (planned) |

This is a statement of design intent, not legal advice or a compliance certification.

## Privacy safeguards in the product

- **Nothing is sent until you confirm** an upload.
- **PHI checks** flag identifier-like columns, which can be dropped before use.
- **No leakage**: scaling and SMOTE are fit on training folds only.
- **Secrets in memory only**: API keys and tokens are never stored in `localStorage`.
- **Public benchmark data first**: the PoC uses only the public UCI WDBC dataset. Hospital data would come under a
  formal MoU with de-identification.

## Responsible-AI measures

- **Explainability:** SHAP on clinical features, a false-negative explorer, counterfactuals and a plain-language clinician view.
- **Sensitivity-first operating point:** favours fewer missed positives in screening; thresholds are visible and tunable, and the trade-off is shown.
- **Honest benchmarking:** significance tests are reported even when the result is "not significant".
- **Calibration and uncertainty** are displayed with each score.
- **Evidence boundary** is stated in the UI and docs: public dataset only, no real-QPU or hospital validation yet.

## Known risks and open items

| Risk | Status |
|---|---|
| Dataset bias / limited population coverage | Open — external validation and subgroup analysis planned (roadmap phase 2) |
| Automation bias (over-trusting the score) | Mitigated by decision-support framing, uncertainty display, clinician view |
| Regulatory pathway for clinical use (CDSCO software-as-medical-device) | Not started — required before any clinical deployment |
| Security hardening of the backend (auth, audit logs, encryption at rest) | Planned with the FastAPI / PostgreSQL deployment |

## Reporting a concern

Open an issue on the GitHub repository, or contact the team through the SIH submission contact.
