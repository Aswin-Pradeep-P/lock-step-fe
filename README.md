# Lockstep — GST Reconciliation

Lockstep helps businesses reconcile their purchase registers (Tally exports) against
GSTR-2B government portal data, categorizing mismatches into risk buckets so you can
act before filing.

This is the frontend only. It talks to the real backend in `../lock-step-be` — there
is no mock API here. Start that first (see its own README; `.\start.ps1` on Windows,
or `docker compose up -d && uv run alembic upgrade head && uv run python -m lockstep.seed
&& uv run uvicorn lockstep.main:app --port 8010` on Linux/macOS), then this frontend.

## Prerequisites

- **Node.js** v20+
- **npm** v9+
- The backend running on `:8010` (this app proxies `/api` to it — see `vite.config.ts`)

## Getting Started

```bash
npm install
npm run dev
```

Frontend runs at [http://localhost:5173](http://localhost:5173). Sign in with the
backend's demo account: `demo@lockstep.test` / `lockstep`.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | TypeScript check + production build |
| `npm run lint` | oxlint |
| `npm run preview` | Preview production build |

## Tech Stack

- React 19, Vite, TypeScript
- Tailwind CSS, shadcn/ui
- React Router v7
- PapaParse (CSV preview only — the real parse happens server-side)
- Recharts, Lucide Icons

## Project Structure

```
src/
  components/       # UI components (layout, dashboard, reconciliation, results)
  pages/            # Login, Dashboard, NewReconciliation, ReconciliationResults
  lib/              # API client (lib/api.ts), auth, risk-bucket mapping, utilities
  types/            # TypeScript interfaces mirroring lock-step-be's schemas
```
