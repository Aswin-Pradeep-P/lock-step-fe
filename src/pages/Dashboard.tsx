import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { RecentRuns } from "@/components/dashboard/RecentRuns";
import { VendorRiskList } from "@/components/dashboard/VendorRiskList";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore } from "@/store/useStore";
import { fetchRuns, fetchVendors } from "@/lib/api";
import { FilePlus } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { runs, vendors, setRuns, setVendors } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [runsData, vendorsData] = await Promise.all([
          fetchRuns(),
          fetchVendors(),
        ]);
        setRuns(runsData);
        setVendors(vendorsData);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [setRuns, setVendors, location.key]);

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
        <StatsCards runs={runs} vendors={vendors} />

        <div className="grid gap-6 lg:grid-cols-2">
          <RecentRuns runs={runs} />
          <VendorRiskList vendors={vendors} />
        </div>
      </div>
    </div>
  );
}
