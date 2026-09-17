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
import { NudgeVendorModal } from "@/components/results/NudgeVendorModal";
import { ActivityTimeline } from "@/components/results/ActivityTimeline";
import { formatCurrency } from "@/lib/utils";
import { STATUS_LABEL, bucketOf, reasonTag, canNudgeVendor, formatMatchReason } from "@/lib/risk";
import { createInvoiceAction, fetchActionProposal, fetchInvoiceActions } from "@/lib/api";
import {
  MoreHorizontal,
  ArrowUpDown,
  Eye,
  Send,
  CheckCircle2,
  ChevronRight,
  Clock,
  ShieldOff,
  AlertTriangle,
  Flag,
} from "lucide-react";
import type { Invoice, RiskBucket, ActionProposal, InvoiceAction } from "@/types";

interface RecordTableProps {
  invoices: Invoice[];
  filter: RiskBucket | null;
  searchQuery: string;
  periodId: string;
  onInvoiceUpdate: () => void;
}

type SortField = "invoice_number" | "invoice_date" | "vendor_name" | "total_tax";
type SortDir = "asc" | "desc";

function bucketBadgeVariant(bucket: RiskBucket) {
  switch (bucket) {
    case "safe":
      return "success" as const;
    case "moderate":
      return "warning" as const;
    case "high":
      return "danger" as const;
  }
}

function searchText(invoice: Invoice): string {
  return `${invoice.invoice_number} ${invoice.vendor_name ?? ""} ${invoice.vendor_gstin ?? ""} ${invoice.match_reason ?? ""}`.toLowerCase();
}

const PAGE_SIZE = 10;

export function RecordTable({
  invoices,
  filter,
  searchQuery,
  periodId,
  onInvoiceUpdate,
}: RecordTableProps) {
  const [sortField, setSortField] = useState<SortField>("invoice_number");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [nudgeInvoice, setNudgeInvoice] = useState<Invoice | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Record<string, ActionProposal>>({});
  const [actions, setActions] = useState<Record<string, InvoiceAction[]>>({});

  useEffect(() => {
    setPage(0);
    setExpandedRow(null);
  }, [filter, searchQuery]);

  useEffect(() => {
    if (!expandedRow || proposals[expandedRow]) return;
    fetchActionProposal(expandedRow)
      .then((p) => setProposals((prev) => ({ ...prev, [expandedRow]: p })))
      .catch(() => {
        // Informational panel only — a failed fetch just leaves it blank.
      });
  }, [expandedRow, proposals]);

  useEffect(() => {
    if (!expandedRow || actions[expandedRow]) return;
    fetchInvoiceActions(expandedRow)
      .then((a) => setActions((prev) => ({ ...prev, [expandedRow]: a })))
      .catch(() => {});
  }, [expandedRow, actions]);

  /** Re-fetch actions for an invoice without clearing existing data (avoids flicker). */
  const refreshActions = useCallback((invoiceId: string) => {
    fetchInvoiceActions(invoiceId)
      .then((a) => setActions((prev) => ({ ...prev, [invoiceId]: a })))
      .catch(() => {});
  }, []);

  const handleResolve = useCallback(
    async (invoice: Invoice) => {
      setActionLoading(invoice.id);
      try {
        await createInvoiceAction(invoice.id, "MARKED_RESOLVED");
        onInvoiceUpdate();
        refreshActions(invoice.id);
      } finally {
        setActionLoading(null);
      }
    },
    [onInvoiceUpdate, refreshActions],
  );

  const handleEscalate = useCallback(
    async (invoice: Invoice) => {
      setActionLoading(invoice.id);
      try {
        await createInvoiceAction(invoice.id, "PAYMENT_HOLD_PROPOSED");
        onInvoiceUpdate();
        refreshActions(invoice.id);
      } finally {
        setActionLoading(null);
      }
    },
    [onInvoiceUpdate, refreshActions],
  );

  const handleFlag = useCallback(
    async (invoice: Invoice) => {
      setActionLoading(invoice.id);
      try {
        await createInvoiceAction(invoice.id, "IGNORED");
        onInvoiceUpdate();
        refreshActions(invoice.id);
      } finally {
        setActionLoading(null);
      }
    },
    [onInvoiceUpdate, refreshActions],
  );

  const filtered = useMemo(() => {
    let result = invoices;
    if (filter) result = result.filter((i) => bucketOf(i.status) === filter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((i) => searchText(i).includes(q));
    }
    return result;
  }, [invoices, filter, searchQuery]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "invoice_number":
          cmp = a.invoice_number.localeCompare(b.invoice_number);
          break;
        case "invoice_date":
          cmp = (a.invoice_date ?? "").localeCompare(b.invoice_date ?? "");
          break;
        case "vendor_name":
          cmp = (a.vendor_name ?? "").localeCompare(b.vendor_name ?? "");
          break;
        case "total_tax":
          cmp = Number(a.total_tax) - Number(b.total_tax);
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

  /** Derive a left-border color if the invoice has been acted upon. */
  function rowBorderClass(invoice: Invoice): string {
    const acts = actions[invoice.id];
    if (!acts || acts.length === 0) return "";
    const latest = acts[acts.length - 1].action;
    if (latest === "PAYMENT_HOLD_PROPOSED" || latest === "PAYMENT_HOLD_APPLIED")
      return "border-l-4 border-l-risk-critical";
    if (latest === "IGNORED") return "border-l-4 border-l-yellow-500";
    if (latest === "VENDOR_NOTIFIED") return "border-l-4 border-l-blue-500";
    if (latest === "MARKED_RESOLVED") return "border-l-4 border-l-risk-low";
    return "";
  }

  /** Small inline icon indicators for the invoice number cell. */
  function actionIndicators(invoice: Invoice) {
    const acts = actions[invoice.id];
    if (!acts || acts.length === 0) return null;
    const types = new Set(acts.map((a) => a.action));
    return (
      <span className="inline-flex gap-0.5 ml-1.5 align-middle">
        {types.has("PAYMENT_HOLD_PROPOSED") && (
          <span title="Escalated"><AlertTriangle className="h-3 w-3 text-risk-critical" /></span>
        )}
        {types.has("IGNORED") && (
          <span title="Flagged for review"><Flag className="h-3 w-3 text-yellow-500" /></span>
        )}
        {types.has("VENDOR_NOTIFIED") && (
          <span title="Vendor nudged"><Send className="h-3 w-3 text-blue-500" /></span>
        )}
      </span>
    );
  }

  return (
    <div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead field="invoice_number">Invoice No</SortableHead>
              <SortableHead field="invoice_date">Date</SortableHead>
              <SortableHead field="vendor_name">Vendor</SortableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead className="text-right">Taxable Value</TableHead>
              <SortableHead field="total_tax" className="text-right">
                Total Tax
              </SortableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              paged.map((invoice) => {
                const bucket = bucketOf(invoice.status);
                const tag = reasonTag(invoice);
                const proposal = proposals[invoice.id];
                return (
                  <Fragment key={invoice.id}>
                    <TableRow
                      className={`cursor-pointer ${rowBorderClass(invoice)}`}
                      onClick={() =>
                        setExpandedRow(expandedRow === invoice.id ? null : invoice.id)
                      }
                    >
                      <TableCell className="font-mono text-sm">
                        {invoice.invoice_number}
                        {actionIndicators(invoice)}
                      </TableCell>
                      <TableCell className="text-sm">{invoice.invoice_date ?? "—"}</TableCell>
                      <TableCell className="font-medium text-sm max-w-[160px] truncate">
                        {invoice.vendor_name ?? (
                          <span className="text-muted-foreground italic">Unknown vendor</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {invoice.vendor_gstin ?? "—"}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(Number(invoice.taxable_value ?? 0))}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {formatCurrency(Number(invoice.total_tax))}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={bucketBadgeVariant(bucket)}>
                          {STATUS_LABEL[invoice.status]}
                        </Badge>
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
                                setExpandedRow(expandedRow === invoice.id ? null : invoice.id);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={!canNudgeVendor(invoice)}
                              onClick={(e) => {
                                e.stopPropagation();
                                setNudgeInvoice(invoice);
                              }}
                            >
                              <Send className="mr-2 h-4 w-4" />
                              Nudge Vendor
                            </DropdownMenuItem>
                            {invoice.status !== "RESOLVED" && (
                              <DropdownMenuItem
                                disabled={actionLoading === invoice.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResolve(invoice);
                                }}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4 text-risk-low" />
                                Mark Resolved
                              </DropdownMenuItem>
                            )}
                            {bucketOf(invoice.status) === "high" && invoice.status !== "RESOLVED" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  disabled={actionLoading === invoice.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFlag(invoice);
                                  }}
                                >
                                  <Flag className="mr-2 h-4 w-4 text-yellow-500" />
                                  Flag for Review
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={actionLoading === invoice.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEscalate(invoice);
                                  }}
                                >
                                  <AlertTriangle className="mr-2 h-4 w-4 text-risk-critical" />
                                  Escalate
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {expandedRow === invoice.id && (
                      <TableRow key={`${invoice.id}-detail`}>
                        <TableCell colSpan={8} className="bg-muted/30">
                          <div className="py-3 px-4 space-y-4">
                            <div>
                              <div className="text-sm font-medium">Reason</div>
                              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                                {formatMatchReason(invoice.match_reason).map((seg, i) =>
                                  seg.className ? (
                                    <span key={i} className={seg.className}>{seg.text}</span>
                                  ) : (
                                    <span key={i}>{seg.text}</span>
                                  ),
                                )}
                              </p>
                              {tag && (
                                <Badge variant="secondary" className="mt-2 gap-1">
                                  {tag}
                                </Badge>
                              )}
                              {invoice.description && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Description: {invoice.description}
                                </p>
                              )}
                            </div>

                            {invoice.recoverable_until && (
                              <div className="flex items-center gap-1.5 text-xs">
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                {invoice.window_open ? (
                                  <span>
                                    Sec 16(4) window open —{" "}
                                    <span className="font-medium">
                                      {invoice.days_to_recover} day
                                      {invoice.days_to_recover === 1 ? "" : "s"}
                                    </span>{" "}
                                    left to recover this ITC (by {invoice.recoverable_until})
                                  </span>
                                ) : (
                                  <span className="text-risk-critical font-medium">
                                    Sec 16(4) window closed ({invoice.recoverable_until}) — this
                                    ITC can no longer be claimed
                                  </span>
                                )}
                              </div>
                            )}

                            {invoice.counterpart && (
                              <div className="grid grid-cols-2 gap-4 text-xs border-t pt-3">
                                <div>
                                  <div className="font-medium mb-1">Your books</div>
                                  <div>Invoice: {invoice.invoice_number}</div>
                                  <div>Tax: {formatCurrency(Number(invoice.total_tax))}</div>
                                </div>
                                <div>
                                  <div className="font-medium mb-1">GSTR-2B</div>
                                  <div>Invoice: {invoice.counterpart.invoice_number}</div>
                                  <div>
                                    Tax: {formatCurrency(Number(invoice.counterpart.total_tax))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {proposal && (
                              <div className="rounded-lg border bg-background p-3 text-xs space-y-1">
                                <div className="font-medium flex items-center gap-1.5">
                                  <ShieldOff className="h-3.5 w-3.5 text-muted-foreground" />
                                  Recommendation only — never applied automatically
                                </div>
                                <p className="text-muted-foreground">{proposal.rationale}</p>
                              </div>
                            )}

                            {actions[invoice.id] && actions[invoice.id].length > 0 && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-muted-foreground font-medium hover:text-foreground">
                                  Activity ({actions[invoice.id].length})
                                </summary>
                                <div className="mt-2">
                                  <ActivityTimeline actions={actions[invoice.id]} />
                                </div>
                              </details>
                            )}

                            <div className="border-t pt-3 flex gap-2 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-xs"
                                disabled={!canNudgeVendor(invoice)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNudgeInvoice(invoice);
                                }}
                              >
                                <Send className="h-3 w-3" />
                                Nudge Vendor
                              </Button>
                              {invoice.status !== "RESOLVED" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 text-xs"
                                  disabled={actionLoading === invoice.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResolve(invoice);
                                  }}
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Mark Resolved
                                </Button>
                              )}
                              {bucketOf(invoice.status) === "high" && invoice.status !== "RESOLVED" && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 text-xs text-yellow-600"
                                    disabled={actionLoading === invoice.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFlag(invoice);
                                    }}
                                  >
                                    <Flag className="h-3 w-3" />
                                    Flag for Review
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 text-xs text-risk-critical"
                                    disabled={actionLoading === invoice.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEscalate(invoice);
                                    }}
                                  >
                                    <AlertTriangle className="h-3 w-3" />
                                    Escalate
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of{" "}
            {sorted.length} records
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
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {nudgeInvoice && (
        <NudgeVendorModal
          open={!!nudgeInvoice}
          onOpenChange={(open) => {
            if (!open) setNudgeInvoice(null);
          }}
          invoice={nudgeInvoice}
          periodId={periodId}
          onSent={() => {
            onInvoiceUpdate();
          }}
        />
      )}
    </div>
  );
}
