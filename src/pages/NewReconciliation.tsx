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
import { getMultiFilePreviewRows, mergeFiles } from "@/lib/parser";
import {
  fetchClients,
  createClient,
  fetchPeriods,
  createPeriod,
  createCheck,
  createCheckFromGsp,
} from "@/lib/api";
import type { Period } from "@/types";
import { Loader2, ArrowRight, Upload, Globe, Server, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type LedgerSource = "tally" | "upload";
type Gstr2bSource = "upload" | "gsp";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function currentTaxPeriod(): string {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}${now.getFullYear()}`;
}

function formatTaxPeriod(tp: string): string {
  return `${tp.slice(0, 2)}/${tp.slice(2)}`;
}

function formatMonthLabel(mmyyyy: string): string {
  const mm = parseInt(mmyyyy.slice(0, 2));
  const yyyy = mmyyyy.slice(2);
  return `${MONTH_NAMES[mm - 1]} ${yyyy}`;
}

interface DateRange {
  from: string; // MMYYYY
  to: string;   // MMYYYY
  fromDate?: string; // YYYY-MM-DD
  toDate?: string;   // YYYY-MM-DD
}

/** Extract all dates from preview rows and return the month range. */
function inferDateRange(rows: Record<string, unknown>[]): DateRange | null {
  if (rows.length === 0) return null;

  const datePatterns = [
    /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
    /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
  ];

  const allDates: Date[] = [];

  for (const row of rows) {
    for (const val of Object.values(row)) {
      const str = String(val ?? "");
      for (const pattern of datePatterns) {
        const match = str.match(pattern);
        if (match) {
          let dd: number, mm: number, yyyy: number;
          if (pattern === datePatterns[1]) {
            yyyy = parseInt(match[1]);
            mm = parseInt(match[2]);
            dd = parseInt(match[3]);
          } else {
            dd = parseInt(match[1]);
            mm = parseInt(match[2]);
            yyyy = parseInt(match[3]);
          }
          if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && yyyy >= 2000) {
            allDates.push(new Date(yyyy, mm - 1, dd));
          }
          break;
        }
      }
    }
  }

  if (allDates.length === 0) return null;

  allDates.sort((a, b) => a.getTime() - b.getTime());
  const earliest = allDates[0];
  const latest = allDates[allDates.length - 1];

  const fromMM = `${String(earliest.getMonth() + 1).padStart(2, "0")}${earliest.getFullYear()}`;
  const toMM = `${String(latest.getMonth() + 1).padStart(2, "0")}${latest.getFullYear()}`;

  return {
    from: fromMM,
    to: toMM,
    fromDate: `${earliest.getFullYear()}-${String(earliest.getMonth() + 1).padStart(2, "0")}-${String(earliest.getDate()).padStart(2, "0")}`,
    toDate: `${latest.getFullYear()}-${String(latest.getMonth() + 1).padStart(2, "0")}-${String(latest.getDate()).padStart(2, "0")}`,
  };
}

export default function NewReconciliation() {
  const navigate = useNavigate();
  const [clientId, setClientId] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupGstin, setSetupGstin] = useState("");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [taxPeriod, setTaxPeriod] = useState(currentTaxPeriod());
  const [inferredRange, setInferredRange] = useState<DateRange | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);

  const [ledgerSource, setLedgerSource] = useState<LedgerSource>("tally");
  const [ledgerFiles, setLedgerFiles] = useState<File[]>([]);
  const [tallyImportedFile, setTallyImportedFile] = useState<File | null>(null);

  const [gstr2bFiles, setGstr2bFiles] = useState<File[]>([]);
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

  const updateInference = useCallback(
    (allRows: Record<string, unknown>[]) => {
      const range = inferDateRange(allRows);
      if (range) {
        setInferredRange(range);
        setTaxPeriod(range.from);
      }
    },
    [],
  );

  const handleLedgerFilesChange = useCallback(
    async (files: File[]) => {
      setLedgerFiles(files);
      setError(null);
      if (files.length === 0) {
        setLedgerPreview([]);
        return;
      }
      const preview = await getMultiFilePreviewRows(files);
      setLedgerPreview(preview);
      updateInference(preview);
    },
    [updateInference],
  );

  const handleTallyFile = useCallback((file: File) => {
    setTallyImportedFile(file);
    setError(null);
  }, []);

  const handleGstr2bFilesChange = useCallback(
    async (files: File[]) => {
      setGstr2bFiles(files);
      setError(null);
      if (files.length === 0) {
        setGstr2bPreview([]);
        return;
      }
      const preview = await getMultiFilePreviewRows(files);
      setGstr2bPreview(preview);
      if (!inferredRange) updateInference(preview);
    },
    [updateInference, inferredRange],
  );

  const handleReconcile = async () => {
    if (!clientId) return;

    const effectiveLedgerFile =
      ledgerSource === "tally" ? tallyImportedFile : (ledgerFiles.length > 0 ? await mergeFiles(ledgerFiles) : null);
    const effectiveGstr2bFile =
      gstr2bSource === "gsp" ? null : (gstr2bFiles.length > 0 ? await mergeFiles(gstr2bFiles) : null);

    const hasGstr2bInput = gstr2bSource === "gsp" || effectiveGstr2bFile;
    if (!effectiveLedgerFile && !hasGstr2bInput) return;

    setIsReconciling(true);
    setError(null);
    try {
      const period = await createPeriod(
        clientId,
        taxPeriod,
        inferredRange?.fromDate,
        inferredRange?.toDate,
      );
      const check =
        gstr2bSource === "gsp"
          ? await createCheckFromGsp(period.id, effectiveLedgerFile)
          : await createCheck(period.id, effectiveLedgerFile, effectiveGstr2bFile);
      navigate(`/reconcile/${period.id}/${check.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run reconciliation");
    } finally {
      setIsReconciling(false);
    }
  };

  const hasLedger = ledgerSource === "tally" ? !!tallyImportedFile : ledgerFiles.length > 0;
  const hasGstr2b = gstr2bSource === "gsp" || gstr2bFiles.length > 0;
  const canReconcile = !loadingContext && (hasLedger || hasGstr2b) && !isReconciling;

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

  const rangeLabel = inferredRange
    ? inferredRange.from === inferredRange.to
      ? formatMonthLabel(inferredRange.from)
      : `${formatMonthLabel(inferredRange.from)} — ${formatMonthLabel(inferredRange.to)}`
    : null;

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
                        setInferredRange(null);
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
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  value={taxPeriod}
                  onChange={(e) => {
                    setTaxPeriod(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setInferredRange(null);
                  }}
                  placeholder={currentTaxPeriod()}
                  className="max-w-[160px] font-mono"
                />
                {rangeLabel && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <CalendarCheck className="h-3 w-3" />
                    {rangeLabel}
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
                Upload Files
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

            <p className="text-xs text-muted-foreground">
              You can upload either file on its own, or both together — re-uploading
              later in the same period lets you see what changed since the last check.
              Multiple files per section will be merged automatically.
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
