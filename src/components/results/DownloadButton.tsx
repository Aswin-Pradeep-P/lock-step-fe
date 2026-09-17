import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { downloadInvoiceExport } from "@/lib/api";
import { exportToPDF } from "@/lib/export";
import type { Headline, Invoice } from "@/types";

interface DownloadButtonProps {
  periodId: string;
  headline?: Headline | null;
  invoices?: Invoice[];
}

export function DownloadButton({ periodId, headline, invoices }: DownloadButtonProps) {
  const [downloading, setDownloading] = useState<"csv" | "pdf" | null>(null);

  const handleCsv = async () => {
    setDownloading("csv");
    try {
      await downloadInvoiceExport(periodId);
    } finally {
      setDownloading(null);
    }
  };

  const handlePdf = async () => {
    if (!headline || !invoices) return;
    setDownloading("pdf");
    try {
      await exportToPDF(headline, invoices);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={!!downloading}>
          {downloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handlePdf} disabled={!headline || !invoices}>
          <FileText className="mr-2 h-4 w-4" />
          Download PDF Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCsv}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Export CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
