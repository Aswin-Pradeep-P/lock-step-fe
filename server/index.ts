import cors from "cors";
import express from "express";
import type { ErrorRequestHandler } from "express";
import { createSeedRun, seedVendors } from "./lib/mock-data.js";
import { startMockTallyServer } from "./lib/mock-tally-server.js";
import { createReconcileRouter } from "./routes/reconcile.js";
import { createRunsRouter } from "./routes/runs.js";
import { createTallyRouter } from "./routes/tally.js";
import { createVendorsRouter } from "./routes/vendors.js";
import type { ReconciliationRun } from "./types.js";

const PORT = 3001;

const app = express();
const runs: ReconciliationRun[] = [createSeedRun()];

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use("/api/reconcile", createReconcileRouter(runs));
app.use("/api/runs", createRunsRouter(runs));
app.use("/api/tally", createTallyRouter());
app.use("/api/vendors", createVendorsRouter(seedVendors));

// Global error handler — returns JSON instead of HTML stack traces
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Mock API server running on port ${PORT}`);
});

startMockTallyServer();
