import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchClients, fetchPeriods, fetchChecks, fetchInvoices } from "@/lib/api";
import { bucketOf } from "@/lib/risk";
import { friendlyError } from "@/lib/errors";
import { formatCurrency } from "@/lib/utils";
import type { Check, Invoice, Period } from "@/types";
import { format } from "date-fns";
import { FilePlus, ChevronRight, Search, ScrollText } from "lucide-react";

interface LogRow {
  period: Period;
  check: Check;
  /** Loaded only for completed runs — others have no invoices to summarise. */
  invoices: Invoice[] | null;
}

const PAGE_SIZE = 12;

function statusBadge(status: Check["status"]) {
  switch (status) {
    case "COMPLETED":
      return <Badge variant="success">Completed</Badge>;
    case "PROCESSING":
      return <Badge variant="secondary">Processing</Badge>;
    case "FAILED":
      return <Badge variant="danger">Failed</Badge>;
  }
}

export default function ReconciliationLogs() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const clients = await fetchClients();
        if (clients.length === 0) {
          setRows([]);
          return;
        }
        const periods = await fetchPeriods(clients[0].id);
        const checksByPeriod = await Promise.all(periods.map((p) => fetchChecks(p.id)));
        const flat = periods.flatMap((period, idx) =>
          checksByPeriod[idx].map((check) => ({ period, check })),
        );
        flat.sort(
          (a, b) => new Date(b.check.created_at).getTime() - new Date(a.check.created_at).getTime(),
        );
        const withInvoices: LogRow[] = await Promise.all(
          flat.map(async ({ period, check }) => ({
            period,
            check,
            invoices:
              check.status === "COMPLETED"
                ? await fetchInvoices(period.id, { checkId: check.id }).catch(() => [])
                : null,
          })),
        );
        setRows(withInvoices);
      } catch (err) {
        setError(friendlyError(err, { fallback: "Couldn't load reconciliation logs." }));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ period }) => {
      const label = `${period.tax_period.slice(0, 2)}/${period.tax_period.slice(2)}`;
      return label.includes(q) || period.tax_period.includes(q);
    });
  }, [rows, search]);

  useEffect(() => {
    setPage(0);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const newReconciliationButton = (
    <Button onClick={() => navigate("/reconcile")} className="gap-2">
      <FilePlus className="h-4 w-4" />
      New Reconciliation
    </Button>
  );

  return (
    <div>
      <Header title="Reconciliation Logs">{newReconciliationButton}</Header>

      <div className="p-6 lg:p-8 space-y-6">
        <p className="text-sm text-muted-foreground">
          Every reconciliation check ever run, newest first. Open a completed run to see its
          full results.
        </p>

        {loading ? (
          <Skeleton className="h-96 rounded-lg" />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed p-12 text-center">
            <ScrollText className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground mb-4">No reconciliation runs yet.</p>
            {newReconciliationButton}
          </div>
        ) : (
          <>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by tax period (e.g. 09/2026)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-center">Records</TableHead>
                    <TableHead className="text-center">At Risk</TableHead>
                    <TableHead className="text-right">Tax at Risk</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        No runs match your filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paged.map(({ period, check, invoices }) => {
                      const completed = check.status === "COMPLETED";
                      const atRisk = invoices?.filter((i) => bucketOf(i.status) === "high") ?? [];
                      const taxAtRisk = atRisk.reduce((sum, i) => sum + Number(i.total_tax), 0);
                      return (
                        <TableRow
                          key={check.id}
                          className={completed ? "cursor-pointer" : ""}
                          onClick={
                            completed
                              ? () => navigate(`/reconcile/${period.id}/${check.id}`)
                              : undefined
                          }
                        >
                          <TableCell className="font-medium">
                            {format(new Date(check.created_at), "dd MMM yyyy, h:mm a")}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {period.tax_period.slice(0, 2)}/{period.tax_period.slice(2)}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            {invoices?.length ?? check.rows_parsed ?? "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            {!completed ? (
                              <span className="text-muted-foreground">—</span>
                            ) : atRisk.length > 0 ? (
                              <Badge variant="danger">{atRisk.length}</Badge>
                            ) : (
                              <Badge variant="success">0</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {completed ? formatCurrency(taxAtRisk) : "—"}
                          </TableCell>
                          <TableCell className="text-center">{statusBadge(check.status)}</TableCell>
                          <TableCell>
                            {completed && (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)}{" "}
                  of {filtered.length} runs
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0}
                  >
                    Prev
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages - 1}
                    className="gap-1"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
