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

    if (!Array.isArray(body.purchaseRecords)) {
      res
        .status(400)
        .json({ error: "purchaseRecords must be an array" });
      return;
    }
    if (!Array.isArray(body.gstr2bRecords)) {
      res
        .status(400)
        .json({ error: "gstr2bRecords must be an array" });
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
