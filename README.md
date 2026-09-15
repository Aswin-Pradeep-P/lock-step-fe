# Lockstep — GST Reconciliation

Lockstep helps businesses reconcile their purchase registers (Tally exports) against GSTR-2B government portal data, categorizing mismatches into risk buckets so you can act before filing.

## Prerequisites

- **Node.js** v18+
- **npm** v9+

## Getting Started

```bash
# Install dependencies
npm install

# Start both frontend and mock API server
npm run dev
```

This runs:
- **Frontend** at [http://localhost:5173](http://localhost:5173)
- **Mock API** at [http://localhost:3001](http://localhost:3001) (proxied through Vite)

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start frontend + mock server concurrently |
| `npm run dev:client` | Start Vite dev server only |
| `npm run dev:server` | Start Express mock server only |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build |

## Tech Stack

- React 18, Vite, TypeScript
- Tailwind CSS, shadcn/ui
- React Router v6, Zustand
- SheetJS (xlsx), PapaParse
- Recharts, Lucide Icons
- Express (mock API server)

## Project Structure

```
src/
  components/       # UI components (layout, dashboard, reconciliation, results)
  pages/            # Dashboard, NewReconciliation, ReconciliationResults
  lib/              # API client, file parser, CSV export, utilities
  store/            # Zustand state management
  types/            # TypeScript interfaces
server/
  routes/           # Express API routes (reconcile, runs, vendors)
  lib/              # Reconciliation engine, seed data
```
