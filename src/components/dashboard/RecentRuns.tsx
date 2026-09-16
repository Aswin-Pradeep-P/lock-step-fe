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
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import type { Check, Invoice, Period } from "@/types";
import { bucketOf } from "@/lib/risk";
import { FileText } from "lucide-react";

export interface RunRow {
  period: Period;
  check: Check;
  invoices: Invoice[];
}

interface RecentRunsProps {
  runs: RunRow[];
}

export function RecentRuns({ runs }: RecentRunsProps) {
  const navigate = useNavigate();

  if (runs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Reconciliation Runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <FileText className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">No reconciliation runs yet.</p>
            <p className="text-xs mt-1">Start a new reconciliation to see results here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Reconciliation Runs</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-center">Records</TableHead>
              <TableHead className="text-center">At Risk</TableHead>
              <TableHead className="text-right">Tax at Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map(({ period, check, invoices }) => {
              const atRiskRows = invoices.filter((i) => bucketOf(i.status) === "high");
              const taxAtRisk = atRiskRows.reduce((sum, i) => sum + Number(i.total_tax), 0);
              return (
                <TableRow
                  key={check.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/reconcile/${period.id}/${check.id}`)}
                >
                  <TableCell className="font-medium">
                    {format(new Date(check.created_at), "dd MMM yyyy, h:mm a")}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {period.tax_period.slice(0, 2)}/{period.tax_period.slice(2)}
                  </TableCell>
                  <TableCell className="text-center">{invoices.length}</TableCell>
                  <TableCell className="text-center">
                    {atRiskRows.length > 0 ? (
                      <Badge variant="danger">{atRiskRows.length}</Badge>
                    ) : (
                      <Badge variant="success">0</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(taxAtRisk)}
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
