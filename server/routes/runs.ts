import { Router } from "express";
import { toRunSummary } from "../lib/reconciler.js";
import type { ReconciliationRun } from "../types.js";

export function createRunsRouter(runs: ReconciliationRun[]): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(runs.map(toRunSummary));
  });

  router.get("/:runId", (req, res) => {
    const run = runs.find((entry) => entry.id === req.params.runId);

    if (!run) {
      res.status(404).json({ error: "Reconciliation run not found" });
      return;
    }

    res.json(run);
  });

  return router;
}
