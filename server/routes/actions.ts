import { Router } from "express";
import { randomUUID } from "node:crypto";
import type {
  ActionStatus,
  ActivityEntry,
  NudgeChannel,
  ReconciliationRun,
} from "../types.js";

export function createActionsRouter(runs: ReconciliationRun[]): Router {
  const router = Router();

  function findRecord(runId: string, recordId: string) {
    const run = runs.find((r) => r.id === runId);
    if (!run) return { run: null, record: null };
    const record = run.records.find((r) => r.id === recordId);
    return { run, record: record ?? null };
  }

  router.patch("/:runId/records/:recordId/action", (req, res) => {
    const { runId, recordId } = req.params;
    const { action } = req.body as { action?: ActionStatus };

    if (!action || !["flagged", "escalated", "resolved"].includes(action)) {
      res
        .status(400)
        .json({ error: "Invalid action. Must be: flagged, escalated, or resolved" });
      return;
    }

    const { record } = findRecord(runId, recordId);
    if (!record) {
      res.status(404).json({ error: "Record not found" });
      return;
    }

    record.actionStatus = action;

    const descriptions: Record<string, string> = {
      flagged: `Record flagged for review — payment release paused pending verification`,
      escalated: `Record escalated to senior finance — requires immediate attention`,
      resolved: `Record marked as resolved — cleared for payment processing`,
    };

    const entry: ActivityEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type: action,
      description: descriptions[action],
      actor: "Priya Sharma (Finance)",
    };

    record.activityLog.push(entry);
    res.json(record);
  });

  router.post("/:runId/records/:recordId/nudge", (req, res) => {
    const { runId, recordId } = req.params;
    const { channel, message } = req.body as {
      channel?: NudgeChannel;
      message?: string;
    };

    if (!channel || !["email", "whatsapp"].includes(channel)) {
      res.status(400).json({ error: "Invalid channel. Must be: email or whatsapp" });
      return;
    }
    if (!message || message.trim().length === 0) {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const { record } = findRecord(runId, recordId);
    if (!record) {
      res.status(404).json({ error: "Record not found" });
      return;
    }

    const channelLabel = channel === "email" ? "Email" : "WhatsApp";

    const entry: ActivityEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type: "nudge_sent",
      description: `Vendor nudge sent via ${channelLabel} to ${record.supplierName}`,
      actor: "Priya Sharma (Finance)",
      channel,
    };

    record.activityLog.push(entry);
    res.json(record);
  });

  return router;
}
