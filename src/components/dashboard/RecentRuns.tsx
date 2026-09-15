import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { ReconciliationRunSummary } from "@/types";
import { FileText } from "lucide-react";

interface RecentRunsProps {
  runs: ReconciliationRunSummary[];
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
            <p className="text-xs mt-1">
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
        <CardTitle className="text-lg">Recent Reconciliation Runs</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Files</TableHead>
              <TableHead className="text-center">Records</TableHead>
              <TableHead className="text-center">Matched</TableHead>
              <TableHead className="text-center">At Risk</TableHead>
              <TableHead className="text-right">Tax at Risk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => {
              const matchPct = run.totalRecords > 0
                ? Math.round(
                    ((run.matchedCount + run.lowRiskCount) / run.totalRecords) * 100
                  )
                : 0;
              const atRisk = run.highRiskCount + run.cannotFileCount;
              return (
                <TableRow
                  key={run.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/reconcile/${run.id}`)}
                >
                  <TableCell className="font-medium">
                    {format(new Date(run.createdAt), "dd MMM yyyy, h:mm a")}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs">
                      <div className="truncate max-w-[180px]">
                        {run.purchaseFileName}
                      </div>
                      <div className="truncate max-w-[180px] text-muted-foreground">
                        {run.gstr2bFileName}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {run.totalRecords}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={matchPct >= 80 ? "success" : "warning"}>
                      {matchPct}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {atRisk > 0 ? (
                      <Badge variant="danger">{atRisk}</Badge>
                    ) : (
                      <Badge variant="success">0</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(run.totalTaxAtRisk)}
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
