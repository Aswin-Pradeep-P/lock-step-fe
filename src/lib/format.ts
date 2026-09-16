/**
 * Money and dates for an Indian accountant.
 *
 * Amounts arrive as decimal strings. `formatInr` is for headline figures (₹4.2L);
 * tables use `formatFullInr` so nothing is hidden behind shorthand.
 */

import type { InvoiceStatus, RiskBand } from "@/types";

export function toNumber(amount: string | number | null | undefined): number {
  if (amount === null || amount === undefined) return 0;
  return typeof amount === "number" ? amount : Number.parseFloat(amount) || 0;
}

/** Headline shorthand: ₹4.2L, ₹1.2Cr. */
export function formatInr(amount: string | number | null | undefined): string {
  const value = toNumber(amount);
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  return `${sign}₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(abs)}`;
}

/** Full rupees with Indian grouping, for tables. */
export function formatFullInr(amount: string | number | null | undefined): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(toNumber(amount));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** '082026' -> 'August 2026'. Display only; always send the MMYYYY form. */
export function formatTaxPeriod(taxPeriod: string): string {
  if (!/^\d{6}$/.test(taxPeriod)) return taxPeriod;
  const month = Number.parseInt(taxPeriod.slice(0, 2), 10);
  return `${MONTHS[month - 1] ?? taxPeriod.slice(0, 2)} ${taxPeriod.slice(2)}`;
}

export function formatTaxPeriodShort(taxPeriod: string): string {
  if (!/^\d{6}$/.test(taxPeriod)) return taxPeriod;
  const month = Number.parseInt(taxPeriod.slice(0, 2), 10);
  return `${(MONTHS[month - 1] ?? "").slice(0, 3)} ${taxPeriod.slice(4)}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatRelativeDay(value: string | null | undefined): string {
  if (!value) return "—";
  const days = Math.round((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function ordinal(day: number): string {
  const suffix =
    day % 10 === 1 && day !== 11 ? "st"
    : day % 10 === 2 && day !== 12 ? "nd"
    : day % 10 === 3 && day !== 13 ? "rd"
    : "th";
  return `${day}${suffix}`;
}

/** Copy for the ten statuses. Order is the order the invoice list filters in. */
export const STATUS_META: Record<
  InvoiceStatus,
  { label: string; hint: string; tone: "good" | "warn" | "bad" | "neutral" }
> = {
  MISSING_IN_GSTR2B: {
    label: "Not filed by supplier",
    hint: "In your ledger, absent from GSTR-2B. Actionable before the 13th.",
    tone: "bad",
  },
  AMOUNT_MISMATCH: {
    label: "Amount mismatch",
    hint: "Invoice number matches, tax differs.",
    tone: "bad",
  },
  CLERICAL_MISMATCH: {
    label: "Clerical mismatch",
    hint: "Same vendor and tax; the invoice number is typed differently.",
    tone: "warn",
  },
  ITC_INELIGIBLE: {
    label: "ITC not available",
    hint: "In GSTR-2B, but the portal says the credit cannot be claimed.",
    tone: "warn",
  },
  MISSING_IN_LEDGER: {
    label: "Not in your books",
    hint: "In GSTR-2B only — an unrecorded purchase, or someone else's invoice.",
    tone: "warn",
  },
  DUPLICATE: {
    label: "Duplicate",
    hint: "Same invoice number twice for one vendor this period.",
    tone: "warn",
  },
  CARRIED_FORWARD: {
    label: "Carried forward",
    hint: "Was stuck last period and has now appeared. Credit recovered.",
    tone: "good",
  },
  EXACT_MATCH: {
    label: "Matched",
    hint: "Agrees with GSTR-2B on vendor, number, date and tax.",
    tone: "good",
  },
  RESOLVED: { label: "Resolved", hint: "Closed out with the supplier.", tone: "good" },
  PENDING: { label: "Pending", hint: "Not yet matched.", tone: "neutral" },
};

export const STATUS_ORDER: InvoiceStatus[] = [
  "MISSING_IN_GSTR2B",
  "AMOUNT_MISMATCH",
  "CLERICAL_MISMATCH",
  "ITC_INELIGIBLE",
  "MISSING_IN_LEDGER",
  "DUPLICATE",
  "CARRIED_FORWARD",
  "EXACT_MATCH",
  "RESOLVED",
  "PENDING",
];

export const RISK_META: Record<RiskBand, { label: string; tone: string }> = {
  HIGH: { label: "High risk", tone: "text-risk-critical bg-risk-critical/10" },
  MEDIUM: { label: "Medium risk", tone: "text-risk-high bg-risk-high/10" },
  LOW: { label: "Low risk", tone: "text-risk-low bg-risk-low/10" },
  UNKNOWN: { label: "No history", tone: "text-muted-foreground bg-muted" },
};

/** "late in 3 of the last 4 periods, typically around the 17th" */
export function describeFiling(vendor: {
  periods_observed: number;
  on_time_rate: number | null;
  typical_filing_day: number | null;
}): string {
  if (!vendor.periods_observed || vendor.on_time_rate === null) {
    return "No filing history observed yet.";
  }
  const late = vendor.periods_observed - Math.round(vendor.on_time_rate * vendor.periods_observed);
  const base =
    late === 0
      ? `Filed on time in all ${vendor.periods_observed} periods observed`
      : `Filed late in ${late} of the last ${vendor.periods_observed} periods`;
  return vendor.typical_filing_day
    ? `${base}, typically around the ${ordinal(vendor.typical_filing_day)}.`
    : `${base}.`;
}
