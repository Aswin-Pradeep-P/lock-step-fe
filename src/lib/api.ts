/**
 * Client for the Lockstep API (`../lock-step-be`), proxied at /api by vite.
 *
 * Auth is a stub: one demo user, token cached in localStorage, logged in on demand.
 * Multi-tenancy lives in the schema, not the login.
 */

import type {
  ActionProposal,
  ActionType,
  Check,
  CheckDelta,
  Client,
  EmailDraft,
  Headline,
  Invoice,
  InvoiceAction,
  InvoiceStatus,
  Period,
  Thresholds,
  VendorDetail,
  VendorRisk,
} from "@/types";

const BASE_URL = "/api/v1";
const TOKEN_KEY = "lockstep.token";

const DEMO_USER = { username: "demo@lockstep.test", password: "lockstep" };

let tokenPromise: Promise<string> | null = null;

function cachedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // private mode / blocked storage — just log in again
  }
}

async function login(): Promise<string> {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(DEMO_USER),
  });
  if (!response.ok) {
    throw new Error(
      "Could not sign in to the API. Is the backend running on :8010, and has the " +
        "seed script been run?",
    );
  }
  const { access_token } = (await response.json()) as { access_token: string };
  try {
    localStorage.setItem(TOKEN_KEY, access_token);
  } catch {
    // not fatal — we just log in again next reload
  }
  return access_token;
}

async function getToken(): Promise<string> {
  const existing = cachedToken();
  if (existing) return existing;
  tokenPromise ??= login().finally(() => {
    tokenPromise = null;
  });
  return tokenPromise;
}

function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (response.status === 401 && retry) {
    clearToken();
    return request<T>(path, init, false);
  }

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      message = body?.detail ?? body?.error ?? message;
    } catch {
      /* not JSON — keep the status line */
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// --- Clients and periods ----------------------------------------------------------

export const fetchClients = () => request<Client[]>("/clients");

export const createClient = (legal_name: string, gstin: string) =>
  request<Client>("/clients", { method: "POST", body: JSON.stringify({ legal_name, gstin }) });

export const fetchPeriods = (clientId?: string) =>
  request<Period[]>(`/periods${query({ client_id: clientId })}`);

export const createPeriod = (client_id: string, tax_period: string) =>
  request<Period>("/periods", { method: "POST", body: JSON.stringify({ client_id, tax_period }) });

export const fetchHeadline = (periodId: string) =>
  request<Headline>(`/periods/${periodId}/headline`);

export const fetchDelta = (periodId: string) =>
  request<CheckDelta>(`/periods/${periodId}/delta`);

export const fetchChecks = (periodId: string) =>
  request<Check[]>(`/periods/${periodId}/checks`);

/** Upload ledger and/or 2B and reconcile. Re-runnable as often as you like. */
export function createCheck(
  periodId: string,
  files: { ledger?: File; gstr2b?: File },
): Promise<Check> {
  const form = new FormData();
  if (files.ledger) form.append("ledger_file", files.ledger);
  if (files.gstr2b) form.append("gstr2b_file", files.gstr2b);
  return request<Check>(`/periods/${periodId}/checks`, { method: "POST", body: form });
}

// --- Invoices ---------------------------------------------------------------------

export const fetchInvoices = (
  periodId: string,
  filters: { status?: InvoiceStatus | null; vendorId?: string | null; limit?: number } = {},
) =>
  request<Invoice[]>(
    `/periods/${periodId}/invoices${query({
      status: filters.status,
      vendor_id: filters.vendorId,
      limit: filters.limit ?? 500,
    })}`,
  );

/** CSV export honours the active filters — same query string as the list. */
export async function exportInvoicesCsv(
  periodId: string,
  filters: { status?: InvoiceStatus | null; vendorId?: string | null } = {},
): Promise<Blob> {
  const token = await getToken();
  const response = await fetch(
    `${BASE_URL}/periods/${periodId}/invoices/export${query({
      status: filters.status,
      vendor_id: filters.vendorId,
    })}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error("Export failed");
  return response.blob();
}

// --- Vendors ----------------------------------------------------------------------

export const fetchVendorRisk = (periodId?: string) =>
  request<VendorRisk[]>(`/vendors${query({ period_id: periodId })}`);

export const fetchVendor = (vendorId: string, periodId?: string, withSummary = false) =>
  request<VendorDetail>(
    `/vendors/${vendorId}${query({ period_id: periodId, include_summary: withSummary })}`,
  );

// --- Actions ----------------------------------------------------------------------

export const fetchThresholds = () => request<Thresholds>("/thresholds");

export const saveThresholds = (body: Thresholds) =>
  request<Thresholds>("/thresholds", { method: "PUT", body: JSON.stringify(body) });

export const fetchProposal = (invoiceId: string) =>
  request<ActionProposal>(`/invoices/${invoiceId}/proposal`);

export const fetchActions = (invoiceId: string) =>
  request<InvoiceAction[]>(`/invoices/${invoiceId}/actions`);

export const recordAction = (
  invoiceId: string,
  action: ActionType,
  extra: { channel?: string; payload?: Record<string, unknown> } = {},
) =>
  request<InvoiceAction>(`/invoices/${invoiceId}/actions`, {
    method: "POST",
    body: JSON.stringify({ action, channel: extra.channel ?? null, payload: extra.payload ?? null }),
  });

/** Generated and stored. We never actually send — the action is logged. */
export const fetchEmailDraft = (vendorId: string, periodId: string) =>
  request<EmailDraft>(`/vendors/${vendorId}/email-draft${query({ period_id: periodId })}`);
