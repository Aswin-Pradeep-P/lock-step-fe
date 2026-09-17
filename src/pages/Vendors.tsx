import { useEffect, useMemo, useState, Fragment } from "react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { fetchVendorRisk, fetchVendorDetail } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { formatCurrency } from "@/lib/utils";
import type { VendorRisk, VendorDetail } from "@/types";
import {
  Users,
  ShieldQuestion,
  Search,
  ChevronRight,
  Sparkles,
  Mail,
  Phone,
} from "lucide-react";

const PAGE_SIZE = 15;

function riskBadgeVariant(band: VendorRisk["risk_band"]) {
  switch (band) {
    case "LOW":
      return "success" as const;
    case "MEDIUM":
      return "warning" as const;
    case "HIGH":
      return "danger" as const;
    case "UNKNOWN":
      return "secondary" as const;
  }
}

function riskLabel(band: VendorRisk["risk_band"]) {
  switch (band) {
    case "LOW":
      return "Reliable";
    case "MEDIUM":
      return "Watch";
    case "HIGH":
      return "High Risk";
    case "UNKNOWN":
      return "No History";
  }
}

/** avg_days_past_cutoff: positive = files late, <= 0 = files on/before the cutoff. */
function latenessLabel(days: number | null): string {
  if (days === null) return "—";
  const rounded = Math.round(days);
  if (rounded > 0) return `${rounded}d late`;
  if (rounded < 0) return `${Math.abs(rounded)}d early`;
  return "on cutoff";
}

export default function Vendors() {
  const [vendors, setVendors] = useState<VendorRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, VendorDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const rows = await fetchVendorRisk();
        setVendors(
          [...rows].sort((a, b) => Number(b.current_exposure) - Number(a.current_exposure)),
        );
      } catch (err) {
        setError(friendlyError(err, { fallback: "Couldn't load vendors." }));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Lazily fetch the filing history + AI summary the first time a row is opened.
  useEffect(() => {
    if (!expanded || details[expanded]) return;
    setDetailLoading(expanded);
    fetchVendorDetail(expanded, { includeSummary: true })
      .then((d) => setDetails((prev) => ({ ...prev, [expanded]: d })))
      .catch(() => {
        // Detail is a courtesy layer — a failed fetch just leaves it blank.
      })
      .finally(() => setDetailLoading((cur) => (cur === expanded ? null : cur)));
  }, [expanded, details]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(q) || (v.gstin ?? "").toLowerCase().includes(q),
    );
  }, [vendors, search]);

  useEffect(() => {
    setPage(0);
    setExpanded(null);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <Header title="Vendors" />

      <div className="p-6 lg:p-8 space-y-6">
        <p className="text-sm text-muted-foreground">
          Every supplier seen across your reconciliations, ranked by exposure. Open a row for
          filing history and a summary.
        </p>

        {loading ? (
          <Skeleton className="h-96 rounded-lg" />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : vendors.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed p-12 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              No vendors yet — run a reconciliation to populate this.
            </p>
          </div>
        ) : (
          <>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or GSTIN…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="rounded-lg border bg-card">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>GSTIN</TableHead>
                      <TableHead className="text-center">Risk</TableHead>
                      <TableHead className="text-center">On-Time</TableHead>
                      <TableHead className="text-center">Typical Lateness</TableHead>
                      <TableHead className="text-center">Files ~Day</TableHead>
                      <TableHead className="text-center">Filed This Period</TableHead>
                      <TableHead className="text-center">Missing</TableHead>
                      <TableHead className="text-right">Exposure</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                          No vendors match your search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paged.map((v) => {
                        const open = expanded === v.vendor_id;
                        const detail = details[v.vendor_id];
                        return (
                          <Fragment key={v.vendor_id}>
                            <TableRow
                              className="cursor-pointer"
                              onClick={() => setExpanded(open ? null : v.vendor_id)}
                            >
                              <TableCell className="font-medium max-w-[220px] truncate">
                                {v.name}
                                {v.predicted_late && (
                                  <Badge variant="warning" className="ml-2 text-[10px]">
                                    Likely late
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {v.gstin ?? (
                                  <span
                                    className="flex items-center gap-1 text-muted-foreground italic"
                                    title="No GSTIN could be resolved for this vendor"
                                  >
                                    <ShieldQuestion className="h-3 w-3" />
                                    unverified
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={riskBadgeVariant(v.risk_band)}>
                                  {riskLabel(v.risk_band)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {v.on_time_rate !== null
                                  ? `${Math.round(v.on_time_rate * 100)}%`
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {latenessLabel(v.avg_days_past_cutoff)}
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {v.typical_filing_day ?? "—"}
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {v.filed_this_period ? (
                                  <span className="text-risk-low font-medium">Yes</span>
                                ) : (
                                  <span className="text-risk-critical font-medium">No</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {v.missing_invoice_count > 0 ? (
                                  <Badge variant="danger">{v.missing_invoice_count}</Badge>
                                ) : (
                                  "0"
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                {formatCurrency(Number(v.current_exposure))}
                              </TableCell>
                              <TableCell>
                                <ChevronRight
                                  className={`h-4 w-4 text-muted-foreground transition-transform ${
                                    open ? "rotate-90" : ""
                                  }`}
                                />
                              </TableCell>
                            </TableRow>
                            {open && (
                              <TableRow key={`${v.vendor_id}-detail`}>
                                <TableCell colSpan={10} className="bg-muted/30">
                                  <div className="space-y-4 px-4 py-3">
                                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                                      <span className="text-muted-foreground">
                                        Periods observed:{" "}
                                        <span className="font-medium text-foreground">
                                          {v.periods_observed}
                                        </span>
                                      </span>
                                      {v.contact_email && (
                                        <span className="flex items-center gap-1 text-muted-foreground">
                                          <Mail className="h-3 w-3" />
                                          {v.contact_email}
                                        </span>
                                      )}
                                      {detail?.contact_phone && (
                                        <span className="flex items-center gap-1 text-muted-foreground">
                                          <Phone className="h-3 w-3" />
                                          {detail.contact_phone}
                                        </span>
                                      )}
                                    </div>

                                    {detail?.ai_summary && (
                                      <div className="rounded-lg border bg-background p-3">
                                        <div className="mb-1 flex items-center gap-1.5 text-sm font-medium">
                                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                                          Summary
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                          {detail.ai_summary}
                                        </p>
                                      </div>
                                    )}

                                    <div>
                                      <div className="mb-1 text-sm font-medium">Filing history</div>
                                      {detailLoading === v.vendor_id && !detail ? (
                                        <p className="text-xs text-muted-foreground">Loading…</p>
                                      ) : detail && detail.filing_history.length > 0 ? (
                                        <div className="overflow-x-auto rounded-md border bg-background">
                                          <Table>
                                            <TableHeader>
                                              <TableRow>
                                                <TableHead className="text-xs">Period</TableHead>
                                                <TableHead className="text-xs">Filed</TableHead>
                                                <TableHead className="text-xs">Filed On</TableHead>
                                                <TableHead className="text-xs text-center">
                                                  Days vs cutoff
                                                </TableHead>
                                                <TableHead className="text-xs text-center">
                                                  Invoices
                                                </TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {detail.filing_history.map((h) => (
                                                <TableRow key={h.tax_period}>
                                                  <TableCell className="font-mono text-xs">
                                                    {h.tax_period.slice(0, 2)}/{h.tax_period.slice(2)}
                                                  </TableCell>
                                                  <TableCell className="text-xs">
                                                    {h.gstr1_filed === null
                                                      ? "—"
                                                      : h.gstr1_filed
                                                        ? "Yes"
                                                        : "No"}
                                                  </TableCell>
                                                  <TableCell className="text-xs">
                                                    {h.gstr1_filed_at ?? "—"}
                                                  </TableCell>
                                                  <TableCell className="text-center text-xs">
                                                    {h.days_past_cutoff === null
                                                      ? "—"
                                                      : h.days_past_cutoff > 0
                                                        ? `+${h.days_past_cutoff}`
                                                        : h.days_past_cutoff}
                                                  </TableCell>
                                                  <TableCell className="text-center text-xs">
                                                    {h.invoice_count ?? "—"}
                                                  </TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground">
                                          No filing history recorded yet.
                                        </p>
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
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)}{" "}
                  of {filtered.length} vendors
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
