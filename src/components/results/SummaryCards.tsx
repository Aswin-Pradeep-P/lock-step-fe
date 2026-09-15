import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import type { RiskCategory, ReconciliationRun } from "@/types";

interface SummaryCardsProps {
  run: ReconciliationRun;
  activeFilter: RiskCategory | null;
  onFilterToggle: (category: RiskCategory) => void;
}

const categories: {
  key: RiskCategory;
  label: string;
  icon: typeof CheckCircle2;
  color: string;
  activeBg: string;
  activeRing: string;
}[] = [
  {
    key: "matched",
    label: "Matched",
    icon: ShieldCheck,
    color: "text-primary",
    activeBg: "bg-primary/5",
    activeRing: "ring-2 ring-primary",
  },
  {
    key: "low_risk",
    label: "Low Risk",
    icon: CheckCircle2,
    color: "text-risk-low",
    activeBg: "bg-risk-low/5",
    activeRing: "ring-2 ring-risk-low",
  },
  {
    key: "high_risk",
    label: "High Risk",
    icon: AlertTriangle,
    color: "text-risk-high",
    activeBg: "bg-risk-high/5",
    activeRing: "ring-2 ring-risk-high",
  },
  {
    key: "cannot_file",
    label: "Cannot File",
    icon: XCircle,
    color: "text-risk-critical",
    activeBg: "bg-risk-critical/5",
    activeRing: "ring-2 ring-risk-critical",
  },
];

function getCount(run: ReconciliationRun, key: RiskCategory): number {
  switch (key) {
    case "matched":
      return run.matchedCount;
    case "low_risk":
      return run.lowRiskCount;
    case "high_risk":
      return run.highRiskCount;
    case "cannot_file":
      return run.cannotFileCount;
  }
}

function getTaxAmount(run: ReconciliationRun, key: RiskCategory): number {
  return run.records
    .filter((r) => r.status === key)
    .reduce((sum, r) => sum + r.totalTax, 0);
}

export function SummaryCards({
  run,
  activeFilter,
  onFilterToggle,
}: SummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {categories.map((cat) => {
        const isActive = activeFilter === cat.key;
        const count = getCount(run, cat.key);
        const tax = getTaxAmount(run, cat.key);

        return (
          <Card
            key={cat.key}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              isActive && `${cat.activeBg} ${cat.activeRing}`
            )}
            onClick={() => onFilterToggle(cat.key)}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <cat.icon className={cn("h-5 w-5", cat.color)} />
                {isActive && (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Active Filter
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{formatNumber(count)}</p>
                <p className="text-sm font-medium text-muted-foreground">
                  {cat.label}
                </p>
                <p className={cn("text-xs font-medium", cat.color)}>
                  {formatCurrency(tax)}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
