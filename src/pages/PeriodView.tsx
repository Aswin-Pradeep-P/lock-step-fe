/**
 * One period, many checks. Upload the ledger early, then re-upload 2B as vendors file
 * and watch the gap close before the 13th — the delta between checks is the value a
 * one-shot run cannot express.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { CountdownHeadline } from "@/components/dashboard/CountdownHeadline";
import { InvoiceTable } from "@/components/results/InvoiceTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import * as api from "@/lib/api";
import {
  STATUS_META,
  STATUS_ORDER,
  formatRelativeDay,
  formatTaxPeriod,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  Check,
  CheckDelta,
  Headline,
  Invoice,
  InvoiceStatus,
} from "@/types";
import { Download, Loader2, Upload } from "lucide-react";

export default function PeriodView() {
  const { periodId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = (searchParams.get("status") as InvoiceStatus | null) ?? null;

  const [headline, setHeadline] = useState<Headline | null>(null);
  const [delta, setDelta] = useState<CheckDelta | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ledgerInput = useRef<HTMLInputElement>(null);
  const gstr2bInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [h, d, c] = await Promise.all([
      api.fetchHeadline(periodId),
      api.fetchDelta(periodId),
      api.fetchChecks(periodId),
    ]);
    setHeadline(h);
    setDelta(d);
    setChecks(c);
  }, [periodId]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [load]);

  useEffect(() => {
    api
      .fetchInvoices(periodId, { status })
      .then(setInvoices)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [periodId, status]);

  async function runCheck() {
    const ledger = ledgerInput.current?.files?.[0];
    const gstr2b = gstr2bInput.current?.files?.[0];
    if (!ledger && !gstr2b) {
      setError("Choose a purchase ledger, a GSTR-2B file, or both.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createCheck(periodId, { ledger, gstr2b });
      if (ledgerInput.current) ledgerInput.current.value = "";
      if (gstr2bInput.current) gstr2bInput.current.value = "";
      await load();
      setInvoices(await api.fetchInvoices(periodId, { status }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    const blob = await api.exportInvoicesCsv(periodId, { status });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lockstep_${headline?.tax_period ?? periodId}_${status ?? "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function setStatus(next: InvoiceStatus | null) {
    setSearchParams(next ? { status: next } : {}, { replace: true });
  }

  if (!headline) {
    return (
      <div>
        <Header title="Reconciliation" />
        <div className="space-y-6 p-6 lg:p-8">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  const counts = headline.status_counts;
  const total = STATUS_ORDER.reduce((sum, s) => sum + counts[s], 0);

  return (
    <div>
      <Header title={formatTaxPeriod(headline.tax_period)}>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </Header>

      <div className="space-y-6 p-6 lg:p-8">
        <CountdownHeadline headline={headline} delta={delta} />

        {error && (
          <div className="rounded-lg border border-risk-critical/30 bg-risk-critical/5 px-4 py-3 text-sm text-risk-critical">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Re-check this period</CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload a fresh GSTR-2B as vendors file. Each check is compared
                against the last, so you can see the gap closing.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Purchase ledger (Tally export)">
                  <input
                    ref={ledgerInput}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
                  />
                </Field>
                <Field label="GSTR-2B (portal download)">
                  <input
                    ref={gstr2bInput}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
                  />
                </Field>
              </div>
              <Button onClick={runCheck} disabled={busy}>
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {busy ? "Reconciling…" : "Run check"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Checks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {checks.map((check, index) => (
                <div
                  key={check.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className={cn(index === 0 && "font-medium")}>
                    {index === 0 ? "Latest" : `Check ${checks.length - index}`}
                  </span>
                  <span className="text-muted-foreground">
                    {formatRelativeDay(check.created_at)}
                    {check.rows_parsed ? ` · ${check.rows_parsed} rows` : ""}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <FilterChip
              active={status === null}
              onClick={() => setStatus(null)}
            >
              All {total}
            </FilterChip>
            {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
              <FilterChip
                key={s}
                active={status === s}
                onClick={() => setStatus(s)}
              >
                {STATUS_META[s].label} {counts[s]}
              </FilterChip>
            ))}
          </div>
          {status && (
            <p className="mb-3 text-sm text-muted-foreground">
              {STATUS_META[status].hint}
            </p>
          )}
          <InvoiceTable invoices={invoices} periodId={periodId} />
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
