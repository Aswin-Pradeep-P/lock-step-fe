import { useState, useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import {
  ReconcileInputs,
  ReconcilePreviews,
  useReconcileInputs,
} from "@/components/reconciliation/ReconcileInputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import {
  fetchClients,
  createClient,
  fetchPeriods,
  createPeriod,
  createCheck,
  createCheckFromGsp,
  type Gstr2bVariant,
} from "@/lib/api";
import type { Period } from "@/types";
import { Loader2, ArrowRight, CalendarCheck } from "lucide-react";

type DateRange = {
  from: string;
  to: string;
  fromDate?: string;
  toDate?: string;
};

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
  const { toast } = useToast();
  const prefill = (location.state as { taxPeriod?: string; periodId?: string } | null) ?? null;
  const [clientId, setClientId] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupGstin, setSetupGstin] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [taxPeriod, setTaxPeriod] = useState(prefill?.taxPeriod ?? currentTaxPeriod());
  const [inferredRange, setInferredRange] = useState<DateRange | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [isReconciling, setIsReconciling] = useState(false);

  const gstr2bVariant: Gstr2bVariant = "inconsistent";

  const updateInference = useCallback((allRows: Record<string, unknown>[]) => {
    const range = inferDateRange(allRows);
    if (range) {
      setInferredRange(range);
      setTaxPeriod(range.from);
    }
  }, []);

  const inputs = useReconcileInputs({
    variant: gstr2bVariant,
    onLedgerPreview: (rows) => updateInference(rows),
    onGstr2bPreview: (rows) => setInferredRange((prev) => {
      // Only infer from the 2B side if the ledger hasn't already set a range.
      if (!prev) {
        const range = inferDateRange(rows);
        if (range) {
          setTaxPeriod(range.from);
          return range;
        }
      }
      return prev;
    }),
    onError: (err) => toast.error(friendlyError(err, { fallback: "Couldn't fetch GSTR-2B. Try again in a moment." })),
  });

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
        toast.error(friendlyError(err, { fallback: "Couldn't load your account. Refresh and try again." }));
      } finally {
        setLoadingContext(false);
      }
    }
    loadContext();
  }, [loadPeriodsFor, toast]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError(null);
    try {
      const client = await createClient(setupName, setupGstin);
      setClientId(client.id);
      setNeedsSetup(false);
      toast.success("Company set up. You're ready to reconcile.");
      await loadPeriodsFor(client.id);
    } catch (err) {
      setSetupError(friendlyError(err, { fallback: "Couldn't save your company details. Check them and try again." }));
    } finally {
      setLoadingContext(false);
    }
  };

  const handleReconcile = async () => {
    if (!clientId) return;

    const { ledgerFile, gstr2bFile, gstr2bSource } = await inputs.resolveFiles();
    const hasGstr2bInput = gstr2bSource === "gsp" || gstr2bFile;
    if (!ledgerFile && !hasGstr2bInput) return;

    setIsReconciling(true);
    try {
      const period = await createPeriod(
        clientId,
        taxPeriod,
        inferredRange?.fromDate,
        inferredRange?.toDate,
      );
      const check =
        gstr2bSource === "gsp"
          ? await createCheckFromGsp(period.id, ledgerFile, gstr2bVariant)
          : await createCheck(period.id, ledgerFile, gstr2bFile);
      toast.success("Reconciliation complete.");
      navigate(`/reconcile/${period.id}/${check.id}`);
    } catch (err) {
      toast.error(friendlyError(err, { fallback: "Couldn't run the reconciliation. Please try again." }));
    } finally {
      setIsReconciling(false);
    }
  };

  const canReconcile =
    !loadingContext && (inputs.hasLedger || inputs.hasGstr2b) && !isReconciling;

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
                {setupError && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    {setupError}
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

      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <ReconcileInputs controller={inputs} layout="grid" />

        <div className="flex items-center justify-between gap-3 flex-wrap">
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

        <ReconcilePreviews controller={inputs} />
      </div>
    </div>
  );
}
