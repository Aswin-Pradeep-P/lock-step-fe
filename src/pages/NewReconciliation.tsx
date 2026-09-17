import { useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  fetchGstr2b,
  flattenGstr2bPreview,
  type Gstr2bDefects,
  type Gstr2bVariant,
} from "@/lib/api";
import type { Period } from "@/types";
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
  from: string;
  to: string;
  fromDate?: string;
  toDate?: string;
}

function inferDateRange(rows: Record<string, unknown>[]): DateRange | null {
  if (rows.length === 0) return null;

  const datePatterns = [
    /(\d{2})\/(\d{2})\/(\d{4})/,
    /(\d{4})-(\d{2})-(\d{2})/,
    /(\d{2})-(\d{2})-(\d{4})/,
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
  const location = useLocation();
  const prefill = (location.state as { taxPeriod?: string; periodId?: string } | null) ?? null;
  const [clientId, setClientId] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupGstin, setSetupGstin] = useState("");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [taxPeriod, setTaxPeriod] = useState(prefill?.taxPeriod ?? currentTaxPeriod());
  const [inferredRange, setInferredRange] = useState<DateRange | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);

  const [ledgerSource, setLedgerSource] = useState<LedgerSource>("tally");
  const [ledgerFiles, setLedgerFiles] = useState<File[]>([]);
  const [tallyImportedFile, setTallyImportedFile] = useState<File | null>(null);

  const [gstr2bFiles, setGstr2bFiles] = useState<File[]>([]);
  const [gstr2bSource, setGstr2bSource] = useState<Gstr2bSource>("upload");
  const gstr2bVariant: Gstr2bVariant = "inconsistent";
  const [ledgerPreview, setLedgerPreview] = useState<Record<string, unknown>[]>([]);
  const [gstr2bPreview, setGstr2bPreview] = useState<Record<string, unknown>[]>([]);
  const [gspPreview, setGspPreview] = useState<Record<string, unknown>[]>([]);
  const [gspCount, setGspCount] = useState<number | null>(null);
  const [gspDefects, setGspDefects] = useState<Gstr2bDefects | null>(null);
  const [isFetchingGsp, setIsFetchingGsp] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPeriodsFor = useCallback(async (id: string) => {
    const existingPeriods = await fetchPeriods(id);
    setPeriods(existingPeriods);
    // Prefer a prefilled period from Re-reconcile; otherwise fall back to the latest.
    if (prefill?.taxPeriod) {
      setTaxPeriod(prefill.taxPeriod);
    } else if (existingPeriods.length > 0) {
      setTaxPeriod(existingPeriods[0].tax_period);
    }
  }, [prefill?.taxPeriod]);

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

  const updateInference = useCallback((allRows: Record<string, unknown>[]) => {
    const range = inferDateRange(allRows);
    if (range) {
      setInferredRange(range);
      setTaxPeriod(range.from);
    }
  }, []);

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

  const handleTallyFile = useCallback(
    async (file: File) => {
      setTallyImportedFile(file);
      setError(null);
      // TallyConnect hands back a CSV File, exactly like the uploader does — so run it
      // through the same parse. Without this the Tally path showed no preview, and
      // (because inference reads preview rows) never inferred the tax period either.
      const preview = await getMultiFilePreviewRows([file]);
      setLedgerPreview(preview);
      updateInference(preview);
    },
    [updateInference],
  );

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
    if (!clientId) return;

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
      const period = await createPeriod(
        clientId,
        taxPeriod,
        inferredRange?.fromDate,
        inferredRange?.toDate,
      );
      const check =
        gstr2bSource === "gsp"
          ? await createCheckFromGsp(period.id, effectiveLedgerFile, gstr2bVariant)
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
                  <Input value={setupName} onChange={(e) => setSetupName(e.target.value)} required />
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
                <Button type="submit" className="w-full">Continue</Button>
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
                onCleared={() => {
                  setTallyImportedFile(null);
                  setLedgerPreview([]);
                }}
              />
            ) : (
              <FileUploader
                label="Upload Purchase Register"
                description="Tally IGST / CGST+SGST export — XLSX or CSV"
                accept=".xlsx,.xls,.csv"
                files={ledgerFiles}
                onFilesChange={handleLedgerFilesChange}
              />
            )}

            {/* Outside the source branch: the preview describes the purchase register
                itself, and reads the same whether the rows were uploaded or pulled
                from Tally. Seeing the rows before reconciling is how you catch the
                wrong month or the wrong company. */}
            {ledgerPreview.length > 0 && (
              <FilePreview rows={ledgerPreview} title="Purchase Register" />
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
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-5">
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
              <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-5 space-y-4">
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
                      Provider) API call instead of a manual download.
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

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {rangeLabel && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <CalendarCheck className="h-3.5 w-3.5" />
                Period: {rangeLabel}
              </Badge>
            )}
            {periods.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {periods.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setTaxPeriod(p.tax_period);
                      setInferredRange(null);
                    }}
                    className={`rounded-md border px-2.5 py-1 text-[10px] font-medium transition-colors ${
                      taxPeriod === p.tax_period
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {formatTaxPeriod(p.tax_period)}
                  </button>
                ))}
              </div>
            )}
          </div>
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
