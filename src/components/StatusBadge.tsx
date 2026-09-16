import { cn } from "@/lib/utils";
import { STATUS_META } from "@/lib/format";
import type { InvoiceStatus } from "@/types";

const TONE = {
  good: "bg-risk-low/10 text-risk-low",
  warn: "bg-risk-high/10 text-risk-high",
  bad: "bg-risk-critical/10 text-risk-critical",
  neutral: "bg-muted text-muted-foreground",
} as const;

export function StatusBadge({
  status,
  className,
}: {
  status: InvoiceStatus;
  className?: string;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      title={meta.hint}
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONE[meta.tone],
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
