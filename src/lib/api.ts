import { clearToken, getToken } from "@/lib/auth";
import type {
  ActionProposal,
  ActionType,
  Check,
  Client,
  Headline,
  Invoice,
  InvoiceAction,
  Period,
  VendorDetail,
  VendorEmailDraft,
  VendorRisk,
} from "@/types";

const BASE_URL = "/api/v1";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      ...(options?.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (response.status === 401) {
    clearToken();
    window.location.assign("/login");
    throw new ApiError("Not authenticated", 401);
  }

  if (!response.ok) {
    let message = `API error: ${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.detail) message = typeof body.detail === "string" ? body.detail : message;
    } catch {
      // response wasn't JSON — keep default message
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;

  try {
    return await response.json();
  } catch {
    throw new ApiError("Invalid JSON response from server", response.status);
  }
}

// --- Clients & periods ------------------------------------------------------------

export async function fetchClients(): Promise<Client[]> {
  return request<Client[]>("/clients");
}

export async function createClient(legal_name: string, gstin: string): Promise<Client> {
  return request<Client>("/clients", {
    method: "POST",
    body: JSON.stringify({ legal_name, gstin }),
  });
}

export async function fetchPeriods(clientId: string): Promise<Period[]> {
  return request<Period[]>(`/periods?client_id=${clientId}`);
}

export async function createPeriod(clientId: string, taxPeriod: string): Promise<Period> {
  return request<Period>("/periods", {
    method: "POST",
    body: JSON.stringify({ client_id: clientId, tax_period: taxPeriod }),
  });
}

export async function fetchHeadline(periodId: string): Promise<Headline> {
  return request<Headline>(`/periods/${periodId}/headline`);
}

export async function fetchChecks(periodId: string): Promise<Check[]> {
  return request<Check[]>(`/periods/${periodId}/checks`);
}

export async function createCheck(
  periodId: string,
  ledgerFile: File | null,
  gstr2bFile: File | null,
): Promise<Check> {
  const form = new FormData();
  if (ledgerFile) form.set("ledger_file", ledgerFile);
  if (gstr2bFile) form.set("gstr2b_file", gstr2bFile);
  return request<Check>(`/periods/${periodId}/checks`, { method: "POST", body: form });
}

/** GSTR-2B side is fetched by the client's GSTIN instead of uploaded.
 * Backend stub returns inconsistent or corrected GSTN-shaped data — see
 * lockstep.services.mock_gstr2b. */
export async function createCheckFromGsp(
  periodId: string,
  ledgerFile: File | null,
  variant: "inconsistent" | "corrected" = "corrected",
): Promise<Check> {
  const form = new FormData();
  if (ledgerFile) form.set("ledger_file", ledgerFile);
  return request<Check>(
    `/periods/${periodId}/checks/gsp-fetch?variant=${variant}`,
    { method: "POST", body: form },
  );
}

export type Gstr2bVariant = "inconsistent" | "corrected";

export interface Gstr2bDefects {
  exact: number;
  clerical: number;
  amount_mismatch: number;
  missing_in_2b: number;
  itc_ineligible: number;
}

export interface Gstr2bFetchResult {
  variant: Gstr2bVariant;
  count: number;
  defects: Gstr2bDefects;
  data: Record<string, unknown>;
}

export async function fetchGstr2b(variant: Gstr2bVariant): Promise<Gstr2bFetchResult> {
  return request<Gstr2bFetchResult>(`/gstr2b?variant=${variant}`);
}

export function flattenGstr2bPreview(
  payload: Record<string, unknown>,
): Record<string, unknown>[] {
  const envelope = payload as {
    data?: { data?: { data?: { docdata?: { b2b?: GstnB2BParty[] } } } };
  };
  const vendors = envelope.data?.data?.data?.docdata?.b2b ?? [];
  const rows: Record<string, unknown>[] = [];
  for (const vendor of vendors) {
    for (const inv of vendor.inv ?? []) {
      rows.push({
        gstin: vendor.ctin ?? "",
        tradeName: vendor.trdnm ?? "",
        invoiceNo: inv.inum ?? "",
        invoiceDate: inv.dt ?? "",
        taxableValue: inv.txval ?? 0,
        igst: inv.igst ?? 0,
        cgst: inv.cgst ?? 0,
        sgst: inv.sgst ?? 0,
        itc: inv.itcavl ?? "",
        reason: inv.rsn ?? "",
      });
    }
  }
  return rows;
}

interface GstnB2BParty {
  ctin?: string;
  trdnm?: string;
  inv?: Array<{
    inum?: string;
    dt?: string;
    txval?: number;
    igst?: number;
    cgst?: number;
    sgst?: number;
    itcavl?: string;
    rsn?: string;
  }>;
}

// --- Invoices -----------------------------------------------------------------------

export async function fetchInvoices(
  periodId: string,
  opts?: { checkId?: string; status?: string; vendorId?: string },
): Promise<Invoice[]> {
  const params = new URLSearchParams();
  if (opts?.checkId) params.set("check_id", opts.checkId);
  if (opts?.status) params.set("status", opts.status);
  if (opts?.vendorId) params.set("vendor_id", opts.vendorId);
  params.set("limit", "5000");
  return request<Invoice[]>(`/periods/${periodId}/invoices?${params.toString()}`);
}

export function invoiceExportUrl(periodId: string, status?: string): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  return `${BASE_URL}/periods/${periodId}/invoices/export?${params.toString()}`;
}

export async function downloadInvoiceExport(periodId: string, status?: string): Promise<void> {
  const token = getToken();
  const response = await fetch(invoiceExportUrl(periodId, status), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new ApiError("Export failed", response.status);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `period_${periodId}_invoices.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// --- Vendors --------------------------------------------------------------------

export async function fetchVendorRisk(periodId?: string): Promise<VendorRisk[]> {
  const suffix = periodId ? `?period_id=${periodId}` : "";
  return request<VendorRisk[]>(`/vendors${suffix}`);
}

export async function fetchVendorDetail(
  vendorId: string,
  opts?: { periodId?: string; includeSummary?: boolean },
): Promise<VendorDetail> {
  const params = new URLSearchParams();
  if (opts?.periodId) params.set("period_id", opts.periodId);
  if (opts?.includeSummary) params.set("include_summary", "true");
  return request<VendorDetail>(`/vendors/${vendorId}?${params.toString()}`);
}

export async function fetchVendorEmailDraft(
  vendorId: string,
  periodId: string,
): Promise<VendorEmailDraft> {
  return request<VendorEmailDraft>(
    `/vendors/${vendorId}/email-draft?period_id=${periodId}`,
  );
}

// --- Actions --------------------------------------------------------------------

export async function fetchActionProposal(invoiceId: string): Promise<ActionProposal> {
  return request<ActionProposal>(`/invoices/${invoiceId}/proposal`);
}

export async function fetchInvoiceActions(invoiceId: string): Promise<InvoiceAction[]> {
  return request<InvoiceAction[]>(`/invoices/${invoiceId}/actions`);
}

export async function createInvoiceAction(
  invoiceId: string,
  action: ActionType,
  channel?: string,
  payload?: Record<string, unknown>,
): Promise<InvoiceAction> {
  return request<InvoiceAction>(`/invoices/${invoiceId}/actions`, {
    method: "POST",
    body: JSON.stringify({ action, channel, payload }),
  });
}

export { ApiError };
