import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToCSV } from "@/lib/export";
import type { ReconciledRecord, RiskCategory } from "@/types";

interface DownloadButtonProps {
  records: ReconciledRecord[];
  filter: RiskCategory | null;
  runId: string;
}

export function DownloadButton({ records, filter, runId }: DownloadButtonProps) {
  const handleDownload = () => {
    const suffix = filter ? `-${filter}` : "";
    exportToCSV(records, filter, `lockstep-${runId}${suffix}.csv`);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} className="gap-2">
      <Download className="h-4 w-4" />
      Download CSV
    </Button>
  );
}
