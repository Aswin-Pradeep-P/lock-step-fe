/**
 * Status-filtered invoice list. Every row shows its deterministic `match_reason` —
 * the sentence is what makes a CA trust the number, so it is never hidden behind a
 * tooltip. Mismatches expand to a ledger-vs-2B diff.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatFullInr } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Invoice, InvoiceSide } from "@/types";
import { ChevronDown, ChevronRight } from "lucide-react";

export function InvoiceTable({ invoices, periodId }: { invoices: Invoice[]; periodId: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (invoices.length === 0) {
    return (
      <div className="rounded-lg border bg-card py-16 text-center text-sm text-muted-foreground">
        No invoices in this status.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="w-8" />
            <th className="px-4 py-3 font-medium">Invoice</th>
            <th className="px-4 py-3 font-medium">Vendor</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 text-right font-medium">Tax</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => {
            const isOpen = expanded === invoice.id;
            return (
              <>
                <tr
                  key={invoice.id}
                  onClick={() => setExpanded(isOpen ? null : invoice.id)}
                  className={cn(
                    "cursor-pointer border-b align-top transition-colors last:border-0 hover:bg-muted/40",
                    isOpen && "bg-muted/40",
                  )}
                >
                  <td className="py-3 pl-3 text-muted-foreground">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{invoice.invoice_number}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {invoice.is_reverse_charge && (
                        <Badge variant="outline" className="text-[10px]">
                          RCM
                        </Badge>
                      )}
                      {invoice.carried_from_period && (
                        <Badge variant="success" className="text-[10px]">
                          from {invoice.carried_from_period}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {invoice.vendor_id ? (
                      <Link
                        to={`/vendors/${invoice.vendor_id}?period=${periodId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {invoice.vendor_name ?? invoice.vendor_gstin}
                      </Link>
                    ) : (
                      (invoice.vendor_name ?? invoice.vendor_gstin ?? "—")
                    )}
                    <div className="text-xs text-muted-foreground">{invoice.vendor_gstin}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(invoice.invoice_date)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatFullInr(invoice.total_tax)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={invoice.status} />
                  </td>
                </tr>
                {isOpen && (
                  <tr key={`${invoice.id}-detail`} className="border-b bg-muted/20 last:border-0">
                    <td />
                    <td colSpan={5} className="px-4 pb-5 pt-1">
                      {invoice.match_reason && (
                        <p className="mb-4 max-w-3xl text-sm leading-relaxed">
                          {invoice.match_reason}
                        </p>
                      )}
                      <Diff invoice={invoice} />
                      <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-xs text-muted-foreground">
                        {invoice.supplier_filed_at && (
                          <Fact label="Supplier filed">
                            {formatDate(invoice.supplier_filed_at)}
                          </Fact>
                        )}
                        {invoice.itc_available === false && (
                          <Fact label="ITC not available">{invoice.itc_reason ?? "—"}</Fact>
                        )}
                        {invoice.recoverable_until && (
                          <Fact label="Sec 16(4) backstop">
                            {formatDate(invoice.recoverable_until)}
                          </Fact>
                        )}
                      </dl>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  );
}

/** Side-by-side ledger vs 2B. The entire point of the mismatch statuses. */
function Diff({ invoice }: { invoice: Invoice }) {
  if (!invoice.counterpart) {
    return (
      <p className="text-xs text-muted-foreground">
        {invoice.source === "LEDGER"
          ? "Present in your purchase ledger only — there is no GSTR-2B row to compare."
          : "Present in GSTR-2B only — there is no ledger row to compare."}
      </p>
    );
  }

  const left: InvoiceSide = {
    invoice_number: invoice.invoice_number,
    invoice_date: invoice.invoice_date,
    taxable_value: invoice.taxable_value,
    igst: invoice.igst,
    cgst: invoice.cgst,
    sgst: invoice.sgst,
    cess: invoice.cess,
    total_tax: invoice.total_tax,
    raw_data: {},
  };
  const [ledger, portal] =
    invoice.source === "LEDGER" ? [left, invoice.counterpart] : [invoice.counterpart, left];

  const rows: [string, string, string][] = [
    ["Invoice number", ledger.invoice_number, portal.invoice_number],
    ["Invoice date", formatDate(ledger.invoice_date), formatDate(portal.invoice_date)],
    [
      "Taxable value",
      formatFullInr(ledger.taxable_value),
      formatFullInr(portal.taxable_value),
    ],
    ["Total tax", formatFullInr(ledger.total_tax), formatFullInr(portal.total_tax)],
  ];

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <table className="w-full text-xs">
        <thead className="border-b bg-muted/40 text-left uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">Your books</th>
            <th className="px-3 py-2 font-medium">GSTR-2B</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b]) => (
            <tr key={label} className="border-b last:border-0">
              <td className="px-3 py-2 text-muted-foreground">{label}</td>
              <td className={cn("px-3 py-2 tabular-nums", a !== b && "bg-risk-high/10 font-medium")}>
                {a}
              </td>
              <td className={cn("px-3 py-2 tabular-nums", a !== b && "bg-risk-high/10 font-medium")}>
                {b}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
