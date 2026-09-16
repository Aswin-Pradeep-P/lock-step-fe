import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchVendorEmailDraft, createInvoiceAction } from "@/lib/api";
import type { Invoice, VendorEmailDraft } from "@/types";
import { Mail, Copy, Send, Loader2, CheckCircle2, ShieldOff } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface NudgeVendorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  periodId: string;
  onSent: () => void;
}

export function NudgeVendorModal({
  open,
  onOpenChange,
  invoice,
  periodId,
  onSent,
}: NudgeVendorModalProps) {
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<VendorEmailDraft | null>(null);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !invoice.vendor_id) return;
    setLoading(true);
    setError(null);
    setSent(false);
    fetchVendorEmailDraft(invoice.vendor_id, periodId)
      .then((d) => {
        setDraft(d);
        setBody(d.body);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load draft"))
      .finally(() => setLoading(false));
  }, [open, invoice.vendor_id, periodId]);

  const handleCopy = async () => {
    const text = draft ? `Subject: ${draft.subject}\n\n${body}` : body;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!draft) return;
    setIsSending(true);
    try {
      await createInvoiceAction(invoice.id, "VENDOR_NOTIFIED", "email", {
        subject: draft.subject,
        body,
        to: draft.to,
      });
      setSent(true);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record the notification");
    } finally {
      setIsSending(false);
    }
  };

  // No vendor record at all — never even worth a network call.
  const vendorInfoMissing = !invoice.vendor_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nudge Vendor</DialogTitle>
          <DialogDescription>
            Compliance reminder about Invoice {invoice.invoice_number}
            {invoice.vendor_name ? ` — ${invoice.vendor_name}` : ""}
          </DialogDescription>
        </DialogHeader>

        {vendorInfoMissing ? (
          <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
            <ShieldOff className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Vendor info for reminder not present</p>
            <p className="text-xs text-muted-foreground">
              This invoice has no GSTIN and the vendor name couldn't be matched to
              anyone in your records — there's nowhere to send a reminder to.
            </p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : draft && !draft.can_send ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
              <ShieldOff className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">Vendor info for reminder not present</p>
              <p className="text-xs text-muted-foreground">{draft.reason}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Draft (for reference — copy and send manually if you have another
                way to reach them)
              </label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                {copied ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-risk-low" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : draft ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice</span>
                <span className="font-mono font-medium">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax at Risk</span>
                <span className="font-medium text-risk-critical">
                  {formatCurrency(Number(invoice.total_tax))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">To</span>
                <span className="font-mono flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {draft.to}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Subject
              </label>
              <Input value={draft.subject} readOnly className="text-sm bg-muted/30" />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Message
              </label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="text-sm font-mono leading-relaxed"
              />
            </div>

            {sent && (
              <div className="rounded-lg border border-risk-low/40 bg-risk-low/10 p-3 text-sm text-risk-low flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Logged as sent. This never blocks or holds payment — it's a record
                of the notification only.
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                {copied ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-risk-low" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
              <Button size="sm" onClick={handleSend} disabled={isSending || sent} className="gap-1.5">
                {isSending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Send Email
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
