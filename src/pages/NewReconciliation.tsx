import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { FileUploader } from "@/components/reconciliation/FileUploader";
import { FilePreview } from "@/components/reconciliation/FilePreview";
import { TallyConnect } from "@/components/reconciliation/TallyConnect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, ArrowRight, Upload, Globe, Server, Clock, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type LedgerSource = "tally" | "upload";
type Gstr2bSource = "upload" | "gsp" | "portal";

function currentTaxPeriod(): string {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}${now.getFullYear()}`;
}

function formatTaxPeriod(tp: string): string {
  return `${tp.slice(0, 2)}/${tp.slice(2)}`;
}

/** Try to infer MMYYYY from date values in CSV preview rows. */
function inferTaxPeriod(rows: Record<string, unknown>[]): string | null {
  if (rows.length === 0) return null;

  const datePatterns = [
    /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
    /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
  ];

  const monthCounts: Record<string, number> = {};

  for (const row of rows) {
    for (const val of Object.values(row)) {
      const str = String(val ?? "");
      for (const pattern of datePatterns) {
        const match = str.match(pattern);
        if (match) {
          let mm: string, yyyy: string;
          if (pattern === datePatterns[1]) {
            // YYYY-MM-DD
            yyyy = match[1];
            mm = match[2];
          } else {
            // DD/MM/YYYY or DD-MM-YYYY
            mm = match[2];
            yyyy = match[3];
          }
          const key = `${mm}${yyyy}`;
          monthCounts[key] = (monthCounts[key] || 0) + 1;
          break;
        }
      }
    }
  }

  const entries = Object.entries(monthCounts);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export default function NewReconciliation() {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupGstin, setSetupGstin] = useState("");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [taxPeriod, setTaxPeriod] = useState(currentTaxPeriod());
  const [taxPeriodInferred, setTaxPeriodInferred] = useState(false);
  const [loadingContext, setLoadingContext] = useState(true);

  const [ledgerSource, setLedgerSource] = useState<LedgerSource>("tally");
  const [ledgerFile, setLedgerFile] = useState<File | null>(null);
  const [tallyImportedCount, setTallyImportedCount] = useState<number | null>(null);

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

  const tryInferPeriod = useCallback((rows: Record<string, unknown>[]) => {
    const inferred = inferTaxPeriod(rows);
    if (inferred && inferred.length === 6) {
      setTaxPeriod(inferred);
      setTaxPeriodInferred(true);
    }
  }, []);

  const handleLedgerFile = useCallback(async (file: File) => {
    setLedgerFile(file);
    setError(null);
    const preview = await getCsvPreviewRows(file).catch(() => []);
    setLedgerPreview(preview);
    tryInferPeriod(preview);
  }, [tryInferPeriod]);

  const handleTallyFile = useCallback((file: File) => {
    setLedgerFile(file);
    setTallyImportedCount(1);
    setError(null);
  }, []);

  const handleGstr2bFile = useCallback(async (file: File) => {
    setGstr2bFile(file);
    setError(null);
    const preview = await getCsvPreviewRows(file).catch(() => []);
    setGstr2bPreview(preview);
    if (!taxPeriodInferred) tryInferPeriod(preview);
  }, [tryInferPeriod, taxPeriodInferred]);

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
        {/* Tax Period */}
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
                      onClick={() => {
                        setTaxPeriod(p.tax_period);
                        setTaxPeriodInferred(false);
                      }}
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
              <div className="flex items-center gap-2">
                <Input
                  value={taxPeriod}
                  onChange={(e) => {
                    setTaxPeriod(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setTaxPeriodInferred(false);
                  }}
                  placeholder={currentTaxPeriod()}
                  className="max-w-[160px] font-mono"
                />
                {taxPeriodInferred && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <CalendarCheck className="h-3 w-3" />
                    Detected from file
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Purchase Register */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Purchase Register</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                Upload File
              </button>
            </div>

            {ledgerSource === "tally" ? (
              <TallyConnect onFileReady={handleTallyFile} importedCount={tallyImportedCount} />
            ) : (
              <>
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
                {ledgerPreview.length > 0 && (
                  <FilePreview rows={ledgerPreview} title="Purchase Register" />
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* GSTR-2B */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">GSTR-2B Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
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
              <button
                onClick={() => setGstr2bSource("portal")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors relative",
                  gstr2bSource === "portal"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                Auto-Fetch
                <Badge className="absolute -top-2 -right-2 text-[8px] px-1 py-0" variant="secondary">
                  Soon
                </Badge>
              </button>
            </div>

            {gstr2bSource === "upload" ? (
              <>
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
                {gstr2bPreview.length > 0 && (
                  <FilePreview rows={gstr2bPreview} title="GSTR-2B" />
                )}
              </>
            ) : gstr2bSource === "gsp" ? (
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
            ) : (
              <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-muted p-2 shrink-0">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      GSTR-2B Auto-Fetch
                      <Badge variant="secondary">Coming Soon</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Automatically pull GSTR-2B data directly from the GST portal using your credentials.
                    </p>
                  </div>
                </div>
                <div className="space-y-3 pl-11">
                  <p className="text-xs font-medium text-muted-foreground">How it will work:</p>
                  <div className="space-y-2">
                    {[
                      { step: "1", text: "Connect your GST portal credentials (one-time setup)" },
                      { step: "2", text: "We authenticate via OTP to the GSP API on your behalf" },
                      { step: "3", text: "GSTR-2B is fetched automatically for the selected tax period" },
                      { step: "4", text: "Data is reconciled instantly — no file download needed" },
                    ].map((item) => (
                      <div key={item.step} className="flex items-start gap-2">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                          {item.step}
                        </div>
                        <p className="text-xs text-muted-foreground">{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              You can upload either file on its own, or both together — re-uploading
              later in the same period lets you see what changed since the last check.
            </p>
          </CardContent>
        </Card>

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
