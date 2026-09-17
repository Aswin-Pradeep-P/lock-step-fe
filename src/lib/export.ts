import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Invoice, Headline, InvoiceAction, ActionType } from "@/types";
import { STATUS_LABEL, bucketOf, riskExposure } from "@/lib/risk";
import { fetchInvoiceActions } from "@/lib/api";

const ACTION_LABEL: Record<ActionType, string> = {
  VENDOR_NOTIFIED: "Vendor nudged",
  PAYMENT_HOLD_PROPOSED: "Escalated",
  PAYMENT_HOLD_APPLIED: "Hold applied",
  PAYMENT_RELEASED: "Payment released",
  MARKED_RESOLVED: "Resolved",
  IGNORED: "Flagged for review",
};

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
}

export async function exportToPDF(
  headline: Headline,
  invoices: Invoice[],
): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape" });

  // Title
  doc.setFontSize(18);
  doc.text("GST Reconciliation Report", 14, 20);
  doc.setFontSize(10);
  doc.text(
    `Tax Period: ${headline.tax_period.slice(0, 2)}/${headline.tax_period.slice(2)}  |  Generated: ${new Date().toLocaleDateString("en-IN")}`,
    14,
    28,
  );

  const exposure = riskExposure(invoices);

  // Summary — Moderate + High, same aggregate as the results headline / cards
  doc.setFontSize(12);
  doc.text("Summary", 14, 38);
  autoTable(doc, {
    startY: 42,
    head: [["ITC at Risk", "Invoices at Risk", "Vendors Not Filed", "Total Invoices"]],
    body: [[
      fmtCurrency(exposure.amount),
      String(exposure.count),
      String(headline.vendors_not_filed),
      String(invoices.length),
    ]],
    theme: "grid",
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14 },
  });

  // Invoice table
  const tableY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
  doc.setFontSize(12);
  doc.text("Invoice Details", 14, tableY + 10);

  autoTable(doc, {
    startY: tableY + 14,
    head: [["Invoice No", "Date", "Vendor", "GSTIN", "Taxable Value", "Total Tax", "Status", "Reason"]],
    body: invoices.map((inv) => [
      inv.invoice_number,
      inv.invoice_date ?? "—",
      inv.vendor_name ?? "—",
      inv.vendor_gstin ?? "—",
      fmtCurrency(Number(inv.taxable_value ?? 0)),
      fmtCurrency(Number(inv.total_tax)),
      STATUS_LABEL[inv.status],
      inv.match_reason ?? "",
    ]),
    theme: "striped",
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 14 },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      7: { cellWidth: 60 },
    },
  });

  // Activity log — fetch actions for non-safe invoices
  const nonSafe = invoices.filter((i) => bucketOf(i.status) !== "safe").slice(0, 30);
  const allActions: (InvoiceAction & { invoice_number: string })[] = [];

  const results = await Promise.allSettled(
    nonSafe.map((inv) =>
      fetchInvoiceActions(inv.id).then((acts) =>
        acts.map((a) => ({ ...a, invoice_number: inv.invoice_number })),
      ),
    ),
  );
  for (const r of results) {
    if (r.status === "fulfilled") allActions.push(...r.value);
  }

  if (allActions.length > 0) {
    allActions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    doc.addPage("landscape");
    doc.setFontSize(12);
    doc.text("Actions Taken", 14, 20);

    autoTable(doc, {
      startY: 24,
      head: [["Invoice", "Action", "Channel", "Date"]],
      body: allActions.map((a) => [
        a.invoice_number,
        ACTION_LABEL[a.action] ?? a.action,
        a.channel ?? "—",
        new Date(a.created_at).toLocaleString("en-IN"),
      ]),
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14 },
      styles: { fontSize: 8 },
    });
  }

  doc.save(`GST_Reconciliation_${headline.tax_period}.pdf`);
}
