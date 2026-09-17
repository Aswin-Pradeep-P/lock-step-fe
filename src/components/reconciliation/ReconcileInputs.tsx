import { useCallback, useState } from "react";
import { FileUploader } from "@/components/reconciliation/FileUploader";
import { FilePreview } from "@/components/reconciliation/FilePreview";
import { TallyConnect } from "@/components/reconciliation/TallyConnect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMultiFilePreviewRows, mergeFiles } from "@/lib/parser";
import {
  fetchGstr2b,
  flattenGstr2bPreview,
  type Gstr2bDefects,
  type Gstr2bVariant,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Loader2, Upload, Globe, Server, Download } from "lucide-react";

/**
 * The purchase-register + GSTR-2B upload UI, shared by the New Reconciliation
 * page and the Re-run dialog. All source/file/preview/GSP state lives in
 * `useReconcileInputs`; this component only renders it. The two callers differ
 * purely in layout:
 *   - page:  layout="grid"    (two columns, side by side, with previews)
 *   - modal: layout="stacked" (vertical, no previews, compact)
 */

export type LedgerSource = "tally" | "upload";
export type Gstr2bSource = "upload" | "gsp";

export interface ResolvedReconcileFiles {
  ledgerFile: File | null;
  gstr2bFile: File | null;
  gstr2bSource: Gstr2bSource;
  variant: Gstr2bVariant;
}

interface UseReconcileInputsOptions {
  /** Which sandbox variant the GSP fetch should request. New run uses
   *  "inconsistent" (seeds demo mismatches); re-run uses "corrected". */
  variant: Gstr2bVariant;
  /** Called with parsed preview rows whenever the ledger side changes. */
  onLedgerPreview?: (rows: Record<string, unknown>[]) => void;
  /** Called with parsed preview rows whenever the GSTR-2B upload changes. */
  onGstr2bPreview?: (rows: Record<string, unknown>[]) => void;
  /** Surface a fetch/parse failure (parent decides: toast or inline). */
  onError?: (err: unknown) => void;
  /** Fired on any user interaction, so a parent can clear a stale error. */
  onInteract?: () => void;
}

export interface ReconcileInputsController {
  ledgerSource: LedgerSource;
  setLedgerSource: (s: LedgerSource) => void;
  ledgerFiles: File[];
  tallyImportedFile: File | null;
  ledgerPreview: Record<string, unknown>[];

  gstr2bSource: Gstr2bSource;
  gstr2bFiles: File[];
  gstr2bPreview: Record<string, unknown>[];
  gspPreview: Record<string, unknown>[];
  gspCount: number | null;
  gspDefects: Gstr2bDefects | null;
  isFetchingGsp: boolean;

  handleLedgerFilesChange: (files: File[]) => Promise<void>;
  handleTallyFile: (file: File) => Promise<void>;
  clearTally: () => void;
  handleGstr2bFilesChange: (files: File[]) => Promise<void>;
  switchGstr2bSource: (s: Gstr2bSource) => void;
  fetchGsp: () => Promise<void>;
  clearGsp: () => void;

  hasLedger: boolean;
  hasGstr2b: boolean;
  resolveFiles: () => Promise<ResolvedReconcileFiles>;
}

export function useReconcileInputs(
  options: UseReconcileInputsOptions,
): ReconcileInputsController {
  const { variant, onLedgerPreview, onGstr2bPreview, onError, onInteract } = options;

  const [ledgerSource, setLedgerSource] = useState<LedgerSource>("tally");
  const [ledgerFiles, setLedgerFiles] = useState<File[]>([]);
  const [tallyImportedFile, setTallyImportedFile] = useState<File | null>(null);
  const [ledgerPreview, setLedgerPreview] = useState<Record<string, unknown>[]>([]);

  // Fetch-from-portal is the primary path, so it's the default-active tab. Selecting
  // it marks the 2B side as available (the server fetches on reconcile), so Reconcile
  // is actionable on load without a manual pre-fetch.
  const [gstr2bSource, setGstr2bSource] = useState<Gstr2bSource>("gsp");
  const [gstr2bFiles, setGstr2bFiles] = useState<File[]>([]);
  const [gstr2bPreview, setGstr2bPreview] = useState<Record<string, unknown>[]>([]);
  const [gspPreview, setGspPreview] = useState<Record<string, unknown>[]>([]);
  const [gspCount, setGspCount] = useState<number | null>(null);
  const [gspDefects, setGspDefects] = useState<Gstr2bDefects | null>(null);
  const [isFetchingGsp, setIsFetchingGsp] = useState(false);

  const handleLedgerFilesChange = useCallback(
    async (files: File[]) => {
      setLedgerFiles(files);
      onInteract?.();
      if (files.length === 0) {
        setLedgerPreview([]);
        onLedgerPreview?.([]);
        return;
      }
      const preview = await getMultiFilePreviewRows(files);
      setLedgerPreview(preview);
      onLedgerPreview?.(preview);
    },
    [onInteract, onLedgerPreview],
  );

  const handleTallyFile = useCallback(
    async (file: File) => {
      setTallyImportedFile(file);
      onInteract?.();
      // TallyConnect hands back a CSV File just like the uploader — run it through
      // the same parse so the preview (and any parent inference) works identically.
      const preview = await getMultiFilePreviewRows([file]);
      setLedgerPreview(preview);
      onLedgerPreview?.(preview);
    },
    [onInteract, onLedgerPreview],
  );

  const clearTally = useCallback(() => {
    setTallyImportedFile(null);
    setLedgerPreview([]);
    onLedgerPreview?.([]);
  }, [onLedgerPreview]);

  const handleGstr2bFilesChange = useCallback(
    async (files: File[]) => {
      setGstr2bFiles(files);
      onInteract?.();
      if (files.length === 0) {
        setGstr2bPreview([]);
        onGstr2bPreview?.([]);
        return;
      }
      const preview = await getMultiFilePreviewRows(files);
      setGstr2bPreview(preview);
      onGstr2bPreview?.(preview);
    },
    [onInteract, onGstr2bPreview],
  );

  const switchGstr2bSource = useCallback((source: Gstr2bSource) => {
    setGstr2bSource(source);
    onInteract?.();
    if (source === "gsp") {
      setGstr2bFiles([]);
      setGstr2bPreview([]);
      onGstr2bPreview?.([]);
    } else {
      setGspPreview([]);
      setGspCount(null);
      setGspDefects(null);
    }
  }, [onInteract, onGstr2bPreview]);

  const fetchGsp = useCallback(async () => {
    setIsFetchingGsp(true);
    onInteract?.();
    try {
      const result = await fetchGstr2b(variant);
      setGspCount(result.count);
      setGspDefects(result.defects);
      setGspPreview(flattenGstr2bPreview(result.data).slice(0, 5));
    } catch (err) {
      setGspPreview([]);
      setGspCount(null);
      setGspDefects(null);
      onError?.(err);
    } finally {
      setIsFetchingGsp(false);
    }
  }, [variant, onError, onInteract]);

  const clearGsp = useCallback(() => {
    setGspPreview([]);
    setGspCount(null);
    setGspDefects(null);
  }, []);

  const hasLedger = ledgerSource === "tally" ? !!tallyImportedFile : ledgerFiles.length > 0;
  const hasGstr2b = gstr2bSource === "gsp" || gstr2bFiles.length > 0;

  const resolveFiles = useCallback(async (): Promise<ResolvedReconcileFiles> => {
    const ledgerFile =
      ledgerSource === "tally"
        ? tallyImportedFile
        : ledgerFiles.length > 0
          ? await mergeFiles(ledgerFiles)
          : null;
    const gstr2bFile =
      gstr2bSource === "gsp"
        ? null
        : gstr2bFiles.length > 0
          ? await mergeFiles(gstr2bFiles)
          : null;
    return { ledgerFile, gstr2bFile, gstr2bSource, variant };
  }, [ledgerSource, tallyImportedFile, ledgerFiles, gstr2bSource, gstr2bFiles, variant]);

  return {
    ledgerSource,
    setLedgerSource,
    ledgerFiles,
    tallyImportedFile,
    ledgerPreview,
    gstr2bSource,
    gstr2bFiles,
    gstr2bPreview,
    gspPreview,
    gspCount,
    gspDefects,
    isFetchingGsp,
    handleLedgerFilesChange,
    handleTallyFile,
    clearTally,
    handleGstr2bFilesChange,
    switchGstr2bSource,
    fetchGsp,
    clearGsp,
    hasLedger,
    hasGstr2b,
    resolveFiles,
  };
}

// --- Presentation ----------------------------------------------------------------

interface ReconcileInputsProps {
  controller: ReconcileInputsController;
  /** "grid" = two columns side by side (page); "stacked" = vertical (modal). */
  layout?: "grid" | "stacked";
  /** Show the multi-file helper note under the sections. */
  showHint?: boolean;
}

function SourceTabs({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string; icon: typeof Upload }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              value === opt.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Section wrapper: each upload section is its own Card, in both the page (grid) and
 *  the Re-run modal (stacked) — only the outer container differs. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function ReconcileInputs({
  controller: c,
  layout = "grid",
  showHint = true,
}: ReconcileInputsProps) {
  // Each control (dropzone, Tally form, GSP box) lives in a constant-height area, so
  // switching the Upload/Fetch/Tally tabs never resizes the card (no layout jump).
  // 190px clears the tallest control (the Tally connect box) so every tab within a
  // card is the same height. `[&>*]:flex-1` stretches whichever control is showing to
  // fill that height, so the dashed boxes are all the same size and only the padding
  // around their content differs between views.
  const bodyGrow = "flex flex-col min-h-[190px] [&>*]:flex-1";

  const ledgerSection = (
    <Section title="Purchase Register">
      <SourceTabs
        value={c.ledgerSource}
        onChange={(k) => c.setLedgerSource(k as LedgerSource)}
        options={[
          { key: "tally", label: "Connect to Tally", icon: Server },
          { key: "upload", label: "Upload Files", icon: Upload },
        ]}
      />

      <div className={bodyGrow}>
        {c.ledgerSource === "tally" ? (
          <TallyConnect
            onFileReady={c.handleTallyFile}
            importedCount={c.tallyImportedFile ? 1 : null}
            onCleared={c.clearTally}
          />
        ) : (
          <FileUploader
            label="Upload Purchase Register"
            description="Tally IGST / CGST+SGST export — XLSX or CSV"
            accept=".xlsx,.xls,.csv"
            files={c.ledgerFiles}
            onFilesChange={c.handleLedgerFilesChange}
          />
        )}
      </div>
    </Section>
  );

  const gstr2bSection = (
    <Section title="GSTR-2B Data">
      <SourceTabs
        value={c.gstr2bSource}
        onChange={(k) => c.switchGstr2bSource(k as Gstr2bSource)}
        options={[
          { key: "gsp", label: "Fetch from GST Portal", icon: Globe },
          { key: "upload", label: "Upload Files", icon: Upload },
        ]}
      />

      <div className={bodyGrow}>
        {c.gstr2bSource === "upload" ? (
          <FileUploader
            label="Upload GSTR-2B"
            description="Government portal download — XLSX or CSV"
            accept=".xlsx,.xls,.csv"
            files={c.gstr2bFiles}
            onFilesChange={c.handleGstr2bFilesChange}
          />
        ) : c.gspCount !== null && c.gspCount > 0 ? (
          <div className="flex flex-col justify-center rounded-lg border-2 border-primary/20 bg-primary/5 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">
                  {c.gspCount} invoices imported from GSTR-2B
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fetched from the GST portal
                </p>
                {c.gspDefects && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {c.gspDefects.exact} matched · {c.gspDefects.clerical} typos ·{" "}
                    {c.gspDefects.amount_mismatch} tax diffs ·{" "}
                    {c.gspDefects.missing_in_2b} not filed ·{" "}
                    {c.gspDefects.itc_ineligible} ITC blocked
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={c.clearGsp}>
                Clear
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-muted p-2 shrink-0">
                <Globe className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Fetched by your GSTIN for this tax period
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  No file needed — fetched directly from the GST portal.
                </p>
              </div>
            </div>
            <Button
              onClick={c.fetchGsp}
              disabled={c.isFetchingGsp}
              className="w-full gap-2"
            >
              {c.isFetchingGsp ? (
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
    </Section>
  );

  return (
    <div className="space-y-6">
      {layout === "grid" ? (
        <div className="grid gap-6 md:grid-cols-2 md:items-start">
          {ledgerSection}
          {gstr2bSection}
        </div>
      ) : (
        <div className="space-y-4">
          {ledgerSection}
          {gstr2bSection}
        </div>
      )}

      {showHint && (
        <p className="text-xs text-muted-foreground">
          Upload either file on its own, or both together — re-uploading later in the
          same period lets you see what changed since the last check. Multiple files per
          section are merged automatically.
        </p>
      )}
    </div>
  );
}

/**
 * The full-width sample-row preview tables, rendered separately from the controls
 * so the page can place its primary action (Reconcile) between the upload cards and
 * these tables — keeping the action above the fold. An invoice row has too many
 * columns to be legible in a half-width column, so previews are always full width.
 */
export function ReconcilePreviews({
  controller: c,
}: {
  controller: ReconcileInputsController;
}) {
  const gstr2bPreviewRows =
    c.gstr2bPreview.length > 0 ? c.gstr2bPreview : c.gspPreview;

  if (c.ledgerPreview.length === 0 && gstr2bPreviewRows.length === 0) return null;

  return (
    <div className="space-y-4">
      {c.ledgerPreview.length > 0 && (
        <FilePreview rows={c.ledgerPreview} title="Purchase Register" />
      )}
      {gstr2bPreviewRows.length > 0 && (
        <FilePreview rows={gstr2bPreviewRows} title="GSTR-2B" />
      )}
    </div>
  );
}
