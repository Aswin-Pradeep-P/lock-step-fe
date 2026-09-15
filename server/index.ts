import cors from "cors";
import express from "express";
import { createSeedRun, seedVendors } from "./lib/mock-data.js";
import { createReconcileRouter } from "./routes/reconcile.js";
import { createRunsRouter } from "./routes/runs.js";
import { createVendorsRouter } from "./routes/vendors.js";
import type { ReconciliationRun } from "./types.js";

const PORT = 3001;

const app = express();
const runs: ReconciliationRun[] = [createSeedRun()];

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use("/api/reconcile", createReconcileRouter(runs));
app.use("/api/runs", createRunsRouter(runs));
app.use("/api/vendors", createVendorsRouter(seedVendors));

app.listen(PORT, () => {
  console.log(`Mock API server running on port ${PORT}`);
});
