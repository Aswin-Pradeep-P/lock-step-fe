// Mirrors lock-step-be's schemas (lockstep/schemas/*.py) — every field here has a
// named counterpart there. Nothing in this file is invented on the frontend.

export type InvoiceMatchStatus =
  | "PENDING"
  | "EXACT_MATCH"
  | "CLERICAL_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "MISSING_IN_GSTR2B"
  | "MISSING_IN_LEDGER"
  | "DUPLICATE"
  | "ITC_INELIGIBLE"
  | "RESOLVED"
  | "CARRIED_FORWARD";

export type InvoiceSource = "LEDGER" | "GSTR2B" | "BOTH";

export type ActionType =
  | "VENDOR_NOTIFIED"
  | "PAYMENT_HOLD_PROPOSED"
  | "PAYMENT_HOLD_APPLIED"
  | "PAYMENT_RELEASED"
  | "MARKED_RESOLVED"
  | "IGNORED";

export interface Client {
  id: string;
  legal_name: string;
  gstin: string;
}

export interface Period {
  id: string;
  client_id: string;
  tax_period: string; // MMYYYY
  cutoff_date: string;
  gstr2b_date: string;
  filing_due: string;
  from_date: string | null;
  to_date: string | null;
  created_at: string;
}

export interface Check {
  id: string;
  period_id: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  rows_parsed: number | null;
  error_message: string | null;
  column_mapping: Record<string, unknown> | null;
  created_at: string;
}

export interface Headline {
  period_id: string;
  tax_period: string;
  cutoff_date: string;
  days_to_cutoff: number;
  window_open: boolean;
  amount_at_risk: string;
  invoices_at_risk: number;
  vendors_not_filed: number;
  checks_run: number;
  status_counts: Record<InvoiceMatchStatus, number>;
  invoices_corrected: number;
  tax_credit_saved: string;
}

export interface InvoiceSide {
  invoice_number: string;
  invoice_date: string | null;
  taxable_value: string | null;
  igst: string;
  cgst: string;
  sgst: string;
  cess: string;
  total_tax: string;
  raw_data: Record<string, unknown>;
}

export interface Invoice {
  id: string;
  period_id: string;
  check_id: string;
  vendor_id: string | null;
  vendor_gstin: string | null;
  vendor_name: string | null;
  source: InvoiceSource;
  status: InvoiceMatchStatus;
  match_reason: string | null;
  carried_from_period: string | null;

  invoice_number: string;
  invoice_date: string | null;
  taxable_value: string | null;
  igst: string;
  cgst: string;
  sgst: string;
  cess: string;
  total_tax: string;

  itc_available: boolean | null;
  itc_reason: string | null;
  is_reverse_charge: boolean;
  supplier_filed_at: string | null;
  description: string | null;

  // Populated lazily by GET /invoices/{id}/insight and cached from then on.
  ai_reason_md: string | null;
  ai_suggestion_md: string | null;

  recoverable_until: string | null;
  days_to_recover: number | null;
  window_open: boolean | null;

  counterpart: InvoiceSide | null;
  created_at: string;
}

export interface VendorRisk {
  vendor_id: string;
  name: string;
  gstin: string | null;
  gstin_verified: boolean;
  contact_email: string | null;
  periods_observed: number;
  on_time_rate: number | null;
  avg_days_past_cutoff: number | null;
  typical_filing_day: number | null;
  filed_this_period: boolean;
  predicted_late: boolean;
  missing_invoice_count: number;
  current_exposure: string;
  risk_band: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
}

export interface FilingHistoryEntry {
  tax_period: string;
  gstr1_filed: boolean | null;
  gstr1_filed_at: string | null;
  days_past_cutoff: number | null;
  invoice_count: number | null;
}

export interface VendorDetail {
  id: string;
  name: string;
  gstin: string | null;
  gstin_verified: boolean;
  contact_email: string | null;
  contact_phone: string | null;
  risk: VendorRisk | null;
  filing_history: FilingHistoryEntry[];
  ai_summary: string | null;
}

export interface VendorEmailDraft {
  to: string | null;
  subject: string;
  body: string;
  invoice_numbers: string[];
  can_send: boolean;
  reason: string | null;
}

export interface ActionProposal {
  invoice_id: string;
  amount_at_risk: string;
  proposed_action: ActionType;
  requires_approval: boolean;
  rationale: string;
}

export interface InvoiceAction {
  id: string;
  invoice_id: string;
  action: ActionType;
  channel: string | null;
  auto_proposed: boolean;
  approved_by: string | null;
  approved_at: string | null;
  amount_at_risk: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

/** AI-authored reason + suggested next step for one invoice — generated on first
 * request and cached server-side, never a replacement for the deterministic
 * `match_reason`. Markdown; render it, don't inject it as HTML. */
export interface InvoiceInsight {
  reason_md: string;
  suggestion_md: string;
}

// --- Frontend-only derived concepts (not backend fields) ------------------------
// The 3-bucket view the product spec asks for: Safe / Moderate Risk / High Risk.
// Computed client-side from `status` — see src/lib/risk.ts.
export type RiskBucket = "safe" | "moderate" | "high";
