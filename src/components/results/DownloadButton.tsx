import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { exportToCSV, exportToPDF } from "@/lib/export";
import type { ReconciliationRun, RiskCategory } from "@/types";

interface DownloadButtonProps {
  run: ReconciliationRun;
  filter: RiskCategory | null;
}

export function DownloadButton({ run, filter }: DownloadButtonProps) {
  const handleCSV = () => {
    const suffix = filter ? `-${filter}` : "";
    exportToCSV(run.records, filter, `lockstep-${run.id}${suffix}.csv`);
  };

  const handlePDF = () => {
    exportToPDF(run);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handlePDF} className="gap-2">
          <FileText className="h-4 w-4" />
          Download PDF Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCSV} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Download CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
