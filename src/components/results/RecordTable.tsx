import { useMemo, useState, Fragment } from "react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/utils";
import { statusLabel } from "@/lib/export";
import {
  MoreHorizontal,
  ArrowUpDown,
  Eye,
  Flag,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ReconciledRecord, RiskCategory } from "@/types";

interface RecordTableProps {
  records: ReconciledRecord[];
  filter: RiskCategory | null;
  searchQuery: string;
}

type SortField = "invoiceNo" | "invoiceDate" | "supplierName" | "totalTax" | "matchConfidence";
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

const PAGE_SIZE = 10;

export function RecordTable({
  records,
  filter,
  searchQuery,
}: RecordTableProps) {
  const [sortField, setSortField] = useState<SortField>("invoiceNo");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [page, setPage] = useState(0);

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
          r.aiSummary.toLowerCase().includes(q)
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
                    className="cursor-pointer"
                    onClick={() =>
                      setExpandedRow(
                        expandedRow === record.id ? null : record.id
                      )
                    }
                  >
                    <TableCell className="font-mono text-sm">
                      {record.invoiceNo}
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
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Flag className="mr-2 h-4 w-4" />
                            Flag for Review
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            Escalate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {expandedRow === record.id && (
                    <TableRow key={`${record.id}-detail`}>
                      <TableCell colSpan={9} className="bg-muted/30">
                        <div className="py-2 px-4 space-y-2">
                          <div className="text-sm font-medium">AI Summary</div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {record.aiSummary}
                          </p>
                          <div className="flex gap-4 text-xs text-muted-foreground pt-1">
                            <span>
                              IGST: {formatCurrency(record.igst)}
                            </span>
                            <span>
                              CGST: {formatCurrency(record.cgst)}
                            </span>
                            <span>
                              SGST: {formatCurrency(record.sgst)}
                            </span>
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
    </div>
  );
}
