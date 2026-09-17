import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { SummaryCards } from "@/components/results/SummaryCards";
import { RecordTable } from "@/components/results/RecordTable";
import { DownloadButton } from "@/components/results/DownloadButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fetchHeadline, fetchInvoices, fetchVendorDetail } from "@/lib/api";
import { BUCKET_LABEL, bucketOf } from "@/lib/risk";
import type { Headline, Invoice, RiskBucket, VendorDetail } from "@/types";
import { Loader2, Search, X, ArrowLeft, Sparkles } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { formatMatchReason } from "@/lib/risk";

export default function ReconciliationResults() {
  const { periodId, checkId } = useParams<{ periodId: string; checkId?: string }>();
  const navigate = useNavigate();
  const [headline, setHeadline] = useState<Headline | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [vendorSummaries, setVendorSummaries] = useState<VendorDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<RiskBucket | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    if (!periodId) return;
    try {
      const [headlineData, invoiceData] = await Promise.all([
        fetchHeadline(periodId),
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
      ].slice(0, 10); // one AI call per vendor server-side — keep this bounded
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
  };

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

  const filteredCount = (() => {
    let result = invoices;
    if (activeFilter) result = result.filter((i) => bucketOf(i.status) === activeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((i) =>
        `${i.invoice_number} ${i.vendor_name ?? ""} ${i.vendor_gstin ?? ""}`
          .toLowerCase()
          .includes(q),
      );
    }
    return result.length;
  })();

  return (
    <div>
      <Header title="Reconciliation Results">
        <DownloadButton periodId={periodId!} headline={headline} invoices={invoices} />
      </Header>

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
                {formatCurrency(Number(headline.amount_at_risk))}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Invoices at risk</div>
              <div className="text-xl font-bold">{headline.invoices_at_risk}</div>
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

          {activeFilter && (
            <Badge variant="secondary" className="gap-1 pr-1">
              Showing: {BUCKET_LABEL[activeFilter]} — {filteredCount} records
              <button
                onClick={() => setActiveFilter(null)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>

        <RecordTable
          invoices={invoices}
          filter={activeFilter}
          searchQuery={searchQuery}
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
