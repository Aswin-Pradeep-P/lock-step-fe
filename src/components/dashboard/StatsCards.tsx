import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Activity, TrendingUp, AlertTriangle, HandCoins } from "lucide-react";
import type { Headline, Period, VendorRisk } from "@/types";
import { matchRatePercent, riskInvoiceCountFromHeadline } from "@/lib/risk";

interface StatsCardsProps {
  headlines: { period: Period; headline: Headline }[];
  vendors: VendorRisk[];
}

export function StatsCards({ headlines, vendors }: StatsCardsProps) {
  const totalRuns = headlines.reduce((sum, h) => sum + h.headline.checks_run, 0);
  const avgMatchRate =
    headlines.length > 0
      ? Math.round(
          headlines.reduce((sum, h) => sum + matchRatePercent(h.headline), 0) / headlines.length,
        )
      : 0;
  // Prefer Moderate+High from status_counts so the home dashboard matches SummaryCards
  // even if an older backend still returns the narrower filing-only at-risk fields.
  const totalAtRisk = headlines.reduce((sum, h) => sum + Number(h.headline.amount_at_risk), 0);
  const invoicesAtRisk = headlines.reduce(
    (sum, h) => sum + riskInvoiceCountFromHeadline(h.headline),
    0,
  );
  const vendorsAtRisk = vendors.filter((v) => v.risk_band === "HIGH").length;

  const stats = [
    {
      title: "Total Runs",
      value: formatNumber(totalRuns),
      icon: Activity,
      description: "Reconciliation checks completed",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      title: "Avg Match Rate",
      value: `${avgMatchRate}%`,
      icon: TrendingUp,
      description: "Across all periods",
      color: "text-risk-low",
      bg: "bg-risk-low/10",
    },
    {
      title: "Payments at Risk",
      value: formatNumber(invoicesAtRisk),
      icon: HandCoins,
      description: `${formatCurrency(totalAtRisk)} in ITC needs review`,
      color: "text-risk-high",
      bg: "bg-risk-high/10",
    },
    {
      title: "Vendors At Risk",
      value: formatNumber(vendorsAtRisk),
      icon: AlertTriangle,
      description: "High risk band — nudge or escalate",
      color: "text-risk-critical",
      bg: "bg-risk-critical/10",
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
            <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
