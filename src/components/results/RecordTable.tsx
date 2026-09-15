import { useMemo, useState, useEffect, useCallback, Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActivityTimeline } from "@/components/results/ActivityTimeline";
import { NudgeVendorModal } from "@/components/results/NudgeVendorModal";
import { formatCurrency, cn } from "@/lib/utils";
import { statusLabel } from "@/lib/export";
import { updateRecordAction } from "@/lib/api";
import {
  MoreHorizontal,
  ArrowUpDown,
  Eye,
  Flag,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Send,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  ArrowRightLeft,
  ShieldAlert,
} from "lucide-react";
import type { ReconciledRecord, RiskCategory, SuggestionAction } from "@/types";

interface RecordTableProps {
  records: ReconciledRecord[];
  filter: RiskCategory | null;
  searchQuery: string;
  runId: string;
  onRecordUpdate: (updated: ReconciledRecord) => void;
}

type SortField =
  | "invoiceNo"
  | "invoiceDate"
  | "supplierName"
  | "totalTax"
  | "matchConfidence";
type SortDir = "asc" | "desc";

function statusBadgeVariant(status: RiskCategory) {
  switch (status) {
    case "matched":
      return "default" as const;
    case "low_risk":
      return "success" as const;
    case "high_risk":
      return "warning" as const;
    case "cannot_file":
      return "danger" as const;
  }
}

function hasNudge(record: ReconciledRecord): boolean {
  return record.activityLog?.some((e) => e.type === "nudge_sent") ?? false;
}

function suggestionIcon(action: SuggestionAction) {
  switch (action) {
    case "auto_correct":
      return <RefreshCw className="h-3.5 w-3.5" />;
    case "nudge_vendor":
      return <Send className="h-3.5 w-3.5" />;
    case "switch_vendor":
      return <ArrowRightLeft className="h-3.5 w-3.5" />;
    case "accept_risk":
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case "escalate_urgent":
      return <ShieldAlert className="h-3.5 w-3.5" />;
  }
}

const PAGE_SIZE = 10;

export function RecordTable({
  records,
  filter,
  searchQuery,
  runId,
  onRecordUpdate,
}: RecordTableProps) {
  const [sortField, setSortField] = useState<SortField>("invoiceNo");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [nudgeRecord, setNudgeRecord] = useState<ReconciledRecord | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    setPage(0);
    setExpandedRow(null);
  }, [filter, searchQuery]);

  const handleAction = useCallback(
    async (record: ReconciledRecord, action: "flagged" | "escalated" | "resolved") => {
      setActionLoading(record.id);
      try {
        const updated = await updateRecordAction(runId, record.id, action);
        onRecordUpdate(updated);
      } catch (err) {
        console.error(`Failed to ${action} record:`, err);
      } finally {
        setActionLoading(null);
      }
    },
    [runId, onRecordUpdate],
  );

  const filtered = useMemo(() => {
    let result = records;
    if (filter) {
      result = result.filter((r) => r.status === filter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.invoiceNo.toLowerCase().includes(q) ||
          r.supplierName.toLowerCase().includes(q) ||
          r.gstin.toLowerCase().includes(q) ||
          r.aiSummary.toLowerCase().includes(q),
      );
    }
    return result;
  }, [records, filter, searchQuery]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "invoiceNo":
          cmp = a.invoiceNo.localeCompare(b.invoiceNo);
          break;
        case "invoiceDate":
          cmp = a.invoiceDate.localeCompare(b.invoiceDate);
          break;
        case "supplierName":
          cmp = a.supplierName.localeCompare(b.supplierName);
          break;
        case "totalTax":
          cmp = a.totalTax - b.totalTax;
          break;
        case "matchConfidence":
          cmp = a.matchConfidence - b.matchConfidence;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(0);
  };

  const SortableHead = ({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <TableHead
      className={`cursor-pointer select-none hover:text-foreground ${className || ""}`}
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3" />
      </div>
    </TableHead>
  );

  return (
    <div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead field="invoiceNo">Invoice No</SortableHead>
              <SortableHead field="invoiceDate">Date</SortableHead>
              <SortableHead field="supplierName">Supplier</SortableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead className="text-right">Taxable Value</TableHead>
              <SortableHead field="totalTax" className="text-right">
                Total Tax
              </SortableHead>
              <TableHead className="text-center">Status</TableHead>
              <SortableHead field="matchConfidence" className="text-center">
                Confidence
              </SortableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center py-8 text-muted-foreground"
                >
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              paged.map((record) => (
                <Fragment key={record.id}>
                  <TableRow
                    className={cn(
                      "cursor-pointer border-l-2 transition-colors",
                      record.actionStatus === "flagged"
                        ? "border-l-risk-high bg-risk-high/[0.02]"
                        : record.actionStatus === "escalated"
                          ? "border-l-risk-critical bg-risk-critical/[0.02]"
                          : record.actionStatus === "resolved"
                            ? "border-l-risk-low bg-risk-low/[0.02]"
                            : "border-l-transparent",
                    )}
                    onClick={() =>
                      setExpandedRow(
                        expandedRow === record.id ? null : record.id,
                      )
                    }
                  >
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        <span>{record.invoiceNo}</span>
                        <div className="flex items-center gap-1">
                          {record.actionStatus === "flagged" && (
                            <Flag className="h-3 w-3 text-risk-high" />
                          )}
                          {record.actionStatus === "escalated" && (
                            <AlertTriangle className="h-3 w-3 text-risk-critical" />
                          )}
                          {record.actionStatus === "resolved" && (
                            <CheckCircle2 className="h-3 w-3 text-risk-low" />
                          )}
                          {hasNudge(record) && (
                            <Send className="h-3 w-3 text-primary" />
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.invoiceDate}
                    </TableCell>
                    <TableCell className="font-medium text-sm max-w-[160px] truncate">
                      {record.supplierName}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {record.gstin}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(record.taxableValue)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatCurrency(record.totalTax)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusBadgeVariant(record.status)}>
                        {statusLabel(record.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-mono">
                        {record.matchConfidence}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedRow(
                                expandedRow === record.id ? null : record.id,
                              );
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setNudgeRecord(record);
                            }}
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Nudge Vendor
                          </DropdownMenuItem>

                          {record.actionStatus !== "flagged" &&
                            record.actionStatus !== "escalated" && (
                              <DropdownMenuItem
                                disabled={actionLoading === record.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAction(record, "flagged");
                                }}
                              >
                                <Flag className="mr-2 h-4 w-4" />
                                Flag for Review
                              </DropdownMenuItem>
                            )}

                          {record.actionStatus !== "escalated" && (
                            <DropdownMenuItem
                              className="text-destructive"
                              disabled={actionLoading === record.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAction(record, "escalated");
                              }}
                            >
                              <AlertTriangle className="mr-2 h-4 w-4" />
                              Escalate
                            </DropdownMenuItem>
                          )}

                          {(record.actionStatus === "flagged" ||
                            record.actionStatus === "escalated") && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled={actionLoading === record.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAction(record, "resolved");
                                }}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4 text-risk-low" />
                                Mark Resolved
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {expandedRow === record.id && (
                    <TableRow key={`${record.id}-detail`}>
                      <TableCell colSpan={9} className="bg-muted/30">
                        <div className="py-3 px-4 space-y-4">
                          <div>
                            <div className="text-sm font-medium">
                              AI Summary
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                              {record.aiSummary}
                            </p>
                          </div>

                          {record.aiSuggestions &&
                            record.aiSuggestions.length > 0 && (
                              <details className="group">
                                <summary className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors list-none [&::-webkit-details-marker]:hidden">
                                  <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                                  <Sparkles className="h-3 w-3 text-primary" />
                                  AI Suggestions ({record.aiSuggestions.length})
                                </summary>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {record.aiSuggestions.map((suggestion) => (
                                    <button
                                      key={suggestion.id}
                                      title={suggestion.description}
                                      className={cn(
                                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors hover:shadow-sm",
                                        suggestion.action === "auto_correct" &&
                                          "border-risk-low/30 text-risk-low hover:bg-risk-low/5",
                                        suggestion.action === "nudge_vendor" &&
                                          "border-primary/30 text-primary hover:bg-primary/5",
                                        suggestion.action === "switch_vendor" &&
                                          "border-risk-high/30 text-risk-high hover:bg-risk-high/5",
                                        suggestion.action === "accept_risk" &&
                                          "border-risk-low/30 text-risk-low hover:bg-risk-low/5",
                                        suggestion.action ===
                                          "escalate_urgent" &&
                                          "border-risk-critical/30 text-risk-critical hover:bg-risk-critical/5",
                                      )}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (
                                          suggestion.action === "nudge_vendor"
                                        ) {
                                          setNudgeRecord(record);
                                        } else if (
                                          suggestion.action ===
                                          "escalate_urgent"
                                        ) {
                                          handleAction(record, "escalated");
                                        } else if (
                                          suggestion.action === "accept_risk"
                                        ) {
                                          handleAction(record, "resolved");
                                        } else if (
                                          suggestion.action === "auto_correct"
                                        ) {
                                          handleAction(record, "resolved");
                                        } else if (
                                          suggestion.action === "switch_vendor"
                                        ) {
                                          handleAction(record, "flagged");
                                        }
                                      }}
                                    >
                                      {suggestionIcon(suggestion.action)}
                                      {suggestion.label}
                                    </button>
                                  ))}
                                </div>
                              </details>
                            )}

                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>IGST: {formatCurrency(record.igst)}</span>
                            <span>CGST: {formatCurrency(record.cgst)}</span>
                            <span>SGST: {formatCurrency(record.sgst)}</span>
                          </div>

                          {record.activityLog &&
                            record.activityLog.length > 1 && (
                              <div className="border-t pt-3">
                                <ActivityTimeline
                                  entries={record.activityLog}
                                />
                              </div>
                            )}

                          <div className="border-t pt-3 flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNudgeRecord(record);
                              }}
                            >
                              <Send className="h-3 w-3" />
                              Nudge Vendor
                            </Button>
                            {record.actionStatus !== "flagged" &&
                              record.actionStatus !== "escalated" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 text-xs"
                                  disabled={actionLoading === record.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAction(record, "flagged");
                                  }}
                                >
                                  <Flag className="h-3 w-3" />
                                  Flag for Review
                                </Button>
                              )}
                            {record.actionStatus !== "escalated" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs text-destructive"
                                disabled={actionLoading === record.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAction(record, "escalated");
                                }}
                              >
                                <AlertTriangle className="h-3 w-3" />
                                Escalate
                              </Button>
                            )}
                            {(record.actionStatus === "flagged" ||
                              record.actionStatus === "escalated") && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs text-risk-low"
                                disabled={actionLoading === record.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAction(record, "resolved");
                                }}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Resolve
                              </Button>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, sorted.length)} of{" "}
            {sorted.length} records
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {nudgeRecord && (
        <NudgeVendorModal
          open={!!nudgeRecord}
          onOpenChange={(open) => {
            if (!open) setNudgeRecord(null);
          }}
          record={nudgeRecord}
          runId={runId}
          onRecordUpdate={(updated) => {
            onRecordUpdate(updated);
            setNudgeRecord(null);
          }}
        />
      )}
    </div>
  );
}
