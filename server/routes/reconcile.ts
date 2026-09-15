import { Router } from "express";
import { reconcile } from "../lib/reconciler.js";
import type { ReconcileRequest, ReconciliationRun } from "../types.js";

export function createReconcileRouter(
  runs: ReconciliationRun[],
): Router {
  const router = Router();

  router.post("/", (req, res) => {
    const body = req.body as ReconcileRequest;

    if (
      !body.purchaseRecords ||
      !body.gstr2bRecords ||
      !body.purchaseFileName ||
      !body.gstr2bFileName
    ) {
      res.status(400).json({
        error:
          "Missing required fields: purchaseRecords, gstr2bRecords, purchaseFileName, gstr2bFileName",
      });
      return;
    }

    const run = reconcile(
      body.purchaseRecords,
      body.gstr2bRecords,
      body.purchaseFileName,
      body.gstr2bFileName,
    );

    runs.unshift(run);
    res.status(201).json(run);
  });

  return router;
}
