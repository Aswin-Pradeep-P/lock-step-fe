import { useState, useMemo } from "react";
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
import { sendVendorNudge } from "@/lib/api";
import type { ReconciledRecord, NudgeChannel } from "@/types";
import {
  Mail,
  MessageCircle,
  Copy,
  Send,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

interface NudgeVendorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: ReconciledRecord;
  runId: string;
  onRecordUpdate: (updated: ReconciledRecord) => void;
}

function buildEmailSubject(record: ReconciledRecord): string {
  return `Action Required — Invoice ${record.invoiceNo} missing from GSTR-1`;
}

function buildEmailBody(record: ReconciledRecord): string {
  return `Dear ${record.supplierName},

Our records indicate that Invoice ${record.invoiceNo} dated ${record.invoiceDate} (Taxable Value: ${formatCurrency(record.taxableValue)}, Tax: ${formatCurrency(record.totalTax)}) has not been reported in your GSTR-1 filing for the relevant period.

This discrepancy prevents us from claiming Input Tax Credit (ITC) of ${formatCurrency(record.totalTax)} under GST regulations.

We request you to please:
1. Verify the invoice details in your records
2. File/amend your GSTR-1 to include this invoice
3. Confirm once the filing is updated

Please note that as per Section 16(2) of the CGST Act, ITC can only be claimed when the supplier has filed their return. Continued non-compliance may result in payment holds as per our vendor compliance policy.

We would appreciate your prompt action on this matter within 7 business days.

Regards,
Accounts & Compliance Team
Acme Trading Co`;
}

function buildWhatsAppMessage(record: ReconciledRecord): string {
  return `Hi ${record.supplierName},

This is regarding Invoice *${record.invoiceNo}* dated ${record.invoiceDate} (Tax: ${formatCurrency(record.totalTax)}).

This invoice is *not appearing in your GSTR-1* filing, which blocks our ITC claim.

Could you please check and update your GSTR-1 at the earliest? We need this resolved within 7 days to process your payment.

Thanks,
Acme Trading Co — Finance Team`;
}

export function NudgeVendorModal({
  open,
  onOpenChange,
  record,
  runId,
  onRecordUpdate,
}: NudgeVendorModalProps) {
  const [channel, setChannel] = useState<NudgeChannel>("email");
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const defaultEmail = useMemo(() => buildEmailBody(record), [record]);
  const defaultWhatsApp = useMemo(() => buildWhatsAppMessage(record), [record]);
  const emailSubject = useMemo(() => buildEmailSubject(record), [record]);

  const [emailBody, setEmailBody] = useState(defaultEmail);
  const [whatsAppBody, setWhatsAppBody] = useState(defaultWhatsApp);

  const currentMessage = channel === "email" ? emailBody : whatsAppBody;

  const handleCopy = async () => {
    const text =
      channel === "email"
        ? `Subject: ${emailSubject}\n\n${emailBody}`
        : whatsAppBody;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      const updated = await sendVendorNudge(
        runId,
        record.id,
        channel,
        currentMessage,
      );
      onRecordUpdate(updated);
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to send nudge:", err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nudge Vendor</DialogTitle>
          <DialogDescription>
            Send a compliance reminder to{" "}
            <span className="font-medium text-foreground">
              {record.supplierName}
            </span>{" "}
            about Invoice {record.invoiceNo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice</span>
              <span className="font-mono font-medium">{record.invoiceNo}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span>{record.invoiceDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax at Risk</span>
              <span className="font-medium text-risk-critical">
                {formatCurrency(record.totalTax)}
              </span>
            </div>
            {record.gstin && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">GSTIN</span>
                <span className="font-mono">{record.gstin}</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Channel
            </label>
            <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
              <button
                onClick={() => setChannel("email")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  channel === "email"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Mail className="h-3.5 w-3.5" />
                Email
              </button>
              <button
                onClick={() => setChannel("whatsapp")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  channel === "whatsapp"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </button>
            </div>
          </div>

          {channel === "email" && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Subject
              </label>
              <Input value={emailSubject} readOnly className="text-sm bg-muted/30" />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              Message
            </label>
            <Textarea
              value={channel === "email" ? emailBody : whatsAppBody}
              onChange={(e) =>
                channel === "email"
                  ? setEmailBody(e.target.value)
                  : setWhatsAppBody(e.target.value)
              }
              rows={channel === "email" ? 12 : 8}
              className="text-sm font-mono leading-relaxed"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              You can edit the message before sending or copying.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5"
          >
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
          <Button
            size="sm"
            onClick={handleSend}
            disabled={isSending}
            className="gap-1.5"
          >
            {isSending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Send {channel === "email" ? "Email" : "WhatsApp"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
