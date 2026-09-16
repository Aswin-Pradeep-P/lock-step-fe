/**
 * The original dashboard layout, kept: header with the New Reconciliation button,
 * four stat cards, the trend chart, then recent reconciliations beside vendor risk.
 *
 * The one addition is the countdown strip at the top. The deadline is the reason this
 * product exists, so it leads — but as a line above the dashboard, not instead of it.
 */

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { CountdownHeadline } from "@/components/dashboard/CountdownHeadline";
import { RecentRuns } from "@/components/dashboard/RecentRuns";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { TrendChart, type TrendPoint } from "@/components/dashboard/TrendChart";
import { VendorRiskList } from "@/components/dashboard/VendorRiskList";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import * as api from "@/lib/api";
import { toNumber } from "@/lib/format";
import type { CheckDelta, Headline, VendorRisk } from "@/types";
import { FilePlus } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [delta, setDelta] = useState<CheckDelta | null>(null);
  const [vendors, setVendors] = useState<VendorRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const periods = await api.fetchPeriods();
        if (periods.length === 0) {
          setHeadlines([]);
          return;
        }
        // Newest first; the first is the period currently open.
        const loaded = await Promise.all(periods.slice(0, 6).map((p) => api.fetchHeadline(p.id)));
        setHeadlines(loaded);
        const [d, v] = await Promise.all([
          api.fetchDelta(loaded[0].period_id),
          api.fetchVendorRisk(loaded[0].period_id),
        ]);
        setDelta(d);
        setVendors(v);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [location.key]);

  const newReconciliation = (
    <Button onClick={() => navigate("/reconcile")} className="gap-2">
      <FilePlus className="h-4 w-4" />
      New Reconciliation
    </Button>
  );

  if (loading) {
    return (
      <div>
        <Header title="Dashboard">{newReconciliation}</Header>
        <div className="space-y-6 p-6 lg:p-8">
          <Skeleton className="h-16 rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Header title="Dashboard">{newReconciliation}</Header>
        <div className="p-6 lg:p-8">
          <Card className="border-risk-critical/30">
            <CardContent className="p-6">
              <p className="font-medium text-risk-critical">Could not load the dashboard</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const current = headlines[0];

  if (!current) {
    return (
      <div>
        <Header title="Dashboard">{newReconciliation}</Header>
        <div className="p-6 lg:p-8">
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="font-medium">No reconciliations yet</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Upload a purchase register and a GSTR-2B to open your first period.
              </p>
              {newReconciliation}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const trend: TrendPoint[] = [...headlines].reverse().map((h) => {
    const counts = h.status_counts;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const clean =
      (counts.EXACT_MATCH ?? 0) + (counts.CARRIED_FORWARD ?? 0) + (counts.RESOLVED ?? 0);
    return {
      taxPeriod: h.tax_period,
      matchRate: total > 0 ? Math.round((clean / total) * 100) : 0,
      vendorCompliance:
        vendors.length > 0
          ? Math.round(((vendors.length - h.vendors_not_filed) / vendors.length) * 100)
          : 0,
      itcAtRisk: Number((toNumber(h.amount_at_risk) / 100000).toFixed(2)),
    };
  });

  return (
    <div>
      <Header title="Dashboard">{newReconciliation}</Header>

      <div className="space-y-6 p-6 lg:p-8">
        <CountdownHeadline headline={current} delta={delta} />

        <StatsCards headline={current} vendors={vendors} />

        <TrendChart data={trend} />

        <div className="grid gap-6 lg:grid-cols-2">
          <RecentRuns periods={headlines} />
          <VendorRiskList vendors={vendors} periodId={current.period_id} />
        </div>
      </div>
    </div>
  );
}
