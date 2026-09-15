import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { SummaryCards } from "@/components/results/SummaryCards";
import { RecordTable } from "@/components/results/RecordTable";
import { DownloadButton } from "@/components/results/DownloadButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchRun } from "@/lib/api";
import { statusLabel } from "@/lib/export";
import type { ReconciliationRun, RiskCategory } from "@/types";
import { Loader2, Search, X, ArrowLeft } from "lucide-react";

export default function ReconciliationResults() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<ReconciliationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<RiskCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadRun() {
      if (!runId) return;
      try {
        const data = await fetchRun(runId);
        setRun(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load reconciliation"
        );
      } finally {
        setLoading(false);
      }
    }
    loadRun();
  }, [runId]);

  const handleFilterToggle = (category: RiskCategory) => {
    setActiveFilter(activeFilter === category ? null : category);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div>
        <Header title="Reconciliation Results" />
        <div className="flex flex-col items-center justify-center p-12">
          <p className="text-destructive mb-4">{error || "Run not found."}</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const filteredCount = (() => {
    let result = run.records;
    if (activeFilter) {
      result = result.filter((r) => r.status === activeFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.invoiceNo.toLowerCase().includes(q) ||
          r.supplierName.toLowerCase().includes(q) ||
          r.gstin.toLowerCase().includes(q) ||
          r.aiSummary.toLowerCase().includes(q)
      );
    }
    return result.length;
  })();

  return (
    <div>
      <Header title="Reconciliation Results">
        <DownloadButton
          records={run.records}
          filter={activeFilter}
          runId={run.id}
        />
      </Header>

      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <div className="text-sm text-muted-foreground">
            {run.purchaseFileName} vs {run.gstr2bFileName}
          </div>
        </div>

        <SummaryCards
          run={run}
          activeFilter={activeFilter}
          onFilterToggle={handleFilterToggle}
        />

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices, suppliers, GSTIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {activeFilter && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 pr-1">
                Showing: {statusLabel(activeFilter)} — {filteredCount} records
                <button
                  onClick={() => setActiveFilter(null)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}
        </div>

        <RecordTable
          records={run.records}
          filter={activeFilter}
          searchQuery={searchQuery}
        />
      </div>
    </div>
  );
}
