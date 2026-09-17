import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { bulkNudgeVendors } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { canNudgeVendor } from "@/lib/risk";
import { formatCurrency } from "@/lib/utils";
import type { Invoice } from "@/types";
import { Loader2, Send, Mail } from "lucide-react";

export interface VendorNudgeRow {
  vendorId: string;
  vendorName: string;
  gstin: string | null;
  invoiceCount: number;
  totalAmount: number;
}

interface BulkNudgeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: Invoice[];
  periodId: string;
  checkId?: string;
  onSent: () => void;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function groupNudgeableVendors(invoices: Invoice[]): VendorNudgeRow[] {
  const map = new Map<string, VendorNudgeRow>();
  for (const inv of invoices) {
    if (!canNudgeVendor(inv) || !inv.vendor_id) continue;
    const existing = map.get(inv.vendor_id);
    if (existing) {
      existing.invoiceCount += 1;
      existing.totalAmount += Number(inv.total_tax);
    } else {
      map.set(inv.vendor_id, {
        vendorId: inv.vendor_id,
        vendorName: inv.vendor_name ?? "Unknown vendor",
        gstin: inv.vendor_gstin,
        invoiceCount: 1,
        totalAmount: Number(inv.total_tax),
      });
    }
  }
  return [...map.values()].sort((a, b) => b.totalAmount - a.totalAmount);
}

export function BulkNudgeDialog({
  open,
  onOpenChange,
  invoices,
  periodId,
  checkId,
  onSent,
}: BulkNudgeDialogProps) {
  const { toast } = useToast();
  const vendors = useMemo(() => groupNudgeableVendors(invoices), [invoices]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(vendors.map((v) => v.vendorId)));
  }, [open, vendors]);

  const selectedVendors = vendors.filter((v) => selected.has(v.vendorId));
  const selectedInvoiceCount = selectedVendors.reduce((s, v) => s + v.invoiceCount, 0);
  const allSelected = vendors.length > 0 && selected.size === vendors.length;

  const toggle = (vendorId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(vendorId)) next.delete(vendorId);
      else next.add(vendorId);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(vendors.map((v) => v.vendorId)));
  };

  const handleConfirm = async () => {
    if (selected.size === 0 || isSending) return;
    const vendorIds = [...selected];

    // Hide the vendor list immediately, then show the sending overlay.
    onOpenChange(false);
    setIsSending(true);

    const started = Date.now();
    try {
      const result = await bulkNudgeVendors(periodId, {
        vendor_ids: vendorIds,
        check_id: checkId,
        channel: "email",
      });
      const remaining = Math.max(0, 1000 - (Date.now() - started));
      await sleep(remaining);

      setIsSending(false);
      toast.success(
        `Emails sent to ${result.nudged_vendors} vendor${result.nudged_vendors === 1 ? "" : "s"} · ${result.nudged_invoices} invoice${result.nudged_invoices === 1 ? "" : "s"} logged.`,
      );
      onSent();
    } catch (err) {
      const remaining = Math.max(0, 1000 - (Date.now() - started));
      await sleep(remaining);
      setIsSending(false);
      toast.error(friendlyError(err, { fallback: "Couldn't nudge the selected vendors." }));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Nudge Vendors</DialogTitle>
            <DialogDescription>
              Select vendors to notify. A nudge is recorded on every at-risk invoice for
              each selected vendor.
            </DialogDescription>
          </DialogHeader>

          {vendors.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No nudgeable vendors in the current filter set.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-input"
                  />
                  {allSelected ? "Clear all" : "Select all"}
                </label>
                <span>
                  {selected.size} of {vendors.length} selected
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
                {vendors.map((v) => (
                  <label
                    key={v.vendorId}
                    className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(v.vendorId)}
                      onChange={() => toggle(v.vendorId)}
                      className="mt-1 h-4 w-4 rounded border-input"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{v.vendorName}</div>
                      {v.gstin && (
                        <div className="text-xs font-mono text-muted-foreground">{v.gstin}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {v.invoiceCount} invoice{v.invoiceCount === 1 ? "" : "s"} ·{" "}
                        {formatCurrency(v.totalAmount)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  className="gap-2"
                  disabled={selected.size === 0}
                  onClick={handleConfirm}
                >
                  <Send className="h-4 w-4" />
                  Nudge {selected.size} vendor{selected.size === 1 ? "" : "s"} (
                  {selectedInvoiceCount} invoice{selectedInvoiceCount === 1 ? "" : "s"})
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Sending overlay — shown after vendor dialog closes */}
      <Dialog open={isSending} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-sm [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="rounded-full bg-primary/10 p-3">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-base">Sending emails to vendors</DialogTitle>
              <DialogDescription>
                Logging nudges on every at-risk invoice…
              </DialogDescription>
            </div>
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
