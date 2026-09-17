import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import { FileUploader } from "@/components/reconciliation/FileUploader";
import { FilePreview } from "@/components/reconciliation/FilePreview";
import { TallyConnect } from "@/components/reconciliation/TallyConnect";
import {
  createCheck,
  createCheckFromGsp,
  fetchGstr2b,
  flattenGstr2bPreview,
  type Gstr2bVariant,
  type Gstr2bDefects,
} from "@/lib/api";
import { getMultiFilePreviewRows, mergeFiles } from "@/lib/parser";
import {
  Loader2,
  ArrowRight,
  Upload,
  Globe,
  Server,
  Download,
  CalendarCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type LedgerSource = "tally" | "upload";
type Gstr2bSource = "upload" | "gsp";

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

  const [ledgerSource, setLedgerSource] = useState<LedgerSource>("tally");
  const [ledgerFiles, setLedgerFiles] = useState<File[]>([]);
  const [tallyImportedFile, setTallyImportedFile] = useState<File | null>(null);

  const [gstr2bFiles, setGstr2bFiles] = useState<File[]>([]);
  const [gstr2bSource, setGstr2bSource] = useState<Gstr2bSource>("upload");
  const gstr2bVariant: Gstr2bVariant = "corrected";
  const [ledgerPreview, setLedgerPreview] = useState<Record<string, unknown>[]>([]);
  const [gstr2bPreview, setGstr2bPreview] = useState<Record<string, unknown>[]>([]);
  const [gspPreview, setGspPreview] = useState<Record<string, unknown>[]>([]);
  const [gspCount, setGspCount] = useState<number | null>(null);
  const [gspDefects, setGspDefects] = useState<Gstr2bDefects | null>(null);
  const [isFetchingGsp, setIsFetchingGsp] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLedgerFilesChange = useCallback(async (files: File[]) => {
    setLedgerFiles(files);
    setError(null);
    if (files.length === 0) {
      setLedgerPreview([]);
      return;
    }
    const preview = await getMultiFilePreviewRows(files);
    setLedgerPreview(preview);
  }, []);

  const handleTallyFile = useCallback((file: File) => {
    setTallyImportedFile(file);
    setError(null);
  }, []);

  const handleGstr2bFilesChange = useCallback(async (files: File[]) => {
    setGstr2bFiles(files);
    setError(null);
    if (files.length === 0) {
      setGstr2bPreview([]);
      return;
    }
    const preview = await getMultiFilePreviewRows(files);
    setGstr2bPreview(preview);
  }, []);

  const handleGstr2bSourceSwitch = (source: Gstr2bSource) => {
    setGstr2bSource(source);
    setError(null);
    if (source === "gsp") {
      setGstr2bFiles([]);
      setGstr2bPreview([]);
    } else {
      setGspPreview([]);
      setGspCount(null);
      setGspDefects(null);
    }
  };

  const handleFetchGsp = async (variant: Gstr2bVariant = gstr2bVariant) => {
    setIsFetchingGsp(true);
    setError(null);
    try {
      const result = await fetchGstr2b(variant);
      setGspCount(result.count);
      setGspDefects(result.defects);
      setGspPreview(flattenGstr2bPreview(result.data).slice(0, 5));
    } catch (err) {
      setGspPreview([]);
      setGspCount(null);
      setGspDefects(null);
      setError(err instanceof Error ? err.message : "Failed to fetch GSTR-2B");
    } finally {
      setIsFetchingGsp(false);
    }
  };

  const handleClearGsp = () => {
    setGspPreview([]);
    setGspCount(null);
    setGspDefects(null);
  };

  const handleReconcile = async () => {
    const effectiveLedgerFile =
      ledgerSource === "tally"
        ? tallyImportedFile
        : ledgerFiles.length > 0
          ? await mergeFiles(ledgerFiles)
          : null;
    const effectiveGstr2bFile =
      gstr2bSource === "gsp"
        ? null
        : gstr2bFiles.length > 0
          ? await mergeFiles(gstr2bFiles)
          : null;

    const hasGstr2bInput = gstr2bSource === "gsp" || effectiveGstr2bFile;
    if (!effectiveLedgerFile && !hasGstr2bInput) return;

    setIsReconciling(true);
    setError(null);
    try {
      const check =
        gstr2bSource === "gsp"
          ? await createCheckFromGsp(periodId, effectiveLedgerFile, gstr2bVariant)
          : await createCheck(periodId, effectiveLedgerFile, effectiveGstr2bFile);
      onOpenChange(false);
      onSuccess();
      navigate(`/reconcile/${periodId}/${check.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run reconciliation");
    } finally {
      setIsReconciling(false);
    }
  };

  const hasLedger = ledgerSource === "tally" ? !!tallyImportedFile : ledgerFiles.length > 0;
  const hasGstr2b = gstr2bSource === "gsp" || gstr2bFiles.length > 0;
  const canReconcile = (hasLedger || hasGstr2b) && !isReconciling;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Re-run Reconciliation</DialogTitle>
          <DialogDescription>
            Upload updated files to re-run reconciliation for this period. At least one
            file must be provided.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Period info banner */}
          <div className="rounded-lg bg-muted/50 px-4 py-3 flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm">
              Re-running for tax period{" "}
              <Badge variant="secondary" className="text-xs font-mono">
                {formatTaxPeriod(taxPeriod)}
              </Badge>
            </span>
          </div>

          {/* Purchase Register */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Purchase Register</h4>
            <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
              <button
                onClick={() => setLedgerSource("tally")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  ledgerSource === "tally"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Server className="h-3.5 w-3.5" />
                Connect to Tally
              </button>
              <button
                onClick={() => setLedgerSource("upload")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  ledgerSource === "upload"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload Files
              </button>
            </div>

            {ledgerSource === "tally" ? (
              <TallyConnect
                onFileReady={handleTallyFile}
                importedCount={tallyImportedFile ? 1 : null}
              />
            ) : (
              <>
                <FileUploader
                  label="Upload Purchase Register"
                  description="Tally IGST / CGST+SGST export — XLSX or CSV"
                  accept=".xlsx,.xls,.csv"
                  files={ledgerFiles}
                  onFilesChange={handleLedgerFilesChange}
                />
                {ledgerPreview.length > 0 && (
                  <FilePreview rows={ledgerPreview} title="Purchase Register" />
                )}
              </>
            )}
          </div>

          {/* GSTR-2B */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">GSTR-2B Data</h4>
            <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
              <button
                onClick={() => handleGstr2bSourceSwitch("upload")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  gstr2bSource === "upload"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload Files
              </button>
              <button
                onClick={() => handleGstr2bSourceSwitch("gsp")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  gstr2bSource === "gsp"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Globe className="h-3.5 w-3.5" />
                Fetch from GST Portal
              </button>
            </div>

            {gstr2bSource === "upload" ? (
              <>
                <FileUploader
                  label="Upload GSTR-2B"
                  description="Government portal download — XLSX or CSV"
                  accept=".xlsx,.xls,.csv"
                  files={gstr2bFiles}
                  onFilesChange={handleGstr2bFilesChange}
                />
                {gstr2bPreview.length > 0 && (
                  <FilePreview rows={gstr2bPreview} title="GSTR-2B" />
                )}
              </>
            ) : gspCount !== null && gspCount > 0 ? (
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {gspCount} invoices imported from GSTR-2B
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Fetched from GST Portal
                    </p>
                    {gspDefects && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {gspDefects.exact} matched · {gspDefects.clerical} typos ·{" "}
                        {gspDefects.amount_mismatch} tax diffs ·{" "}
                        {gspDefects.missing_in_2b} not filed ·{" "}
                        {gspDefects.itc_ineligible} ITC blocked
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleClearGsp}>
                    Clear
                  </Button>
                </div>
                {gspPreview.length > 0 && (
                  <div className="mt-3">
                    <FilePreview rows={gspPreview} title="GSTR-2B" />
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-muted p-2 shrink-0">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      Will be fetched by your GSTIN for this tax period
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      No file needed — GSTR-2B comes from a GSP (GST Suvidha Provider) API
                      call. This deployment uses a sandbox sample.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => handleFetchGsp()}
                  disabled={isFetchingGsp}
                  className="w-full gap-2"
                >
                  {isFetchingGsp ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Fetching GSTR-2B...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Fetch GSTR-2B
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
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
