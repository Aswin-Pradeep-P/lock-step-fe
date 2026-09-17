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
  tallyRecordsToCsvFile,
} from "@/lib/tally";
import {
  Loader2,
  CheckCircle2,
  HelpCircle,
  Download,
  Server,
  Building2,
  Calendar,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";

interface TallyConnectProps {
  onFileReady: (file: File) => void;
  importedCount: number | null;
  /** Clearing the import must also clear the preview it produced. */
  onCleared?: () => void;
}

export function TallyConnect({ onFileReady, importedCount, onCleared }: TallyConnectProps) {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [companies, setCompanies] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}01`;
  });
  const [toDate, setToDate] = useState(() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `${last.getFullYear()}${String(last.getMonth() + 1).padStart(2, "0")}${String(last.getDate()).padStart(2, "0")}`;
  });
  const [isImporting, setIsImporting] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setIsConnecting(true);
    setWarning(null);
    try {
      const result = await checkTallyConnection();
      setIsConnected(result.connected);
      if (!result.connected) {
        toast.error(
          "Cannot connect to TallyPrime. Make sure it is running with the HTTP server enabled on port 9000.",
        );
        return;
      }
      setCompanies(result.companies);
      if (result.companies.length > 0) setSelectedCompany(result.companies[0]);
      if (result.warning) setWarning(result.warning);
    } catch (err) {
      toast.error(friendlyError(err, { fallback: "Couldn't connect to TallyPrime." }));
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [toast]);

  const handleImport = useCallback(async () => {
    if (!selectedCompany) return;
    setIsImporting(true);
    try {
      const result = await fetchTallyPurchaseRegister(selectedCompany, fromDate, toDate);
      if (result.records.length === 0) {
        toast.error("No purchase vouchers found for the selected period.");
        return;
      }
      const file = tallyRecordsToCsvFile(result.records);
      onFileReady(file);
    } catch (err) {
      toast.error(friendlyError(err, { fallback: "Couldn't import records from TallyPrime." }));
    } finally {
      setIsImporting(false);
    }
  }, [selectedCompany, fromDate, toDate, onFileReady, toast]);

  const handleDisconnect = () => {
    setIsConnected(false);
    setCompanies([]);
    setSelectedCompany("");
    setWarning(null);
  };

  if (importedCount !== null && importedCount > 0) {
    return (
      <div className="flex flex-1 flex-col justify-center rounded-lg border-2 border-primary/20 bg-primary/5 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Records imported from TallyPrime</p>
              <p className="text-xs text-muted-foreground">
                {selectedCompany} &middot; {formatDateDisplay(fromDate)} to{" "}
                {formatDateDisplay(toDate)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              handleDisconnect();
              onCleared?.();
            }}
          >
            Clear
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
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
        <div className="flex flex-1 flex-col justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Server className="h-4 w-4" />
            Connect to TallyPrime
          </div>
          <Button onClick={handleConnect} disabled={isConnecting} className="w-full gap-2">
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
        <div className="flex flex-1 flex-col justify-center rounded-lg border-2 border-primary/20 bg-primary/5 p-5 space-y-4">
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
                  <option key={c} value={c}>{c}</option>
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
                  onChange={(e) => setFromDate(inputDateToYyyymmdd(e.target.value))}
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
                  onChange={(e) => setToDate(inputDateToYyyymmdd(e.target.value))}
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
          <SetupStep number={1} title="Open TallyPrime" description='Make sure TallyPrime is running on your machine with at least one company loaded.' />
          <SetupStep number={2} title="Enable HTTP Server" description='Go to F1 (Help) → Settings → Advanced Configuration → Enable "Tally.NET Server" and set the port (default: 9000).' />
          <SetupStep number={3} title="Load a Company" description="Open the company whose purchase register you want to reconcile. Tally must have the company active." />
          <SetupStep number={4} title="Connect from Lockstep" description="Click 'Connect to Tally' above. Your companies will appear automatically." />
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">Troubleshooting</p>
            <ul className="list-disc list-inside space-y-1">
              <li>If connection fails, check that TallyPrime is running and the HTTP server is enabled.</li>
              <li>Firewall or antivirus software may block port 9000 — add an exception if needed.</li>
              <li>For remote Tally instances, use the machine's IP address instead of localhost.</li>
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

function SetupStep({ number, title, description }: { number: number; title: string; description: string }) {
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
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${parseInt(yyyymmdd.slice(6, 8))} ${months[parseInt(yyyymmdd.slice(4, 6)) - 1]} ${yyyymmdd.slice(0, 4)}`;
}

function yyyymmddToInputDate(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return "";
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function inputDateToYyyymmdd(inputDate: string): string {
  return inputDate.replace(/-/g, "");
}
