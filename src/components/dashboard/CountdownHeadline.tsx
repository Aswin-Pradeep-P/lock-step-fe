/**
 * The countdown, as a strip rather than a takeover.
 *
 * GSTR-2B is generated on the 14th from filings made by the 13th, so a tool that
 * reports on 2B is always reporting after the deadline that decided the outcome. This
 * bar is the reminder that you are still inside the window — it sits above the normal
 * dashboard, it doesn't replace it.
 */

import { Card } from "@/components/ui/card";
import { formatDate, formatInr, formatTaxPeriod } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CheckDelta, Headline } from "@/types";
import { CalendarClock, CheckCircle2 } from "lucide-react";

interface Props {
  headline: Headline;
  delta?: CheckDelta | null;
}

export function CountdownHeadline({ headline, delta }: Props) {
  const { days_to_cutoff: days, window_open: open } = headline;
  const resolved = delta?.invoices_resolved ?? 0;

  return (
    <Card
      className={cn(
        "border-0 p-0 shadow-sm",
        open ? "bg-sidebar" : "bg-risk-critical",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 text-white">
        <CalendarClock className="h-5 w-5 shrink-0 opacity-70" />

        <p className="text-base font-semibold sm:text-lg">
          <span className="tabular-nums">{formatInr(headline.amount_at_risk)}</span> at risk
          <span className="mx-2 opacity-40">·</span>
          {open ? (
            <>
              <span className="tabular-nums">{days}</span> {days === 1 ? "day" : "days"} to the
              13th
            </>
          ) : (
            <>
              <span className="tabular-nums">{Math.abs(days)}</span> days past the 13th
            </>
          )}
          <span className="mx-2 opacity-40">·</span>
          <span className="tabular-nums">{headline.vendors_not_filed}</span> vendors haven&apos;t
          filed
        </p>

        <span className="text-xs text-white/60">
          {formatTaxPeriod(headline.tax_period)} · cutoff {formatDate(headline.cutoff_date)}
        </span>

        {delta?.has_previous && resolved > 0 && (
          <span className="ml-auto flex items-center gap-2 text-sm text-white/80">
            <CheckCircle2 className="h-4 w-4 text-risk-low" />
            {resolved} filed since the last check — {formatInr(delta.amount_recovered)} recovered
          </span>
        )}
      </div>
    </Card>
  );
}
