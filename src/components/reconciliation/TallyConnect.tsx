import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  checkTallyConnection,
  fetchTallyPurchaseRegister,
} from "@/lib/api";
import type { PurchaseRecord } from "@/types";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Download,
  Server,
  Building2,
  Calendar,
} from "lucide-react";

interface TallyConnectProps {
  onRecordsImported: (records: PurchaseRecord[]) => void;
  importedCount: number | null;
}

export function TallyConnect({
  onRecordsImported,
  importedCount,
}: TallyConnectProps) {
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState("9000");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [companies, setCompanies] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [fromDate, setFromDate] = useState("20240801");
  const [toDate, setToDate] = useState("20240831");
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    setWarning(null);

    try {
      const result = await checkTallyConnection(host, Number(port));
      setIsConnected(result.connected);
      setCompanies(result.companies);
      if (result.companies.length > 0) {
        setSelectedCompany(result.companies[0]);
      }
      if (result.warning) {
        setWarning(result.warning);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to connect to TallyPrime"
      );
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [host, port]);

  const handleImport = useCallback(async () => {
    if (!selectedCompany) return;

    setIsImporting(true);
    setError(null);

    try {
      const result = await fetchTallyPurchaseRegister(
        host,
        Number(port),
        selectedCompany,
        fromDate,
        toDate
      );
      onRecordsImported(result.records);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to import records from TallyPrime"
      );
    } finally {
      setIsImporting(false);
    }
  }, [host, port, selectedCompany, fromDate, toDate, onRecordsImported]);

  const handleDisconnect = () => {
    setIsConnected(false);
    setCompanies([]);
    setSelectedCompany("");
    setError(null);
    setWarning(null);
    onRecordsImported([]);
  };

  if (importedCount !== null && importedCount > 0) {
    return (
      <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {importedCount} records imported from TallyPrime
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedCompany} &middot; {formatDateDisplay(fromDate)} to{" "}
                {formatDateDisplay(toDate)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleDisconnect}>
            Clear
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1.5 text-xs text-green-600">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              Not connected
            </span>
          )}
        </div>
        <SetupInstructionsDialog />
      </div>

      {!isConnected ? (
        <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Server className="h-4 w-4" />
            Connect to TallyPrime
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Host
              </label>
              <Input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="localhost"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Port
              </label>
              <Input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="9000"
              />
            </div>
          </div>
          <Button
            onClick={handleConnect}
            disabled={isConnecting || !host || !port}
            className="w-full gap-2"
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Server className="h-4 w-4" />
                Connect to Tally
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-5 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Company
              </label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {companies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  From Date
                </label>
                <Input
                  type="date"
                  value={yyyymmddToInputDate(fromDate)}
                  onChange={(e) =>
                    setFromDate(inputDateToYyyymmdd(e.target.value))
                  }
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  To Date
                </label>
                <Input
                  type="date"
                  value={yyyymmddToInputDate(toDate)}
                  onChange={(e) =>
                    setToDate(inputDateToYyyymmdd(e.target.value))
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleImport}
              disabled={isImporting || !selectedCompany}
              className="flex-1 gap-2"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Import Records
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleDisconnect}>
              Disconnect
            </Button>
          </div>
        </div>
      )}

      {warning && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
          {warning}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
          <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

function SetupInstructionsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7">
          <HelpCircle className="h-3.5 w-3.5" />
          Setup Guide
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>TallyPrime Integration Setup</DialogTitle>
          <DialogDescription>
            Follow these steps to enable the Tally connection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <SetupStep
            number={1}
            title="Open TallyPrime"
            description="Make sure TallyPrime is running on your machine with at least one company loaded."
          />
          <SetupStep
            number={2}
            title="Enable HTTP Server"
            description='Go to F1 (Help) → Settings → Advanced Configuration → Enable "Tally.NET Server" and set the port (default: 9000).'
          />
          <SetupStep
            number={3}
            title="Load a Company"
            description="Open the company whose purchase register you want to reconcile. Tally must have the company active."
          />
          <SetupStep
            number={4}
            title="Connect from Lockstep"
            description="Enter the host (usually localhost) and port (default 9000) above, then click Connect. Your companies will appear automatically."
          />

          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Troubleshooting</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                If connection fails, check that TallyPrime is running and the
                HTTP server is enabled.
              </li>
              <li>
                Firewall or antivirus software may block port 9000 — add an
                exception if needed.
              </li>
              <li>
                For remote Tally instances, use the machine's IP address instead
                of localhost.
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Got it</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SetupStep({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
        {number}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function formatDateDisplay(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

function yyyymmddToInputDate(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return "";
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function inputDateToYyyymmdd(inputDate: string): string {
  return inputDate.replace(/-/g, "");
}
