import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { FileUploader } from "@/components/reconciliation/FileUploader";
import { FilePreview } from "@/components/reconciliation/FilePreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCsvPreviewRows } from "@/lib/parser";
import {
  fetchClients,
  createClient,
  fetchPeriods,
  createPeriod,
  createCheck,
  createCheckFromGsp,
} from "@/lib/api";
import type { Period } from "@/types";
import { Loader2, ArrowRight, Upload, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

type Gstr2bSource = "upload" | "gsp";

/** Current tax period as MMYYYY — mirrors lockstep.services.periods.tax_period_for. */
function currentTaxPeriod(): string {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}${now.getFullYear()}`;
}

function formatTaxPeriod(tp: string): string {
  return `${tp.slice(0, 2)}/${tp.slice(2)}`;
}

export default function NewReconciliation() {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupGstin, setSetupGstin] = useState("");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [taxPeriod, setTaxPeriod] = useState(currentTaxPeriod());
  const [loadingContext, setLoadingContext] = useState(true);

  const [ledgerFile, setLedgerFile] = useState<File | null>(null);
  const [gstr2bFile, setGstr2bFile] = useState<File | null>(null);
  const [gstr2bSource, setGstr2bSource] = useState<Gstr2bSource>("upload");
  const [ledgerPreview, setLedgerPreview] = useState<Record<string, unknown>[]>([]);
  const [gstr2bPreview, setGstr2bPreview] = useState<Record<string, unknown>[]>([]);
  const [isReconciling, setIsReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPeriodsFor = useCallback(async (id: string) => {
    const existingPeriods = await fetchPeriods(id);
    setPeriods(existingPeriods);
    if (existingPeriods.length > 0) setTaxPeriod(existingPeriods[0].tax_period);
  }, []);

  useEffect(() => {
    async function loadContext() {
      try {
        const clients = await fetchClients();
        if (clients.length === 0) {
          setNeedsSetup(true);
          return;
        }
        setClientId(clients[0].id);
        await loadPeriodsFor(clients[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load account context");
      } finally {
        setLoadingContext(false);
      }
    }
    loadContext();
  }, [loadPeriodsFor]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const client = await createClient(setupName, setupGstin);
      setClientId(client.id);
      setNeedsSetup(false);
      await loadPeriodsFor(client.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set up your company");
    } finally {
      setLoadingContext(false);
    }
  };

  const handleLedgerFile = useCallback(async (file: File) => {
    setLedgerFile(file);
    setError(null);
    setLedgerPreview(await getCsvPreviewRows(file).catch(() => []));
  }, []);

  const handleGstr2bFile = useCallback(async (file: File) => {
    setGstr2bFile(file);
    setError(null);
    setGstr2bPreview(await getCsvPreviewRows(file).catch(() => []));
  }, []);

  const handleReconcile = async () => {
    if (!clientId) return;
    const hasGstr2bInput = gstr2bSource === "gsp" || gstr2bFile;
    if (!ledgerFile && !hasGstr2bInput) return;

    setIsReconciling(true);
    setError(null);
    try {
      const period = await createPeriod(clientId, taxPeriod);
      const check =
        gstr2bSource === "gsp"
          ? await createCheckFromGsp(period.id, ledgerFile)
          : await createCheck(period.id, ledgerFile, gstr2bFile);
      navigate(`/reconcile/${period.id}/${check.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run reconciliation");
    } finally {
      setIsReconciling(false);
    }
  };

  const canReconcile =
    !loadingContext &&
    (ledgerFile || gstr2bFile || gstr2bSource === "gsp") &&
    !isReconciling;

  if (needsSetup) {
    return (
      <div>
        <Header title="New Reconciliation" />
        <div className="p-6 lg:p-8 max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Set up your company</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSetup} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Legal name</label>
                  <Input
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">GSTIN</label>
                  <Input
                    value={setupGstin}
                    onChange={(e) => setSetupGstin(e.target.value.toUpperCase())}
                    className="font-mono"
                    maxLength={15}
                    required
                  />
                </div>
                {error && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <Button type="submit" className="w-full">
                  Continue
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="New Reconciliation" />

      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tax Period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {periods.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Re-run against an existing period
                </label>
                <div className="flex flex-wrap gap-2">
                  {periods.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setTaxPeriod(p.tax_period)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                        taxPeriod === p.tax_period
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-input hover:bg-muted"
                      }`}
                    >
                      {formatTaxPeriod(p.tax_period)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Or a new period (MMYYYY)
              </label>
              <Input
                value={taxPeriod}
                onChange={(e) => setTaxPeriod(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder={currentTaxPeriod()}
                className="max-w-[160px] font-mono"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Purchase Register</label>
              <FileUploader
                label="Upload Purchase Register"
                description="Tally IGST / CGST+SGST export — XLSX or CSV"
                accept=".xlsx,.xls,.csv"
                file={ledgerFile}
                onFileSelect={handleLedgerFile}
                onFileClear={() => {
                  setLedgerFile(null);
                  setLedgerPreview([]);
                }}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">GSTR-2B Data</label>

              <div className="flex gap-1 mb-3 p-1 rounded-lg bg-muted w-fit">
                <button
                  onClick={() => setGstr2bSource("upload")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    gstr2bSource === "upload"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload File
                </button>
                <button
                  onClick={() => setGstr2bSource("gsp")}
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
                <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-muted p-2 shrink-0">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        Will be fetched by your GSTIN for this tax period
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        No file needed — GSTR-2B comes from a GSP (GST Suvidha
                        Provider) API call instead of a manual download. This
                        deployment isn't connected to a live GSP subscription yet, so
                        it currently returns a fixed sandbox sample rather than your
                        real data — useful for testing the flow end to end before a
                        real key is wired in.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              You can upload either file on its own, or both together — re-uploading
              later in the same period lets you see what changed since the last check.
            </p>
          </CardContent>
        </Card>

        {ledgerPreview.length > 0 && (
          <FilePreview rows={ledgerPreview} title="Purchase Register" />
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
          <Button size="lg" disabled={!canReconcile} onClick={handleReconcile} className="gap-2">
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
