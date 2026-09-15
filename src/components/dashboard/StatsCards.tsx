import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  Activity,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import type { ReconciliationRunSummary, Vendor } from "@/types";

interface StatsCardsProps {
  runs: ReconciliationRunSummary[];
  vendors: Vendor[];
}

export function StatsCards({ runs, vendors }: StatsCardsProps) {
  const totalRuns = runs.length;
  const avgMatchRate =
    runs.length > 0
      ? Math.round(
          runs.reduce(
            (acc, r) =>
              acc + ((r.matchedCount + r.lowRiskCount) / r.totalRecords) * 100,
            0
          ) / runs.length
        )
      : 0;
  const vendorsAtRisk = vendors.filter((v) => v.riskTier === "red").length;
  const totalTaxAtRisk = runs.reduce((acc, r) => acc + r.totalTaxAtRisk, 0);

  const stats = [
    {
      title: "Total Runs",
      value: formatNumber(totalRuns),
      icon: Activity,
      description: "Reconciliation runs completed",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Avg Match Rate",
      value: `${avgMatchRate}%`,
      icon: TrendingUp,
      description: "Across all reconciliation runs",
      color: "text-risk-low",
      bg: "bg-risk-low/10",
    },
    {
      title: "Vendors At Risk",
      value: formatNumber(vendorsAtRisk),
      icon: AlertTriangle,
      description: "Non-compliant vendors",
      color: "text-risk-critical",
      bg: "bg-risk-critical/10",
    },
    {
      title: "ITC At Risk",
      value: formatCurrency(totalTaxAtRisk),
      icon: ShieldAlert,
      description: "Tax credit at risk of disallowance",
      color: "text-risk-high",
      bg: "bg-risk-high/10",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`rounded-md p-2 ${stat.bg}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stat.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
