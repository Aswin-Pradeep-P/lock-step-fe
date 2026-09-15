import type {
  PurchaseRecord,
  GSTR2BRecord,
  ReconciliationRun,
  ReconciliationRunSummary,
  Vendor,
} from "@/types";

const BASE_URL = "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${url}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchRuns(): Promise<ReconciliationRunSummary[]> {
  return request<ReconciliationRunSummary[]>("/runs");
}

export async function fetchRun(runId: string): Promise<ReconciliationRun> {
  return request<ReconciliationRun>(`/runs/${runId}`);
}

export async function submitReconciliation(data: {
  purchaseRecords: PurchaseRecord[];
  gstr2bRecords: GSTR2BRecord[];
  purchaseFileName: string;
  gstr2bFileName: string;
}): Promise<ReconciliationRun> {
  return request<ReconciliationRun>("/reconcile", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchVendors(): Promise<Vendor[]> {
  return request<Vendor[]>("/vendors");
}
