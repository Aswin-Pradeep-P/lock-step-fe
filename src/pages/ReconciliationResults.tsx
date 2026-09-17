import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { SummaryCards } from "@/components/results/SummaryCards";
import { RecordTable } from "@/components/results/RecordTable";
import { DownloadButton } from "@/components/results/DownloadButton";
import { BulkNudgeDialog, groupNudgeableVendors } from "@/components/results/BulkNudgeDialog";
import { RerunReconcileDialog } from "@/components/results/RerunReconcileDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fetchHeadline, fetchInvoices, fetchVendorDetail } from "@/lib/api";
import { BUCKET_LABEL, STATUS_LABEL, bucketOf, riskExposure } from "@/lib/risk";
import type { Headline, Invoice, InvoiceMatchStatus, RiskBucket, VendorDetail } from "@/types";
import { Loader2, Search, X, ArrowLeft, Sparkles, RefreshCw, Send } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatMatchReason } from "@/lib/risk";

const ALL_STATUSES = Object.keys(STATUS_LABEL) as InvoiceMatchStatus[];

export default function ReconciliationResults() {
  const { periodId, checkId } = useParams<{ periodId: string; checkId?: string }>();
  const navigate = useNavigate();
  const [headline, setHeadline] = useState<Headline | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendorSummaries, setVendorSummaries] = useState<VendorDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<RiskBucket | null>(null);
  const [statusFilters, setStatusFilters] = useState<Set<InvoiceMatchStatus>>(new Set());
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [rerunOpen, setRerunOpen] = useState(false);
  const [bulkNudgeOpen, setBulkNudgeOpen] = useState(false);

  const load = useCallback(async () => {
    if (!periodId) return;
    try {
      const [headlineData, invoiceData] = await Promise.all([
        fetchHeadline(periodId, { checkId }),
        fetchInvoices(periodId, { checkId }),
      ]);
      setHeadline(headlineData);
      setInvoices(invoiceData);

      const affectedVendorIds = [
        ...new Set(
          invoiceData
            .filter((i) => bucketOf(i.status) !== "safe" && i.vendor_id)
            .map((i) => i.vendor_id as string),
        ),
      ].slice(0, 10);
      const summaries = await Promise.all(
        affectedVendorIds.map((id) =>
          fetchVendorDetail(id, { periodId, includeSummary: true }).catch(() => null),
        ),
      );
      setVendorSummaries(summaries.filter((s): s is VendorDetail => s !== null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reconciliation");
    } finally {
      setLoading(false);
    }
  }, [periodId, checkId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFilterToggle = (bucket: RiskBucket) => {
    setActiveFilter(activeFilter === bucket ? null : bucket);
    // Risk bucket and status multi-select are mutually clarifying — clear statuses when bucket changes.
    setStatusFilters(new Set());
  };

  const toggleStatus = (status: InvoiceMatchStatus) => {
    setActiveFilter(null);
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const clearFilters = () => {
    setActiveFilter(null);
    setStatusFilters(new Set());
    setMinAmount("");
    setMaxAmount("");
    setSearchQuery("");
  };

  const filteredInvoices = useMemo(() => {
    let result = invoices;
    if (activeFilter) {
      result = result.filter((i) => bucketOf(i.status) === activeFilter);
    }
    if (statusFilters.size > 0) {
      result = result.filter((i) => statusFilters.has(i.status));
    }
    const min = minAmount.trim() === "" ? null : Number(minAmount);
    const max = maxAmount.trim() === "" ? null : Number(maxAmount);
    if (min !== null && !Number.isNaN(min)) {
      result = result.filter((i) => Number(i.total_tax) >= min);
    }
    if (max !== null && !Number.isNaN(max)) {
      result = result.filter((i) => Number(i.total_tax) <= max);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((i) =>
        `${i.invoice_number} ${i.vendor_name ?? ""} ${i.vendor_gstin ?? ""} ${i.match_reason ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    return result;
  }, [invoices, activeFilter, statusFilters, minAmount, maxAmount, searchQuery]);

  const hasExtraFilters =
    statusFilters.size > 0 || minAmount.trim() !== "" || maxAmount.trim() !== "" || searchQuery !== "";
  const hasAnyFilter = activeFilter !== null || hasExtraFilters;
  const nudgeableVendorCount = groupNudgeableVendors(filteredInvoices).length;
  // Same Moderate + High aggregate as SummaryCards — not the narrower BE filing set.
  const exposure = useMemo(() => riskExposure(invoices), [invoices]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !headline) {
    return (
      <div>
        <Header title="Reconciliation Results" />
        <div className="flex flex-col items-center justify-center p-12">
          <p className="text-destructive mb-4">{error || "Period not found."}</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Reconciliation Results">
        <Button
          variant="outline"
          className="gap-2"
          disabled={nudgeableVendorCount === 0}
          onClick={() => setBulkNudgeOpen(true)}
        >
          <Send className="h-4 w-4" />
          Bulk Nudge
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => setRerunOpen(true)}
        >
          <RefreshCw className="h-4 w-4" />
          Re-run
        </Button>
        <DownloadButton periodId={periodId!} headline={headline} invoices={invoices} />
      </Header>
      <RerunReconcileDialog
        open={rerunOpen}
        onOpenChange={setRerunOpen}
        periodId={periodId!}
        taxPeriod={headline.tax_period}
        onSuccess={load}
      />
      <BulkNudgeDialog
        open={bulkNudgeOpen}
        onOpenChange={setBulkNudgeOpen}
        invoices={filteredInvoices}
        periodId={periodId!}
        checkId={checkId}
        onSent={load}
      />

      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <div className="text-sm text-muted-foreground">
            Tax period {headline.tax_period.slice(0, 2)}/{headline.tax_period.slice(2)} ·{" "}
            {headline.window_open
              ? `${headline.days_to_cutoff} days to the 13th cutoff`
              : "13th cutoff has passed for this period"}{" "}
            · {headline.checks_run} check{headline.checks_run === 1 ? "" : "s"} run
          </div>
        </div>

        <Card>
          <CardContent className="p-5 flex flex-wrap items-center gap-x-8 gap-y-2">
            <div>
              <div className="text-xs text-muted-foreground">ITC at risk</div>
              <div className="text-xl font-bold text-risk-critical">
                {formatCurrency(exposure.amount)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Invoices at risk</div>
              <div className="text-xl font-bold">{exposure.count}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Invoices corrected</div>
              <div className="text-xl font-bold text-risk-low">
                {headline.invoices_corrected}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Tax credit saved</div>
              <div className="text-xl font-bold text-risk-low">
                {formatCurrency(Number(headline.tax_credit_saved))}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Vendors not filed</div>
              <div className="text-xl font-bold">{headline.vendors_not_filed}</div>
            </div>
          </CardContent>
        </Card>

        <SummaryCards
          invoices={invoices}
          activeFilter={activeFilter}
          onFilterToggle={handleFilterToggle}
        />

        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices, vendors, GSTIN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Min tax"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-28"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="number"
                inputMode="decimal"
                placeholder="Max tax"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-28"
              />
            </div>
            {hasAnyFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-xs">
                <X className="h-3.5 w-3.5" />
                Clear filters
              </Button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {ALL_STATUSES.map((status) => {
              const active = statusFilters.has(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatus(status)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {STATUS_LABEL[status]}
                </button>
              );
            })}
          </div>

          {hasAnyFilter && (
            <Badge variant="secondary" className="gap-1">
              Showing {filteredInvoices.length} of {invoices.length} invoices
              {activeFilter ? ` · ${BUCKET_LABEL[activeFilter]}` : ""}
            </Badge>
          )}
        </div>

        <RecordTable
          invoices={filteredInvoices}
          periodId={periodId!}
          onInvoiceUpdate={load}
        />

        {vendorSummaries.length > 0 && (
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-primary" />
                Vendor summaries
              </div>
              {vendorSummaries.map((v) => (
                <div key={v.id} className="border-t pt-3 first:border-t-0 first:pt-0">
                  <div className="text-sm font-medium">{v.name}</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {formatMatchReason(v.ai_summary).map((seg, i) =>
                      seg.className ? (
                        <span key={i} className={seg.className}>{seg.text}</span>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      ),
                    )}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
