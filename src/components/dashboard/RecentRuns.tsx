/**
 * Recent Reconciliations — the original runs table, kept, one row per tax period.
 *
 * A period is the run that never ends: it holds every check you've made this month, so
 * the "Checks" column is where the old "Files" column was.
 */

import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatFullInr, formatTaxPeriod } from "@/lib/format";
import type { Headline } from "@/types";
import { FileText } from "lucide-react";

export function RecentRuns({ periods }: { periods: Headline[] }) {
  const navigate = useNavigate();

  if (periods.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Reconciliations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <FileText className="mb-3 h-10 w-10 opacity-50" />
            <p className="text-sm">No reconciliations yet.</p>
            <p className="mt-1 text-xs">
              Start a new reconciliation to see results here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Reconciliations</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className="text-center">Checks</TableHead>
              <TableHead className="text-center">Records</TableHead>
              <TableHead className="text-center">Matched</TableHead>
              <TableHead className="text-center">At Risk</TableHead>
              <TableHead className="text-right">Tax at Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {periods.map((period) => {
              const counts = period.status_counts;
              const total = Object.values(counts).reduce((a, b) => a + b, 0);
              const clean =
                (counts.EXACT_MATCH ?? 0) +
                (counts.CARRIED_FORWARD ?? 0) +
                (counts.RESOLVED ?? 0);
              const matchPct = total > 0 ? Math.round((clean / total) * 100) : 0;
              return (
                <TableRow
                  key={period.period_id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/periods/${period.period_id}`)}
                >
                  <TableCell className="font-medium">
                    {formatTaxPeriod(period.tax_period)}
                    {period.window_open && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        open
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{period.checks_run}</TableCell>
                  <TableCell className="text-center">{total}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={matchPct >= 80 ? "success" : "warning"}>{matchPct}%</Badge>
                  </TableCell>
                  <TableCell className="text-center">{period.invoices_at_risk}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatFullInr(period.amount_at_risk)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
