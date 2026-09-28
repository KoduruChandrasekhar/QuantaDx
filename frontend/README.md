# QuantaDx — Hybrid Quantum ML for Early Disease Detection

**Hybrid quantum-classical AI for early disease detection.**

A demo-ready React frontend for a hybrid quantum-classical ML platform: data ingestion & profiling (D1), pre-processing,
hybrid architecture & data encoding (D2), quantum models and parameterised circuits (D3), prediction & decision support (D4),
and the full platform — dashboard, results, registry, API console (D5). Every page maps to the official deliverables
(see `/deliverables` — “Capabilities” — in the app and `docs/TRACEABILITY.md`).

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173  (mock backend, fully offline)
npm run test       # 39 tests: simulator, metrics, risk, stats, mock consistency, traceability
npm run typecheck
npm run lint
npm run build
```

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | FastAPI base URL |
| `VITE_WS_URL` | `ws://localhost:8000` | WebSocket base URL (training stream) |
| `VITE_USE_MOCK` | `true` | `true` = in-process seeded mock backend; `false` = real backend, no code changes |

## Highlights

- **Quantum visual system**: hand-written SVG `CircuitViewer` (build / step / live modes, block grouping, zoom, minimap, SVG/PNG/QASM export),
  draggable pseudo-3D Bloch spheres with slerp animation and mixed-state shortening, a React-Three-Fiber hero galaxy, qubit constellation,
  loss landscape, kernel heatmaps with class-sort animation and concentration diagnostics, phase-coloured state bars, shot histograms.
- **In-browser statevector simulator** (`src/lib/quantum`): exact, ≤ 8 qubits, tested. The Architecture page trains a tiny VQC
  in your browser (SPSA) for the “follow one patient” trace.
- **Honest benchmarking**: the PoC numbers from the idea deck are reproduced exactly; confusion matrices, ROC/PR, calibration and
  significance tests (McNemar, paired t, exact Wilcoxon) are computed from seeded scores; key findings come only from returned numbers.
- **Decision support**: threshold presets (screening / Youden / confirmatory), cost-weighted and sensitivity-constrained thresholds,
  draggable risk bands, animated risk gauge, uncertainty, plain-language factors, batch cohorts, patient PDF report.
- **Guided demo** (top-bar “Demo”) walks D1 → D5 in under 3 minutes and ticks every deliverable to “verified”.
- Ctrl/⌘ K command palette, glossary hover cards (52 terms), keyboard shortcuts (`?`), light/dark themes, reduced-motion support.

## Switching to the real backend

Set `VITE_USE_MOCK=false`. `src/api/client.ts` then sends the same typed requests (`src/api/endpoints.ts`) to FastAPI, and
`src/api/ws.ts` opens `WS /experiments/{id}/stream` with exponential back-off, heartbeat, Zod validation and a polling fallback.
The API contract lives in `src/types/api.ts` (mirrors the Pydantic models) and `src/mocks/openapi.ts`.

## Folder structure

```
src/
  app/          router, shell, error boundary
  pages/        one file per route
  features/     page sections (data, preprocess, architecture, models, train, results, explain, predict, lab, home, dashboard)
  components/   ui primitives, layout, charts, quantum visuals, fx (particle field, glow, tilt, reveal, burst)
  api/          client, endpoints, TanStack Query hooks, WebSocket stream
  mocks/        seeded mock backend (datasets, profiling, pipeline, results, job engine, explanations, predictions, OpenAPI)
  lib/          metrics, risk, stats, linalg, format, export, report (PDF), quantum simulator
  content/      deliverables (D1–D5 / O1–O6), glossary, gates, docs, demo tour, presets
  store/        Zustand stores (pipeline, ui, selection, demo, secrets)
docs/           PROBLEM_STATEMENT, TRACEABILITY, ARCHITECTURE, USER_GUIDE
```

## Demo script (≈ 3 min)

Click **Demo** in the top bar: Home pipeline → D1 profile → D1 pre-processing & qubit budget → D2 follow-one-patient →
D2/D3 bandwidth sweep → D3 Model Studio → training replay → O3/O6 honest benchmark → O5 explainability → D4 decision support →
D5 live API call → Deliverables verified. Keys: ← → navigate, space pause, Esc exit.

## Known limitations

- The mock backend runs in the browser; XLSX parsing and image feature extraction are simulated (CSV upload is parsed for real).
- KNN / iterative imputation, LDA and autoencoder use documented approximations in the mock preview.
- Swagger UI is replaced by a lighter built-in OpenAPI explorer; MSW by an in-process mock router (see `DECISIONS.md`).
- Initial JS is ~265 KB gzipped (budget 250 KB); Three.js, jsPDF, Papa Parse and every page are lazy-loaded.

## Deploying to Vercel

The repo is Vercel-ready (`vercel.json`): Vite framework preset, `npm run build` → `dist/`, SPA rewrites so deep links such as
`/experiments/exp-poc-001/results` work on refresh, long-term caching for hashed assets, and basic security headers.

1. Push the project to GitHub and click **Import Project** in Vercel (no settings to change), or run `npx vercel --prod` from this folder.
2. Environment variables (Project → Settings → Environment Variables) — optional, defaults come from `.env.production`:
   - `VITE_USE_MOCK=true` — the full demo backend runs in the browser, so the deployed site works with no server.
   - When the FastAPI backend is live: `VITE_USE_MOCK=false`, `VITE_API_URL=https://your-api`, `VITE_WS_URL=wss://your-api`, then redeploy.

Check the production build locally before deploying:

```bash
npm run build
npm run preview
```
