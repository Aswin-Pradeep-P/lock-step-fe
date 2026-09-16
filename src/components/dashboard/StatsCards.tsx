/**
 * The original four stat cards, kept — same layout, same icon-chip styling.
 *
 * What changed is what they count. "Total Runs" and "Avg Match Rate" describe the
 * past; the deadline is the thing a user can still act on, so the countdown takes
 * the second slot and the rest follow from the open period.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInr, formatNumber } from "@/lib/format";
import type { Headline, VendorRisk } from "@/types";
import { AlertTriangle, CalendarClock, HandCoins, TrendingUp } from "lucide-react";

interface StatsCardsProps {
  headline: Headline;
  vendors: VendorRisk[];
}

export function StatsCards({ headline, vendors }: StatsCardsProps) {
  const counts = headline.status_counts;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const clean = (counts.EXACT_MATCH ?? 0) + (counts.CARRIED_FORWARD ?? 0) + (counts.RESOLVED ?? 0);
  const matchRate = total > 0 ? Math.round((clean / total) * 100) : 0;
  const days = headline.days_to_cutoff;
  const open = headline.window_open;

  const stats = [
    {
      title: "ITC at Risk",
      value: formatInr(headline.amount_at_risk),
      icon: HandCoins,
      description: `${headline.invoices_at_risk} invoices not in GSTR-2B yet`,
      color: "text-risk-critical",
      bg: "bg-risk-critical/10",
    },
    {
      title: open ? "Days to the 13th" : "Days Past the 13th",
      value: formatNumber(Math.abs(days)),
      icon: CalendarClock,
      description: open
        ? "while the vendor can still act"
        : "credit has slipped to next period",
      color: open ? "text-primary" : "text-risk-critical",
      bg: open ? "bg-primary/10" : "bg-risk-critical/10",
    },
    {
      title: "Vendors Outstanding",
      value: formatNumber(headline.vendors_not_filed),
      icon: AlertTriangle,
      description: "haven't filed this period — nudge them",
      color: "text-risk-high",
      bg: "bg-risk-high/10",
    },
    {
      title: "Match Rate",
      value: `${matchRate}%`,
      icon: TrendingUp,
      description: `${formatNumber(total)} invoices across ${vendors.length} vendors`,
      color: "text-risk-low",
      bg: "bg-risk-low/10",
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
            <p className="mt-1 text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
