import { useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ReconcileInputs,
  useReconcileInputs,
} from "@/components/reconciliation/ReconcileInputs";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import {
  createCheck,
  createCheckFromGsp,
  type Gstr2bVariant,
} from "@/lib/api";
import { Loader2, ArrowRight, CalendarCheck } from "lucide-react";

interface RerunReconcileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodId: string;
  taxPeriod: string;
  onSuccess: () => void;
}

function formatTaxPeriod(tp: string): string {
  return `${tp.slice(0, 2)}/${tp.slice(2)}`;
}

export function RerunReconcileDialog({
  open,
  onOpenChange,
  periodId,
  taxPeriod,
  onSuccess,
}: RerunReconcileDialogProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isReconciling, setIsReconciling] = useState(false);

  const gstr2bVariant: Gstr2bVariant = "corrected";

  const inputs = useReconcileInputs({
    variant: gstr2bVariant,
    onError: (err) =>
      toast.error(friendlyError(err, { fallback: "Couldn't fetch GSTR-2B. Try again in a moment." })),
  });

  const handleReconcile = async () => {
    const { ledgerFile, gstr2bFile, gstr2bSource } = await inputs.resolveFiles();
    const hasGstr2bInput = gstr2bSource === "gsp" || gstr2bFile;
    if (!ledgerFile && !hasGstr2bInput) return;

    setIsReconciling(true);
    try {
      const check =
        gstr2bSource === "gsp"
          ? await createCheckFromGsp(periodId, ledgerFile, gstr2bVariant)
          : await createCheck(periodId, ledgerFile, gstr2bFile);
      toast.success("Reconciliation re-run complete.");
      onOpenChange(false);
      // Navigate before refresh so `load` reads the new checkId from the URL.
      navigate(`/reconcile/${periodId}/${check.id}`);
      onSuccess();
    } catch (err) {
      toast.error(friendlyError(err, { fallback: "Couldn't re-run the reconciliation. Please try again." }));
    } finally {
      setIsReconciling(false);
    }
  };

  // Enable only once something is actually staged — a ledger (upload/Tally), an
  // uploaded 2B, or a completed GSP fetch. Merely having the (default) Fetch tab
  // selected is not enough, so re-run can't fire with nothing provided.
  const hasGstr2bData =
    inputs.gstr2bFiles.length > 0 ||
    (inputs.gstr2bSource === "gsp" && (inputs.gspCount ?? 0) > 0);
  const canReconcile = (inputs.hasLedger || hasGstr2bData) && !isReconciling;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Re-run Reconciliation</DialogTitle>
          <DialogDescription>
            Re-run this period with updated data — upload a file or fetch GSTR-2B to
            continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="rounded-lg bg-muted/50 px-4 py-3 flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm">
              Re-running for tax period{" "}
              <Badge variant="secondary" className="text-xs font-mono">
                {formatTaxPeriod(taxPeriod)}
              </Badge>
            </span>
          </div>

          <ReconcileInputs controller={inputs} layout="grid" showHint={false} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canReconcile} onClick={handleReconcile} className="gap-2">
            {isReconciling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Reconciling...
              </>
            ) : (
              <>
                Re-run
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
