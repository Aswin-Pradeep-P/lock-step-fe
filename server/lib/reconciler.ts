import { randomUUID } from "node:crypto";
import type {
  AiSuggestion,
  ActivityEntry,
  GSTR2BRecord,
  PurchaseRecord,
  ReconciledRecord,
  ReconciliationRun,
  RiskCategory,
} from "../types.js";

const TAX_EXACT_TOLERANCE = 1;
const TAX_FUZZY_TOLERANCE_PERCENT = 0.05;
const INVOICE_FUZZY_MAX_DISTANCE = 2;
const SUPPLIER_FUZZY_MAX_DISTANCE = 3;

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const matrix: number[][] = Array.from({ length: m + 1 }, () =>
    Array<number>(n + 1).fill(0),
  );

  for (let i = 0; i <= m; i++) matrix[i][0] = i;
  for (let j = 0; j <= n; j++) matrix[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[m][n];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function purchaseTotalTax(record: PurchaseRecord): number {
  return (
    (record.igstInput ?? 0) +
    (record.cgstInput ?? 0) +
    (record.sgstInput ?? 0)
  );
}

function gstr2bTotalTax(record: GSTR2BRecord): number {
  return record.igst + record.cgst + record.sgst;
}

function isItcUnavailable(record: GSTR2BRecord): boolean {
  return normalize(record.itcAvailability) === "no";
}

function taxWithinTolerance(
  purchaseTax: number,
  gstr2bTax: number,
  tolerance: number,
): boolean {
  return Math.abs(purchaseTax - gstr2bTax) <= tolerance;
}

function taxWithinPercent(
  purchaseTax: number,
  gstr2bTax: number,
  percent: number,
): boolean {
  if (purchaseTax === 0 && gstr2bTax === 0) return true;
  const baseline = Math.max(purchaseTax, gstr2bTax, 1);
  return Math.abs(purchaseTax - gstr2bTax) / baseline <= percent;
}

function supplierSimilarity(
  purchaseSupplier: string,
  gstr2bTradeName: string,
): number {
  const a = normalize(purchaseSupplier);
  const b = normalize(gstr2bTradeName);

  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;

  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length, 1);
  return Math.max(0, 1 - distance / maxLen);
}

function invoiceSimilarity(purchaseInvoice: string, gstr2bInvoice: string): number {
  const a = normalize(purchaseInvoice);
  const b = normalize(gstr2bInvoice);

  if (a === b) return 1;

  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length, 1);
  return Math.max(0, 1 - distance / maxLen);
}

function findVendorItcStatus(
  purchase: PurchaseRecord,
  gstr2bRecords: GSTR2BRecord[],
): "no" | "yes" | "unknown" {
  for (const gstr2b of gstr2bRecords) {
    if (supplierSimilarity(purchase.supplier, gstr2b.tradeName) >= 0.7) {
      return isItcUnavailable(gstr2b) ? "no" : "yes";
    }
  }
  return "unknown";
}

function generateSuggestions(
  purchase: PurchaseRecord,
  gstr2b: GSTR2BRecord | undefined,
  status: RiskCategory,
): AiSuggestion[] {
  const suggestions: AiSuggestion[] = [];
  const totalTax = purchaseTotalTax(purchase);

  if (status === "matched") {
    suggestions.push({
      id: randomUUID(),
      action: "accept_risk",
      label: "Claim ITC",
      description: `Invoice verified — safe to include ${formatInr(totalTax)} ITC in your next GSTR-3B filing.`,
      confidence: 98,
    });
    return suggestions;
  }

  if (status === "low_risk" && gstr2b) {
    const invDistance = levenshtein(
      normalize(purchase.voucherRefNo),
      normalize(gstr2b.invoiceNo),
    );
    if (invDistance > 0 && invDistance <= INVOICE_FUZZY_MAX_DISTANCE) {
      suggestions.push({
        id: randomUUID(),
        action: "auto_correct",
        label: `Auto-correct invoice number`,
        description: `Likely typo: your records show "${purchase.voucherRefNo}" but GSTR-2B shows "${gstr2b.invoiceNo}" (${invDistance} character difference). Auto-correct to match and claim ITC.`,
        confidence: 85,
      });
    }

    const taxDiff = Math.abs(totalTax - gstr2bTotalTax(gstr2b));
    if (taxDiff > TAX_EXACT_TOLERANCE) {
      suggestions.push({
        id: randomUUID(),
        action: "nudge_vendor",
        label: "Request vendor to amend",
        description: `Tax mismatch of ${formatInr(taxDiff)} — ask ${gstr2b.tradeName} to verify and amend their GSTR-1 filing.`,
        confidence: 75,
      });
    }
  }

  if (status === "high_risk") {
    suggestions.push({
      id: randomUUID(),
      action: "nudge_vendor",
      label: "Nudge vendor to file GSTR-1",
      description: `${purchase.supplier} has not reported this invoice. Send a compliance reminder — ${formatInr(totalTax)} ITC is blocked until they file.`,
      confidence: 90,
    });

    suggestions.push({
      id: randomUUID(),
      action: "escalate_urgent",
      label: "Escalate — ITC deadline approaching",
      description: `If unresolved within 180 days, you permanently lose ${formatInr(totalTax)} in ITC. Flag for senior finance review now.`,
      confidence: 80,
    });

    suggestions.push({
      id: randomUUID(),
      action: "switch_vendor",
      label: "Consider alternate vendor",
      description: `${purchase.supplier} has compliance issues. Evaluate switching to a vendor with higher GST filing compliance to avoid recurring ITC risk.`,
      confidence: 60,
    });
  }

  if (status === "cannot_file") {
    const reason = gstr2b?.reason || "ITC marked unavailable";
    suggestions.push({
      id: randomUUID(),
      action: "escalate_urgent",
      label: "Do not claim — escalate to tax advisor",
      description: `ITC of ${formatInr(totalTax)} is legally blocked: ${reason}. Consult your tax advisor before including in GSTR-3B.`,
      confidence: 95,
    });

    if (gstr2b?.reason?.includes("payment not made")) {
      suggestions.push({
        id: randomUUID(),
        action: "nudge_vendor",
        label: "Clear pending payment to unblock ITC",
        description: `Rule 37 default — ITC is blocked because payment was not made within 180 days. Clear the outstanding amount to restore eligibility.`,
        confidence: 88,
      });
    }

    suggestions.push({
      id: randomUUID(),
      action: "switch_vendor",
      label: "Flag vendor for review",
      description: `${purchase.supplier} has ITC-blocked invoices. Review vendor compliance score and consider alternate suppliers for future orders.`,
      confidence: 55,
    });
  }

  return suggestions;
}

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function buildReconciledRecord(
  purchase: PurchaseRecord,
  gstr2b: GSTR2BRecord | undefined,
  status: RiskCategory,
  confidence: number,
  aiSummary: string,
): ReconciledRecord {
  const igst = gstr2b?.igst ?? purchase.igstInput ?? 0;
  const cgst = gstr2b?.cgst ?? purchase.cgstInput ?? 0;
  const sgst = gstr2b?.sgst ?? purchase.sgstInput ?? 0;
  const taxableValue =
    gstr2b?.taxableValue ?? purchase.grossTotal - purchaseTotalTax(purchase);

  const recordId = randomUUID();
  const now = new Date().toISOString();

  const createdEntry: ActivityEntry = {
    id: randomUUID(),
    timestamp: now,
    type: "created",
    description: `Record created during reconciliation`,
    actor: "System",
  };

  return {
    id: recordId,
    invoiceNo: purchase.voucherRefNo,
    invoiceDate: purchase.voucherRefDate || purchase.date,
    supplierName: purchase.supplier,
    gstin: gstr2b?.gstin ?? "",
    taxableValue,
    igst,
    cgst,
    sgst,
    totalTax: igst + cgst + sgst,
    status,
    matchConfidence: confidence,
    aiSummary,
    aiSuggestions: generateSuggestions(purchase, gstr2b, status),
    actionStatus: "none",
    activityLog: [createdEntry],
    purchaseRecord: purchase,
    gstr2bRecord: gstr2b,
  };
}

function summarizeExactMatch(purchase: PurchaseRecord, gstr2b: GSTR2BRecord): string {
  if (isItcUnavailable(gstr2b)) {
    return `Invoice ${purchase.voucherRefNo} from ${purchase.supplier} appears in GSTR-2B but ITC is marked unavailable (${gstr2b.reason || "no reason provided"}). Cannot claim input tax credit for this invoice.`;
  }
  return `Invoice ${purchase.voucherRefNo} exactly matches GSTR-2B entry from ${gstr2b.tradeName} (${gstr2b.gstin}). Tax amounts align within ₹${TAX_EXACT_TOLERANCE}. Safe to claim ITC.`;
}

function summarizeFuzzyMatch(
  purchase: PurchaseRecord,
  gstr2b: GSTR2BRecord,
  invoiceDistance: number,
): string {
  const purchaseInvoice = purchase.voucherRefNo;
  const gstr2bInvoice = gstr2b.invoiceNo;

  if (invoiceDistance > 0) {
    return `Likely match with minor discrepancy: purchase register shows "${purchaseInvoice}" while GSTR-2B shows "${gstr2bInvoice}" (edit distance ${invoiceDistance}). Supplier ${purchase.supplier} matches ${gstr2b.tradeName}. Review before filing.`;
  }

  const purchaseTax = purchaseTotalTax(purchase);
  const gstr2bTax = gstr2bTotalTax(gstr2b);
  const diff = Math.abs(purchaseTax - gstr2bTax).toFixed(2);

  return `Supplier and invoice align loosely for ${purchaseInvoice}, but tax differs by ₹${diff} (purchase: ₹${purchaseTax.toFixed(2)}, GSTR-2B: ₹${gstr2bTax.toFixed(2)}). Verify with vendor before claiming ITC.`;
}

function summarizeMissing(
  purchase: PurchaseRecord,
  status: RiskCategory,
  vendorItc: "no" | "yes" | "unknown",
): string {
  if (status === "cannot_file") {
    return `Invoice ${purchase.voucherRefNo} from ${purchase.supplier} is not eligible for ITC. Vendor records indicate ITC availability is blocked. Do not include in GSTR-3B filing.`;
  }

  if (vendorItc === "unknown") {
    return `Invoice ${purchase.voucherRefNo} from ${purchase.supplier} (₹${purchase.grossTotal.toLocaleString("en-IN")}) has no corresponding GSTR-2B entry. Vendor may not have filed returns. ITC claim is at high risk.`;
  }

  return `Invoice ${purchase.voucherRefNo} from ${purchase.supplier} is missing from GSTR-2B despite vendor filing other invoices. Follow up with vendor to reconcile before claiming ₹${purchaseTotalTax(purchase).toLocaleString("en-IN")} in ITC.`;
}

function computeRunStats(records: ReconciledRecord[]): Pick<
  ReconciliationRun,
  | "totalRecords"
  | "matchedCount"
  | "lowRiskCount"
  | "highRiskCount"
  | "cannotFileCount"
  | "totalTaxableValue"
  | "totalTaxAtRisk"
> {
  const matchedCount = records.filter((r) => r.status === "matched").length;
  const lowRiskCount = records.filter((r) => r.status === "low_risk").length;
  const highRiskCount = records.filter((r) => r.status === "high_risk").length;
  const cannotFileCount = records.filter((r) => r.status === "cannot_file").length;

  const totalTaxableValue = records.reduce((sum, r) => sum + r.taxableValue, 0);
  const totalTaxAtRisk = records
    .filter((r) => r.status === "high_risk" || r.status === "cannot_file")
    .reduce((sum, r) => sum + r.totalTax, 0);

  return {
    totalRecords: records.length,
    matchedCount,
    lowRiskCount,
    highRiskCount,
    cannotFileCount,
    totalTaxableValue,
    totalTaxAtRisk,
  };
}

export function reconcile(
  purchaseRecords: PurchaseRecord[],
  gstr2bRecords: GSTR2BRecord[],
  purchaseFileName: string,
  gstr2bFileName: string,
): ReconciliationRun {
  const records: ReconciledRecord[] = [];
  const unmatchedGstr2b = [...gstr2bRecords];
  const unmatchedPurchases: PurchaseRecord[] = [];

  // Pass 1: Exact match on invoice number + tax within ₹1
  for (const purchase of purchaseRecords) {
    const purchaseInvoice = normalize(purchase.voucherRefNo);
    if (!purchaseInvoice) {
      unmatchedPurchases.push(purchase);
      continue;
    }
    const purchaseTax = purchaseTotalTax(purchase);

    const exactIndex = unmatchedGstr2b.findIndex((gstr2b) => {
      const gstr2bInvoice = normalize(gstr2b.invoiceNo);
      if (!gstr2bInvoice) return false;
      const invoiceMatch = gstr2bInvoice === purchaseInvoice;
      const taxMatch = taxWithinTolerance(
        purchaseTax,
        gstr2bTotalTax(gstr2b),
        TAX_EXACT_TOLERANCE,
      );
      return invoiceMatch && taxMatch;
    });

    if (exactIndex === -1) {
      unmatchedPurchases.push(purchase);
      continue;
    }

    const gstr2b = unmatchedGstr2b.splice(exactIndex, 1)[0];
    const status: RiskCategory = isItcUnavailable(gstr2b)
      ? "cannot_file"
      : "matched";
    const confidence = isItcUnavailable(gstr2b) ? 95 : 100;

    records.push(
      buildReconciledRecord(
        purchase,
        gstr2b,
        status,
        confidence,
        summarizeExactMatch(purchase, gstr2b),
      ),
    );
  }

  // Pass 2: Fuzzy match on remaining records
  const stillUnmatched: PurchaseRecord[] = [];

  for (const purchase of unmatchedPurchases) {
    const purchaseInvoiceNorm = normalize(purchase.voucherRefNo);
    if (!purchaseInvoiceNorm) {
      stillUnmatched.push(purchase);
      continue;
    }
    const purchaseTax = purchaseTotalTax(purchase);
    let bestIndex = -1;
    let bestScore = 0;
    let bestInvoiceDistance = INVOICE_FUZZY_MAX_DISTANCE + 1;

    unmatchedGstr2b.forEach((gstr2b, index) => {
      const gstr2bInvoiceNorm = normalize(gstr2b.invoiceNo);
      if (!gstr2bInvoiceNorm) return;

      const invoiceDistance = levenshtein(
        purchaseInvoiceNorm,
        gstr2bInvoiceNorm,
      );

      if (invoiceDistance > INVOICE_FUZZY_MAX_DISTANCE) return;

      const supplierScore = supplierSimilarity(purchase.supplier, gstr2b.tradeName);
      if (supplierScore < 0.5) return;

      if (
        !taxWithinPercent(
          purchaseTax,
          gstr2bTotalTax(gstr2b),
          TAX_FUZZY_TOLERANCE_PERCENT,
        )
      ) {
        return;
      }

      const invScore = invoiceSimilarity(purchase.voucherRefNo, gstr2b.invoiceNo);
      const taxDiff =
        1 -
        Math.abs(purchaseTax - gstr2bTotalTax(gstr2b)) /
          Math.max(purchaseTax, gstr2bTotalTax(gstr2b), 1);
      const score = invScore * 0.5 + supplierScore * 0.3 + taxDiff * 0.2;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
        bestInvoiceDistance = invoiceDistance;
      }
    });

    if (bestIndex === -1) {
      stillUnmatched.push(purchase);
      continue;
    }

    const gstr2b = unmatchedGstr2b.splice(bestIndex, 1)[0];
    const confidence = Math.min(90, Math.max(60, Math.round(60 + bestScore * 30)));

    const fuzzyStatus: RiskCategory = isItcUnavailable(gstr2b)
      ? "cannot_file"
      : "low_risk";
    const fuzzySummary = isItcUnavailable(gstr2b)
      ? `Invoice ${purchase.voucherRefNo} from ${purchase.supplier} fuzzy-matches GSTR-2B entry "${gstr2b.invoiceNo}" but ITC is marked unavailable (${gstr2b.reason || "no reason provided"}). Cannot claim input tax credit.`
      : summarizeFuzzyMatch(purchase, gstr2b, bestInvoiceDistance);

    records.push(
      buildReconciledRecord(
        purchase,
        gstr2b,
        fuzzyStatus,
        confidence,
        fuzzySummary,
      ),
    );
  }

  // Pass 3: Missing — unmatched purchase records
  for (const purchase of stillUnmatched) {
    const vendorItc = findVendorItcStatus(purchase, gstr2bRecords);
    const status: RiskCategory =
      vendorItc === "no" ? "cannot_file" : "high_risk";
    const confidence = vendorItc === "no" ? 85 : 70;

    records.push(
      buildReconciledRecord(
        purchase,
        undefined,
        status,
        confidence,
        summarizeMissing(purchase, status, vendorItc),
      ),
    );
  }

  const stats = computeRunStats(records);

  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    purchaseFileName,
    gstr2bFileName,
    records,
    ...stats,
  };
}

export function toRunSummary(
  run: ReconciliationRun,
): Omit<ReconciliationRun, "records"> {
  const { records: _records, ...summary } = run;
  return summary;
}
