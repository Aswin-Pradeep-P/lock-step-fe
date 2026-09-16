import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, AlertTriangle, XCircle } from "lucide-react";
import type { Invoice, RiskBucket } from "@/types";
import { BUCKET_LABEL, bucketOf } from "@/lib/risk";

interface SummaryCardsProps {
  invoices: Invoice[];
  activeFilter: RiskBucket | null;
  onFilterToggle: (bucket: RiskBucket) => void;
}

const BUCKETS: { key: RiskBucket; icon: typeof ShieldCheck; color: string; ring: string }[] = [
  { key: "safe", icon: ShieldCheck, color: "text-risk-low", ring: "ring-risk-low" },
  { key: "moderate", icon: AlertTriangle, color: "text-risk-high", ring: "ring-risk-high" },
  { key: "high", icon: XCircle, color: "text-risk-critical", ring: "ring-risk-critical" },
];

export function SummaryCards({ invoices, activeFilter, onFilterToggle }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {BUCKETS.map((bucket) => {
        const rows = invoices.filter((i) => bucketOf(i.status) === bucket.key);
        const tax = rows.reduce((sum, i) => sum + Number(i.total_tax), 0);
        const isActive = activeFilter === bucket.key;

        return (
          <Card
            key={bucket.key}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              isActive && `bg-muted/40 ring-2 ${bucket.ring}`,
            )}
            onClick={() => onFilterToggle(bucket.key)}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <bucket.icon className={cn("h-5 w-5", bucket.color)} />
                {isActive && (
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Active Filter
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{formatNumber(rows.length)}</p>
                <p className="text-sm font-medium text-muted-foreground">
                  {BUCKET_LABEL[bucket.key]}
                </p>
                <p className={cn("text-xs font-medium", bucket.color)}>
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
