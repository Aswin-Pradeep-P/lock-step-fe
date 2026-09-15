import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { FileUploader } from "@/components/reconciliation/FileUploader";
import { FilePreview } from "@/components/reconciliation/FilePreview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseFile, getPreviewRows } from "@/lib/parser";
import { submitReconciliation } from "@/lib/api";
import type { PurchaseRecord, GSTR2BRecord } from "@/types";
import { Loader2, ArrowRight } from "lucide-react";

export default function NewReconciliation() {
  const navigate = useNavigate();
  const [purchaseFile, setPurchaseFile] = useState<File | null>(null);
  const [gstr2bFile, setGstr2bFile] = useState<File | null>(null);
  const [purchasePreview, setPurchasePreview] = useState<
    Record<string, unknown>[]
  >([]);
  const [gstr2bPreview, setGstr2bPreview] = useState<
    Record<string, unknown>[]
  >([]);
  const [isReconciling, setIsReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePurchaseFile = useCallback(async (file: File) => {
    setPurchaseFile(file);
    setError(null);
    try {
      const preview = await getPreviewRows(file);
      setPurchasePreview(preview);
    } catch {
      setPurchasePreview([]);
    }
  }, []);

  const handleGstr2bFile = useCallback(async (file: File) => {
    setGstr2bFile(file);
    setError(null);
    try {
      const preview = await getPreviewRows(file);
      setGstr2bPreview(preview);
    } catch {
      setGstr2bPreview([]);
    }
  }, []);

  const handleReconcile = async () => {
    if (!purchaseFile || !gstr2bFile) return;

    setIsReconciling(true);
    setError(null);

    try {
      const [purchaseRecords, gstr2bRecords] = await Promise.all([
        parseFile(purchaseFile, "purchase") as Promise<PurchaseRecord[]>,
        parseFile(gstr2bFile, "gstr2b") as Promise<GSTR2BRecord[]>,
      ]);

      const run = await submitReconciliation({
        purchaseRecords,
        gstr2bRecords,
        purchaseFileName: purchaseFile.name,
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

  const canReconcile = purchaseFile && gstr2bFile && !isReconciling;

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
                Purchase Register (Tally Export)
              </label>
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
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                GSTR-2B Download
              </label>
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
            </div>
          </CardContent>
        </Card>

        {purchasePreview.length > 0 && (
          <FilePreview rows={purchasePreview} title="Purchase Register" />
        )}
        {gstr2bPreview.length > 0 && (
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
