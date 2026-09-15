import type { ReconciledRecord, ReconciliationRun, RiskCategory } from "@/types";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
    Action: r.actionStatus,
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

function formatCurrencyPdf(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function exportToPDF(run: ReconciliationRun): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const primary = [30, 64, 175] as const;
  const dark = [15, 23, 42] as const;

  // Header bar
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageWidth, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Lockstep — GST Reconciliation Report", 14, 14);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    pageWidth - 14,
    14,
    { align: "right" },
  );

  // Run info
  let y = 30;
  doc.setTextColor(...dark);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Reconciliation Summary", 14, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const runDate = new Date(run.createdAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const infoRows = [
    ["Run Date:", runDate],
    ["Purchase File:", run.purchaseFileName],
    ["GSTR-2B File:", run.gstr2bFileName],
    ["Total Records:", String(run.totalRecords)],
  ];
  for (const [label, value] of infoRows) {
    doc.setFont("helvetica", "bold");
    doc.text(label, 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 50, y);
    y += 5;
  }

  // Summary stats boxes
  y += 3;
  const boxWidth = 60;
  const boxGap = 6;
  const boxes = [
    { label: "Matched", count: run.matchedCount, color: [34, 197, 94] as const },
    { label: "Low Risk", count: run.lowRiskCount, color: [34, 197, 94] as const },
    { label: "High Risk", count: run.highRiskCount, color: [245, 158, 11] as const },
    { label: "Cannot File", count: run.cannotFileCount, color: [239, 68, 68] as const },
  ];
  const matchRate =
    run.totalRecords > 0
      ? Math.round(
          ((run.matchedCount + run.lowRiskCount) / run.totalRecords) * 100,
        )
      : 0;

  for (let i = 0; i < boxes.length; i++) {
    const bx = 14 + i * (boxWidth + boxGap);
    doc.setFillColor(...boxes[i].color);
    doc.roundedRect(bx, y, boxWidth, 16, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(String(boxes[i].count), bx + 5, y + 7);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(boxes[i].label, bx + 5, y + 12);
  }

  // Match rate + ITC at risk
  const rateX = 14 + 4 * (boxWidth + boxGap) + 4;
  doc.setTextColor(...dark);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`Match Rate: ${matchRate}%`, rateX, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`ITC at Risk: ${formatCurrencyPdf(run.totalTaxAtRisk)}`, rateX, y + 12);

  y += 24;

  // Records table
  doc.setTextColor(...dark);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Invoice Details", 14, y);
  y += 3;

  const tableData = run.records.map((r) => [
    r.invoiceNo,
    r.invoiceDate,
    r.supplierName.length > 28 ? r.supplierName.slice(0, 26) + "…" : r.supplierName,
    r.gstin || "—",
    formatCurrencyPdf(r.taxableValue),
    formatCurrencyPdf(r.totalTax),
    statusLabel(r.status),
    `${r.matchConfidence}%`,
    r.actionStatus === "none" ? "—" : r.actionStatus,
  ]);

  autoTable(doc, {
    startY: y,
    head: [
      [
        "Invoice No",
        "Date",
        "Supplier",
        "GSTIN",
        "Taxable Value",
        "Total Tax",
        "Status",
        "Confidence",
        "Action",
      ],
    ],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [...primary] as [number, number, number],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: "bold",
      halign: "center",
    },
    bodyStyles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 28 },
      1: { cellWidth: 22 },
      2: { cellWidth: 52 },
      3: { cellWidth: 32, fontSize: 6 },
      4: { halign: "right", cellWidth: 26 },
      5: { halign: "right", cellWidth: 22 },
      6: { halign: "center", cellWidth: 22 },
      7: { halign: "center", cellWidth: 20 },
      8: { halign: "center", cellWidth: 20 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 6) {
        const val = String(data.cell.raw);
        if (val === "High Risk") {
          data.cell.styles.textColor = [245, 158, 11];
          data.cell.styles.fontStyle = "bold";
        } else if (val === "Cannot File") {
          data.cell.styles.textColor = [239, 68, 68];
          data.cell.styles.fontStyle = "bold";
        } else if (val === "Matched") {
          data.cell.styles.textColor = [34, 197, 94];
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Lockstep GST Reconciliation — Confidential — Page ${i} of ${pageCount}`,
      pageWidth / 2,
      ph - 6,
      { align: "center" },
    );
  }

  doc.save(`lockstep-report-${run.id.slice(0, 8)}.pdf`);
}
