/**
 * Vendors ranked by exposure × risk, with the filing history that no reconciliation
 * tool can show. The band comes from rules on filing behaviour, not a model score.
 */

import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RISK_META, describeFiling, formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VendorRisk } from "@/types";
import { ArrowUpRight, Clock } from "lucide-react";

interface Props {
  vendors: VendorRisk[];
  periodId: string;
  limit?: number;
}

export function VendorRiskList({ vendors, periodId, limit = 8 }: Props) {
  const ranked = vendors.filter((v) => v.missing_invoice_count > 0).slice(0, limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendors by exposure</CardTitle>
        <p className="text-sm text-muted-foreground">
          Ranked by money at risk × how reliably they file.
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        {ranked.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No vendor has invoices missing from this period&apos;s GSTR-2B.
          </p>
        )}
        {ranked.map((vendor) => (
          <Link
            key={vendor.vendor_id}
            to={`/vendors/${vendor.vendor_id}?period=${periodId}`}
            className="group flex items-start gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-muted/60"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{vendor.name}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    RISK_META[vendor.risk_band].tone,
                  )}
                >
                  {RISK_META[vendor.risk_band].label}
                </span>
                {vendor.predicted_late ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-risk-critical/10 px-2 py-0.5 text-xs font-semibold text-risk-critical">
                    <Clock className="h-3 w-3" />
                    likely to miss the 13th
                  </span>
                ) : (
                  !vendor.filed_this_period && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      not filed yet
                    </span>
                  )
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{describeFiling(vendor)}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-semibold tabular-nums">
                {formatInr(vendor.current_exposure)}
              </div>
              <div className="text-xs text-muted-foreground">
                {vendor.missing_invoice_count} invoice
                {vendor.missing_invoice_count === 1 ? "" : "s"}
              </div>
            </div>
            <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
