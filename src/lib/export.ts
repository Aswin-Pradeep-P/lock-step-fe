import type { ReconciledRecord, RiskCategory } from "@/types";
import Papa from "papaparse";

export function exportToCSV(
  records: ReconciledRecord[],
  filter: RiskCategory | null,
  filename: string
): void {
  const filtered = filter
    ? records.filter((r) => r.status === filter)
    : records;

  const data = filtered.map((r) => ({
    "Invoice No": r.invoiceNo,
    "Invoice Date": r.invoiceDate,
    "Supplier Name": r.supplierName,
    GSTIN: r.gstin,
    "Taxable Value": r.taxableValue,
    IGST: r.igst,
    CGST: r.cgst,
    SGST: r.sgst,
    "Total Tax": r.totalTax,
    Status: statusLabel(r.status),
    "Match Confidence": `${r.matchConfidence}%`,
    "AI Summary": r.aiSummary,
    Action: r.action,
  }));

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function statusLabel(status: RiskCategory): string {
  switch (status) {
    case "matched":
      return "Matched";
    case "low_risk":
      return "Low Risk";
    case "high_risk":
      return "High Risk";
    case "cannot_file":
      return "Cannot File";
  }
}
