/**
 * The API contract. Mirrors `../lock-step-be/src/lockstep/schemas/` — change one and
 * change the other.
 *
 * Money arrives as a decimal STRING (the backend stores NUMERIC(14,2)). Never parse it
 * into a number before summing; format it at the edge with the helpers in lib/format.
 */

export type InvoiceStatus =
  | "PENDING"
  | "EXACT_MATCH"
  | "CLERICAL_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "MISSING_IN_GSTR2B" // the supplier hasn't filed — the one that matters
  | "MISSING_IN_LEDGER"
  | "DUPLICATE"
  | "ITC_INELIGIBLE"
  | "RESOLVED"
  | "CARRIED_FORWARD";

export type InvoiceSource = "LEDGER" | "GSTR2B" | "BOTH";

export type RiskBand = "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";

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
  cutoff_date: string; // the 13th
  gstr2b_date: string; // the 14th
  filing_due: string; // the 20th
  created_at: string;
}

/** The only numbers that go above the fold. */
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
  status_counts: Record<InvoiceStatus, number>;
}

/** What changed between the last two checks — a one-shot run cannot express this. */
export interface CheckDelta {
  has_previous: boolean;
  since?: string;
  invoices_resolved?: number;
  amount_recovered?: number;
  still_missing?: number;
  still_at_risk?: number;
}

export interface Check {
  id: string;
  period_id: string;
  status: string;
  rows_parsed: number | null;
  error_message: string | null;
  column_mapping: Record<string, unknown> | null;
  created_at: string;
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
  raw_data: Record<string, string>;
}

export interface Invoice {
  id: string;
  period_id: string;
  check_id: string;
  vendor_id: string | null;
  vendor_gstin: string | null;
  vendor_name: string | null;
  source: InvoiceSource;
  status: InvoiceStatus;
  /** A human sentence written by rules, not by a model. Always show it. */
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
  recoverable_until: string | null;

  /** The other side of a matched pair, for the side-by-side diff. */
  counterpart: InvoiceSide | null;
  created_at: string;
}

export interface VendorRisk {
  vendor_id: string;
  name: string;
  gstin: string;
  contact_email: string | null;
  periods_observed: number;
  on_time_rate: number | null;
  avg_days_past_cutoff: number | null;
  typical_filing_day: number | null;
  filed_this_period: boolean;
  predicted_late: boolean;
  missing_invoice_count: number;
  current_exposure: string;
  risk_band: RiskBand;
}

export interface FilingHistoryEntry {
  tax_period: string;
  gstr1_filed: boolean | null;
  gstr1_filed_at: string | null;
  /** Negative means filed before the 13th. */
  days_past_cutoff: number | null;
  invoice_count: number | null;
}

export interface VendorDetail {
  id: string;
  name: string;
  gstin: string;
  contact_email: string | null;
  contact_phone: string | null;
  risk: VendorRisk | null;
  filing_history: FilingHistoryEntry[];
  ai_summary: string | null;
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

export interface ActionProposal {
  invoice_id: string;
  amount_at_risk: string;
  proposed_action: ActionType;
  requires_approval: boolean;
  rationale: string;
}

/** Auto-notify always; propose a hold above X; require approval above Y. */
export interface Thresholds {
  hold_proposal_threshold: string;
  approval_threshold: string;
}

export interface EmailDraft {
  to: string | null;
  subject: string;
  body: string;
  invoice_numbers: string[];
}
