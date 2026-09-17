import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { TrendChart } from "@/components/dashboard/TrendChart";
import { RecentRuns, type RunRow } from "@/components/dashboard/RecentRuns";
import { VendorRiskList } from "@/components/dashboard/VendorRiskList";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchClients,
  fetchPeriods,
  fetchHeadline,
  fetchChecks,
  fetchVendorRisk,
  fetchInvoices,
} from "@/lib/api";
import type { Headline, Period, VendorRisk } from "@/types";
import { FilePlus } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [headlines, setHeadlines] = useState<{ period: Period; headline: Headline }[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [vendors, setVendors] = useState<VendorRisk[]>([]);
  const [hasClient, setHasClient] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const clients = await fetchClients();
        if (clients.length === 0) {
          setHasClient(false);
          return;
        }
        setHasClient(true);
        const clientId = clients[0].id;

        const periods = await fetchPeriods(clientId);
        const headlineResults = await Promise.all(
          periods.map(async (period) => ({ period, headline: await fetchHeadline(period.id) })),
        );
        setHeadlines(headlineResults);

        const checksByPeriod = await Promise.all(
          periods.map((period) => fetchChecks(period.id)),
        );
        const allRuns: Omit<RunRow, "invoices">[] = periods.flatMap((period, idx) =>
          checksByPeriod[idx]
            .filter((check) => check.status === "COMPLETED")
            .map((check) => ({ period, check })),
        );
        allRuns.sort(
          (a, b) => new Date(b.check.created_at).getTime() - new Date(a.check.created_at).getTime(),
        );
        const recent = allRuns.slice(0, 5);
        const withInvoices: RunRow[] = await Promise.all(
          recent.map(async (run) => ({
            ...run,
            invoices: await fetchInvoices(run.period.id, { checkId: run.check.id }),
          })),
        );
        setRuns(withInvoices);

        setVendors(await fetchVendorRisk());
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div>
        <Header title="Dashboard">
          <Button disabled className="gap-2">
            <FilePlus className="h-4 w-4" />
            New Reconciliation
          </Button>
        </Header>
        <div className="space-y-6 p-6 lg:p-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Dashboard">
        <Button onClick={() => navigate("/reconcile")} className="gap-2">
          <FilePlus className="h-4 w-4" />
          New Reconciliation
        </Button>
      </Header>

      <div className="space-y-6 p-6 lg:p-8">
        {!hasClient ? (
          <div className="rounded-lg border-2 border-dashed p-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              No reconciliations yet — start your first one.
            </p>
            <Button onClick={() => navigate("/reconcile")} className="gap-2">
              <FilePlus className="h-4 w-4" />
              New Reconciliation
            </Button>
          </div>
        ) : (
          <>
            <StatsCards headlines={headlines} vendors={vendors} />
            <TrendChart headlines={headlines} />
            <div className="grid gap-6 lg:grid-cols-2">
              <RecentRuns runs={runs} />
              <VendorRiskList vendors={vendors} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
