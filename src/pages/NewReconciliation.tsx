/**
 * New Reconciliation — the original upload flow, kept.
 *
 * What changed underneath: the two files now land in a *tax period* rather than a
 * one-shot run, so you can come back and re-upload GSTR-2B as vendors file and watch
 * the gap close before the 13th. Same two uploaders, same button.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { FileUploader } from "@/components/reconciliation/FileUploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import * as api from "@/lib/api";
import { formatTaxPeriod } from "@/lib/format";
import type { Client, Period } from "@/types";
import { ArrowRight, CalendarClock, Loader2 } from "lucide-react";

/** '2026-09' (native month input) -> '092026' (MMYYYY, what the API takes). */
function toTaxPeriod(monthValue: string): string {
  const [year, month] = monthValue.split("-");
  return `${month}${year}`;
}

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function NewReconciliation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [month, setMonth] = useState(currentMonthValue);
  const [legalName, setLegalName] = useState("");
  const [gstin, setGstin] = useState("");

  const [purchaseFile, setPurchaseFile] = useState<File | null>(null);
  const [gstr2bFile, setGstr2bFile] = useState<File | null>(null);
  const [existing, setExisting] = useState<Period | null>(null);

  const [isReconciling, setIsReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.fetchClients().then((loaded) => {
      setClients(loaded);
      if (loaded[0]) setClientId(searchParams.get("client") ?? loaded[0].id);
    });
  }, [searchParams]);

  // Tell the user up front when they are adding a check to a period that already
  // exists — re-checking is the normal case, not an error.
  useEffect(() => {
    if (!clientId) return;
    const taxPeriod = toTaxPeriod(month);
    api
      .fetchPeriods(clientId)
      .then((periods) => setExisting(periods.find((p) => p.tax_period === taxPeriod) ?? null));
  }, [clientId, month]);

  const handleReconcile = useCallback(async () => {
    setIsReconciling(true);
    setError(null);
    try {
      let id = clientId;
      if (!id) {
        if (!legalName.trim() || !gstin.trim()) {
          throw new Error("Enter the client's legal name and GSTIN.");
        }
        id = (await api.createClient(legalName.trim(), gstin.trim())).id;
      }
      const period = await api.createPeriod(id, toTaxPeriod(month));
      await api.createCheck(period.id, {
        ledger: purchaseFile ?? undefined,
        gstr2b: gstr2bFile ?? undefined,
      });
      navigate(`/periods/${period.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run reconciliation");
    } finally {
      setIsReconciling(false);
    }
  }, [clientId, legalName, gstin, month, purchaseFile, gstr2bFile, navigate]);

  const canReconcile = (purchaseFile || gstr2bFile) && !isReconciling;

  return (
    <div>
      <Header title="New Reconciliation" />

      <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tax Period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {clients.length > 0 ? (
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Client</span>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.legal_name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium">Client legal name</span>
                    <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium">GSTIN</span>
                    <Input value={gstin} onChange={(e) => setGstin(e.target.value)} />
                  </label>
                </>
              )}

              <label className="block space-y-2">
                <span className="text-sm font-medium">Period</span>
                {/* ponytail: native month input — no date-picker dependency */}
                <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              </label>
            </div>

            {existing && (
              <div className="flex items-start gap-2 rounded-md bg-primary/5 p-3 text-sm">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>
                  {formatTaxPeriod(existing.tax_period)} is already open. This adds another
                  check to it, and you&apos;ll see what changed since the last one.
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload Files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium">Purchase Register</label>
              <FileUploader
                label="Purchase Register"
                description="Tally export — CSV or Excel. Drop it here or browse."
                accept=".xlsx,.xls,.csv"
                file={purchaseFile}
                onFileSelect={setPurchaseFile}
                onFileClear={() => setPurchaseFile(null)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">GSTR-2B</label>
              <FileUploader
                label="GSTR-2B"
                description="Downloaded from the GST portal — CSV or Excel."
                accept=".xlsx,.xls,.csv"
                file={gstr2bFile}
                onFileSelect={setGstr2bFile}
                onFileClear={() => setGstr2bFile(null)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Either file on its own is fine. Load the ledger early in the month, then
                come back and add GSTR-2B as your suppliers file.
              </p>
            </div>

            {error && (
              <div className="rounded-md border border-risk-critical/30 bg-risk-critical/5 px-4 py-3 text-sm text-risk-critical">
                {error}
              </div>
            )}

            <Button onClick={handleReconcile} disabled={!canReconcile} className="w-full gap-2">
              {isReconciling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reconciling…
                </>
              ) : (
                <>
                  Reconcile
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
