import type { Headline, Invoice, InvoiceMatchStatus, RiskBucket } from "@/types";

const SAFE_STATUSES: InvoiceMatchStatus[] = ["EXACT_MATCH", "RESOLVED", "CARRIED_FORWARD"];
const MODERATE_STATUSES: InvoiceMatchStatus[] = ["CLERICAL_MISMATCH", "AMOUNT_MISMATCH"];

/** Safe / Moderate Risk / High Risk — the three buckets the product shows. Reason
 * text (see `reasonTag`), not a fourth bucket, distinguishes *why* something in
 * High Risk is there: not filed yet (still recoverable) vs. blocked by law
 * (Sec 17(5)) regardless of filing. */
export function bucketOf(status: InvoiceMatchStatus): RiskBucket {
  if (SAFE_STATUSES.includes(status)) return "safe";
  if (MODERATE_STATUSES.includes(status)) return "moderate";
  return "high";
}

export const BUCKET_LABEL: Record<RiskBucket, string> = {
  safe: "Safe",
  moderate: "Moderate Risk",
  high: "High Risk",
};

export const STATUS_LABEL: Record<InvoiceMatchStatus, string> = {
  PENDING: "Pending",
  EXACT_MATCH: "Matched",
  CLERICAL_MISMATCH: "Clerical Mismatch",
  AMOUNT_MISMATCH: "Amount Mismatch",
  MISSING_IN_GSTR2B: "Not Filed by Vendor",
  MISSING_IN_LEDGER: "Missing from Books",
  DUPLICATE: "Duplicate",
  ITC_INELIGIBLE: "Blocked by Law",
  RESOLVED: "Resolved",
  CARRIED_FORWARD: "Filed Late — Now Claimed",
};

/** A one-line reason tag for a High Risk invoice — what a CA needs to know before
 * deciding whether to nudge the vendor or escalate to a tax advisor instead. */
export function reasonTag(invoice: Invoice): string | null {
  switch (invoice.status) {
    case "MISSING_IN_GSTR2B":
      return invoice.match_reason?.includes("Sec 17(5)")
        ? "Not filed — and category may be ineligible regardless"
        : "Vendor has not filed";
    case "ITC_INELIGIBLE":
      return invoice.itc_reason || "Blocked by law — do not nudge the vendor";
    case "MISSING_IN_LEDGER":
      return "In GSTR-2B but not in your books";
    case "DUPLICATE":
      return "Duplicate entry in your ledger";
    default:
      return null;
  }
}

/** "Matched" for dashboard purposes = safe + moderate (a typo or an amount
 * mismatch is still a resolvable discrepancy, not a hole in the return) —
 * mirrors how the reconciliation-results filter buckets are defined. */
export function matchRatePercent(headline: Headline): number {
  const counts = headline.status_counts;
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (total === 0) return 0;
  const matched = (Object.keys(counts) as InvoiceMatchStatus[])
    .filter((status) => bucketOf(status) !== "high")
    .reduce((sum, status) => sum + counts[status], 0);
  return Math.round((matched / total) * 100);
}

/** Whether nudging the vendor makes sense for this invoice at all — an
 * ITC_INELIGIBLE invoice is blocked by law regardless of whether the vendor files,
 * so asking them to "file GSTR-1" is not just unhelpful, it's misleading. */
export function canNudgeVendor(invoice: Invoice): boolean {
  return invoice.status === "MISSING_IN_GSTR2B" || invoice.status === "AMOUNT_MISMATCH";
}

/** Highlight key terms in match_reason text — amounts, section references, invoice
 * numbers, percentages. Returns an array of string | {text, className} segments. */
export interface RichSegment {
  text: string;
  className?: string;
}

export function formatMatchReason(text: string | null | undefined): RichSegment[] {
  if (!text) return [];

  const patterns: { regex: RegExp; className: string }[] = [
    { regex: /(?:Rs\.?\s*|₹\s*|INR\s*)[\d,]+(?:\.\d{1,2})?/gi, className: "font-semibold text-foreground" },
    { regex: /\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?%/g, className: "font-semibold text-foreground" },
    { regex: /Sec(?:tion)?\s*\d+(?:\(\d+\))?(?:\([a-z]\))?/gi, className: "font-mono text-xs bg-muted px-1 rounded" },
    { regex: /[A-Z]{3,5}[-/]\d{4,}[-/]?\d*/g, className: "font-mono" },
    { regex: /\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]{2}/g, className: "font-mono text-xs" },
  ];

  const segments: RichSegment[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let earliest: { index: number; length: number; className: string } | null = null;

    for (const { regex, className } of patterns) {
      regex.lastIndex = 0;
      const match = regex.exec(remaining);
      if (match && (!earliest || match.index < earliest.index)) {
        earliest = { index: match.index, length: match[0].length, className };
      }
    }

    if (!earliest) {
      segments.push({ text: remaining });
      break;
    }

    if (earliest.index > 0) {
      segments.push({ text: remaining.slice(0, earliest.index) });
    }
    segments.push({
      text: remaining.slice(earliest.index, earliest.index + earliest.length),
      className: earliest.className,
    });
    remaining = remaining.slice(earliest.index + earliest.length);
  }

  return segments;
}
