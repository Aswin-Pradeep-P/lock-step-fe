import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { FileUploader } from "@/components/reconciliation/FileUploader";
import { FilePreview } from "@/components/reconciliation/FilePreview";
import { TallyConnect } from "@/components/reconciliation/TallyConnect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseFile, getPreviewRows } from "@/lib/parser";
import { submitReconciliation } from "@/lib/api";
import type { PurchaseRecord, GSTR2BRecord } from "@/types";
import { Loader2, ArrowRight, Upload, Server, Globe, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type PurchaseSource = "upload" | "tally";
type Gstr2bSource = "upload" | "portal";

export default function NewReconciliation() {
  const navigate = useNavigate();
  const [purchaseSource, setPurchaseSource] = useState<PurchaseSource>("upload");
  const [gstr2bSource, setGstr2bSource] = useState<Gstr2bSource>("upload");
  const [purchaseFile, setPurchaseFile] = useState<File | null>(null);
  const [gstr2bFile, setGstr2bFile] = useState<File | null>(null);
  const [purchasePreview, setPurchasePreview] = useState<
    Record<string, unknown>[]
  >([]);
  const [gstr2bPreview, setGstr2bPreview] = useState<
    Record<string, unknown>[]
  >([]);
  const [tallyRecords, setTallyRecords] = useState<PurchaseRecord[] | null>(
    null
  );
  const [isReconciling, setIsReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePurchaseFile = useCallback(async (file: File) => {
    setPurchaseFile(file);
    setError(null);
    try {
      const preview = await getPreviewRows(file, "purchase");
      setPurchasePreview(preview);
    } catch {
      setPurchasePreview([]);
    }
  }, []);

  const handleGstr2bFile = useCallback(async (file: File) => {
    setGstr2bFile(file);
    setError(null);
    try {
      const preview = await getPreviewRows(file, "gstr2b");
      setGstr2bPreview(preview);
    } catch {
      setGstr2bPreview([]);
    }
  }, []);

  const handleTallyRecords = useCallback((records: PurchaseRecord[]) => {
    setTallyRecords(records.length > 0 ? records : null);
    setError(null);
  }, []);

  const handleSourceSwitch = (source: PurchaseSource) => {
    setPurchaseSource(source);
    setError(null);
    if (source === "tally") {
      setPurchaseFile(null);
      setPurchasePreview([]);
    } else {
      setTallyRecords(null);
    }
  };

  const handleReconcile = async () => {
    const hasPurchaseData =
      purchaseSource === "tally"
        ? tallyRecords && tallyRecords.length > 0
        : purchaseFile !== null;

    if (!hasPurchaseData || !gstr2bFile) return;

    setIsReconciling(true);
    setError(null);

    try {
      let purchaseRecords: PurchaseRecord[];

      if (purchaseSource === "tally") {
        purchaseRecords = tallyRecords!;
      } else {
        purchaseRecords = (await parseFile(
          purchaseFile!,
          "purchase"
        )) as PurchaseRecord[];
      }

      const gstr2bRecords = (await parseFile(
        gstr2bFile,
        "gstr2b"
      )) as GSTR2BRecord[];

      if (purchaseRecords.length === 0) {
        setError(
          "No valid records found in the purchase register. Check the file format and contents."
        );
        return;
      }
      if (gstr2bRecords.length === 0) {
        setError(
          "No valid records found in the GSTR-2B file. Check the file format and contents."
        );
        return;
      }

      const purchaseFileName =
        purchaseSource === "tally"
          ? "TallyPrime Import"
          : purchaseFile!.name;

      const run = await submitReconciliation({
        purchaseRecords,
        gstr2bRecords,
        purchaseFileName,
        gstr2bFileName: gstr2bFile.name,
      });

      navigate(`/reconcile/${run.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to run reconciliation"
      );
    } finally {
      setIsReconciling(false);
    }
  };

  const hasPurchaseData =
    purchaseSource === "tally"
      ? tallyRecords && tallyRecords.length > 0
      : purchaseFile !== null;

  const canReconcile = hasPurchaseData && gstr2bFile && !isReconciling;

  return (
    <div>
      <Header title="New Reconciliation" />

      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Purchase Register
              </label>

              <div className="flex gap-1 mb-3 p-1 rounded-lg bg-muted w-fit">
                <button
                  onClick={() => handleSourceSwitch("upload")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    purchaseSource === "upload"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload File
                </button>
                <button
                  onClick={() => handleSourceSwitch("tally")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    purchaseSource === "tally"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Server className="h-3.5 w-3.5" />
                  Connect to Tally
                </button>
              </div>

              {purchaseSource === "upload" ? (
                <FileUploader
                  label="Upload Purchase Register"
                  description="Tally IGST / CGST+SGST export — XLSX or CSV"
                  accept=".xlsx,.xls,.csv"
                  file={purchaseFile}
                  onFileSelect={handlePurchaseFile}
                  onFileClear={() => {
                    setPurchaseFile(null);
                    setPurchasePreview([]);
                  }}
                />
              ) : (
                <TallyConnect
                  onRecordsImported={handleTallyRecords}
                  importedCount={tallyRecords?.length ?? null}
                />
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                GSTR-2B Data
              </label>

              <div className="flex gap-1 mb-3 p-1 rounded-lg bg-muted w-fit">
                <button
                  onClick={() => setGstr2bSource("upload")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    gstr2bSource === "upload"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload File
                </button>
                <button
                  onClick={() => setGstr2bSource("portal")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    gstr2bSource === "portal"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Globe className="h-3.5 w-3.5" />
                  Fetch from GST Portal
                </button>
              </div>

              {gstr2bSource === "upload" ? (
                <FileUploader
                  label="Upload GSTR-2B"
                  description="Government portal download — XLSX or CSV"
                  accept=".xlsx,.xls,.csv"
                  file={gstr2bFile}
                  onFileSelect={handleGstr2bFile}
                  onFileClear={() => {
                    setGstr2bFile(null);
                    setGstr2bPreview([]);
                  }}
                />
              ) : (
                <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-6">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="rounded-full bg-muted p-3">
                      <Lock className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <p className="text-sm font-medium">
                          GST Portal Integration
                        </p>
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          COMING SOON
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        Auto-fetch GSTR-2B directly from the GST Portal via
                        GSP API (Sandbox.co.in). Requires GSTIN authentication
                        with OTP verification.
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/50 px-4 py-3 text-xs text-muted-foreground w-full max-w-sm text-left space-y-1.5 mt-1">
                      <p className="font-medium text-foreground/70">
                        How it will work:
                      </p>
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-[10px] bg-muted rounded px-1 py-0.5 mt-0.5 shrink-0">
                          1
                        </span>
                        <span>Enter your GSTIN and portal username</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-[10px] bg-muted rounded px-1 py-0.5 mt-0.5 shrink-0">
                          2
                        </span>
                        <span>Verify with OTP sent to your registered mobile</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="font-mono text-[10px] bg-muted rounded px-1 py-0.5 mt-0.5 shrink-0">
                          3
                        </span>
                        <span>
                          Select the return period — GSTR-2B data loads
                          automatically
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {purchaseSource === "upload" && purchasePreview.length > 0 && (
          <FilePreview rows={purchasePreview} title="Purchase Register" />
        )}
        {gstr2bSource === "upload" && gstr2bPreview.length > 0 && (
          <FilePreview rows={gstr2bPreview} title="GSTR-2B" />
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <Button
            size="lg"
            disabled={!canReconcile}
            onClick={handleReconcile}
            className="gap-2"
          >
            {isReconciling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Reconciling...
              </>
            ) : (
              <>
                Reconcile
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
