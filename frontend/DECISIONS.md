# Decisions

| # | Decision | Why |
|---|---|---|
| 1 | Built end to end without the Phase-0 approval stop | The user asked for the finished frontend and supplied no previous project, so `STYLE_NOTES.md` documents the design language chosen instead. |
| 2 | In-process mock router (`src/mocks/handlers.ts`) instead of MSW | Same typed request path, no service-worker setup, works offline and in tests. `VITE_USE_MOCK=false` switches to `fetch`. |
| 3 | Simulator runs on the main thread (no Web Worker / Comlink) | ≤ 8 qubits and ≤ 60-sample kernels take a few ms; QASM generation is skipped in hot paths. |
| 4 | SVG pseudo-3D Bloch spheres for grids; React Three Fiber for the hero, constellation and loss landscape | Avoids exhausting WebGL contexts with many spheres; SVG spheres stay draggable and exportable. A WebGL fallback is provided. |
| 5 | Hand-rolled UI primitives on Tailwind v4 tokens instead of the shadcn CLI | Same ergonomics, fewer dependencies, full control of theming. |
| 6 | Built-in OpenAPI explorer instead of Swagger UI | Swagger UI adds ~1 MB; the explorer renders the served spec with Try-it. |
| 7 | Custom spotlight tour instead of react-joyride | Needed route-aware steps, auto-advance and deliverable verification. |
| 8 | PoC scores placed on class-conditional normal quantiles | Reproduces the exact sensitivity/specificity at threshold 0.5, while AUC, PR-AUC, Brier, MCC and significance are computed, not typed. Tested. |
| 9 | Default deployed model = best by primary metric (Logistic Regression on WDBC) | Honesty requirement; QSVM and Hybrid NN are registered in staging and can be deployed from the registry. |
| 10 | `STATEPREP` added to `GateName` | Draws amplitude encoding as a single state-preparation block. |
| 11 | WDBC demo copy has ~0.8% injected missingness | The public dataset has none; the D1 pipeline needs something to impute. Labelled in the UI. |
| 12 | Tokens and API keys held in memory only (`useSecrets`) | Section 15: never in localStorage. |
| 13 | Extra wow layer (particle field, card glow, hero galaxy, scroll story, collapse widget) | Requested by the user; all respect reduced motion and pause off-screen. |
| 14 | Top navigation bar instead of a left sidebar; SIH references removed | Requested by the user: focus on the QuantaDx idea and brand. |
| 15 | Animations on by default (OS reduced-motion no longer forces them off); Settings toggle still available | The user wants a dynamic UI; accessibility preserved via the in-app toggle. |
| 16 | Performance budget for effects: no animated blur/filters or gradient repaints, particle field ≤ 24 fps and paused while scrolling, WebGL without MSAA at DPR ≤ 1.25 | Smooth scrolling and interaction on typical laptops. |
