/**
 * The screen that earns the pitch: filing history across periods, current exposure,
 * the per-vendor AI summary, the invoices, and the action log.
 *
 * The history chart is the thing no reconciliation tool can draw — it needs
 * `vendor_filing_history`, which is why that table is core rather than an extra.
 */

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { InvoiceTable } from "@/components/results/InvoiceTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import * as api from "@/lib/api";
import {
  RISK_META,
  formatDate,
  formatInr,
  formatTaxPeriodShort,
  ordinal,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  ActionProposal,
  EmailDraft,
  Invoice,
  VendorDetail,
} from "@/types";
import { Mail, Sparkles } from "lucide-react";

export default function VendorView() {
  const { vendorId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const periodId = searchParams.get("period") ?? undefined;

  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [proposal, setProposal] = useState<ActionProposal | null>(null);
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    api.fetchVendor(vendorId, periodId, true).then(setVendor);
    if (periodId) {
      api.fetchInvoices(periodId, { vendorId }).then(setInvoices);
    }
  }, [vendorId, periodId]);

  useEffect(() => {
    const atRisk = invoices.find((i) => i.status === "MISSING_IN_GSTR2B");
    if (atRisk)
      api
        .fetchProposal(atRisk.id)
        .then(setProposal)
        .catch(() => setProposal(null));
  }, [invoices]);

  async function openDraft() {
    if (!periodId) return;
    setDraft(await api.fetchEmailDraft(vendorId, periodId));
  }

  async function logNotification() {
    const atRisk = invoices.filter((i) => i.status === "MISSING_IN_GSTR2B");
    await Promise.all(
      atRisk.map((i) =>
        api.recordAction(i.id, "VENDOR_NOTIFIED", {
          channel: "email",
          payload: { subject: draft?.subject },
        }),
      ),
    );
    setNotified(true);
    setDraft(null);
  }

  if (!vendor) {
    return (
      <div>
        <Header title="Vendor" />
        <div className="space-y-6 p-6 lg:p-8">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  const risk = vendor.risk;

  return (
    <div>
      <Header title={vendor.name} />

      <div className="min-w-0 space-y-6 overflow-x-hidden p-6 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {vendor.gstin}
              {vendor.contact_email ? ` · ${vendor.contact_email}` : ""}
            </p>
          </div>
          {risk && (
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-semibold",
                  RISK_META[risk.risk_band].tone,
                )}
              >
                {RISK_META[risk.risk_band].label}
              </span>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums">
                  {formatInr(risk.current_exposure)}
                </div>
                <div className="text-xs text-muted-foreground">
                  at risk this period
                </div>
              </div>
            </div>
          )}
        </div>

        {vendor.ai_summary && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex gap-3 p-5">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-sm leading-relaxed">{vendor.ai_summary}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  One summary per vendor, written from the filing facts.
                  Statuses and amounts are computed by rules, not by the model.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Filing history</CardTitle>
              <p className="text-sm text-muted-foreground">
                Days relative to the 13th cutoff. Below the line is on time.
              </p>
            </CardHeader>
            <CardContent>
              <FilingChart history={vendor.filing_history} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Act before the 13th</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {risk && (
                <dl className="space-y-2 text-sm">
                  <Row label="On-time rate">
                    {risk.on_time_rate === null
                      ? "—"
                      : `${Math.round(risk.on_time_rate * 100)}%`}
                  </Row>
                  <Row label="Usually files">
                    {risk.typical_filing_day
                      ? ordinal(risk.typical_filing_day)
                      : "—"}
                  </Row>
                  <Row label="Filed this period">
                    {risk.filed_this_period ? "Yes" : "Not yet"}
                  </Row>
                  <Row label="Invoices missing">
                    {risk.missing_invoice_count}
                  </Row>
                </dl>
              )}

              {proposal && (
                <div className="rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
                  <span className="font-semibold">
                    {proposal.proposed_action.replace(/_/g, " ")}
                  </span>
                  {proposal.requires_approval && (
                    <span className="ml-2 rounded-full bg-risk-critical/10 px-2 py-0.5 font-semibold text-risk-critical">
                      needs approval
                    </span>
                  )}
                  <p className="mt-1 text-muted-foreground">
                    {proposal.rationale}
                  </p>
                </div>
              )}

              <Button
                className="w-full"
                onClick={openDraft}
                disabled={!periodId}
              >
                <Mail className="mr-2 h-4 w-4" />
                Draft vendor notice
              </Button>
              {notified && (
                <p className="text-xs text-risk-low">
                  Logged to the audit trail. Nothing was actually sent.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {invoices.length > 0 && (
          <div>
            <h2 className="mb-3 text-lg font-semibold">Invoices this period</h2>
            <InvoiceTable invoices={invoices} periodId={periodId ?? ""} />
          </div>
        )}

        <Dialog
          open={draft !== null}
          onOpenChange={(open) => !open && setDraft(null)}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{draft?.subject}</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              To: {draft?.to ?? "—"}
            </p>
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-4 text-sm">
              {draft?.body}
            </pre>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft(null)}>
                Close
              </Button>
              <Button onClick={logNotification}>Log as notified</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </div>
  );
}

/**
 * Inline bars, not a chart library: one value per period, centred on the cutoff.
 * Red above the line is a late filing; green below it is on time.
 */
function FilingChart({ history }: { history: VendorDetail["filing_history"] }) {
  const ordered = [...history].reverse();
  if (ordered.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No history yet.
      </p>
    );
  }
  const scale = Math.max(
    10,
    ...ordered.map((h) => Math.abs(h.days_past_cutoff ?? 10)),
  );

  return (
    <div className="flex items-stretch gap-3">
      {ordered.map((entry) => {
        const days = entry.days_past_cutoff;
        const late = days !== null && days > 0;
        const height =
          days === null ? 100 : Math.max(8, (Math.abs(days) / scale) * 50);
        return (
          <div
            key={entry.tax_period}
            className="flex flex-1 flex-col items-center gap-1"
          >
            <div className="relative flex h-32 w-full items-center justify-center">
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
              <div
                className={cn(
                  "absolute w-6 rounded-sm",
                  days === null
                    ? "bg-risk-critical/30"
                    : late
                      ? "bg-risk-critical"
                      : "bg-risk-low",
                )}
                style={
                  days === null
                    ? { top: "10%", height: "40%" }
                    : late
                      ? { bottom: "50%", height: `${height}%` }
                      : { top: "50%", height: `${height}%` }
                }
              />
            </div>
            <span className="text-[10px] font-medium text-muted-foreground">
              {formatTaxPeriodShort(entry.tax_period)}
            </span>
            <span
              className={cn(
                "text-[10px] tabular-nums",
                days === null
                  ? "text-risk-critical"
                  : late
                    ? "text-risk-critical"
                    : "text-risk-low",
              )}
              title={
                entry.gstr1_filed_at
                  ? formatDate(entry.gstr1_filed_at)
                  : "Not filed"
              }
            >
              {days === null
                ? "not filed"
                : days > 0
                  ? `+${days}d`
                  : `${days}d`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
