# Frontend architecture

- **Routing**: React Router v6, lazy route chunks, a per-route error boundary, animated transitions (`src/app`).
- **Server state**: TanStack Query (`src/api/hooks.ts`) over typed endpoints (`src/api/endpoints.ts`) → `request()` in `src/api/client.ts` (mock router, or `fetch` with timeout, one retry and `X-API-Key`).
- **Streaming**: `src/api/ws.ts` (WebSocket, back-off, heartbeat, Zod validation, polling fallback) → `useExperimentStream` batches events to ≤ 10 renders per second.
- **Client state**: Zustand stores: `pipeline` (persisted to sessionStorage), `ui`, `selection` (linked charts), `demo`, `secrets` (memory only).
- **Mock backend**: `src/mocks`. Seeded datasets (mulberry32), real profiling and pre-processing (PCA via Jacobi eigen-decomposition), the PoC results reproduced exactly, a Celery-like job engine emitting `TrainingEvent`s, SHAP-style explanations, predictions and an OpenAPI document.
- **Quantum core**: `src/lib/quantum`. Statevector simulator; circuit builders (angle, ZZ, Pauli, IQP, amplitude × RealAmplitudes, EfficientSU2, StronglyEntangling, BasicEntangler); fidelity kernels; a tiny in-browser VQC trained with SPSA.
- **Visuals**: `src/components/quantum` (CircuitViewer, Bloch, StateViews, Kernel, EncodingVisualizer, HybridArchitecture, NoiseVisualizer, R3F scenes), `src/components/charts` (Recharts with a shared theme), `src/components/fx` (particle field, glow, tilt, reveal, burst).
