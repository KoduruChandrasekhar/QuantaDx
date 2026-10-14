# Contributing to QuantaDx

Thanks for your interest. QuantaDx is a research prototype built for Smart India Hackathon 2026 (Team Trace Force_A0).

## Setup

```bash
cd frontend
npm install
npm run dev
```

Requires Node.js ≥ 18.18.

## Before you open a pull request

Run all four checks from `frontend/`:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Guidelines

- Keep changes focused. One feature or fix per pull request.
- Follow the existing structure: pages in `src/pages`, page sections in `src/features`, shared pieces in `src/components`.
- Keep API types in `src/types/api.ts` in sync with the backend contract and the mock in `src/mocks`.
- New deliverable-facing components should be listed in `src/content/deliverables.ts` (a test checks traceability).
- Do not commit secrets, real patient data or `.env` files. Use `.env.example` for new variables.
- Be honest in results: report negative and non-significant outcomes, and label simulated or mock data as such.
- Read [`frontend/DECISIONS.md`](frontend/DECISIONS.md) and [`frontend/STYLE_NOTES.md`](frontend/STYLE_NOTES.md) before large design changes.

## Reporting issues

Open a GitHub issue with steps to reproduce, expected vs actual behaviour, and your browser and OS.
