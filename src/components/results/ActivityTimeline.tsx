import type { InvoiceAction, ActionType } from "@/types";
import {
  Send,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  EyeOff,
  ShieldOff,
  Clock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ACTION_META: Record<ActionType, { label: string; icon: typeof Send; color: string }> = {
  VENDOR_NOTIFIED: { label: "Vendor nudged", icon: Send, color: "text-blue-500" },
  PAYMENT_HOLD_PROPOSED: { label: "Escalated — hold proposed", icon: ShieldAlert, color: "text-risk-critical" },
  PAYMENT_HOLD_APPLIED: { label: "Payment hold applied", icon: ShieldOff, color: "text-risk-critical" },
  PAYMENT_RELEASED: { label: "Payment released", icon: ShieldCheck, color: "text-risk-low" },
  MARKED_RESOLVED: { label: "Marked resolved", icon: CheckCircle2, color: "text-risk-low" },
  IGNORED: { label: "Flagged for review", icon: EyeOff, color: "text-yellow-500" },
};

interface ActivityTimelineProps {
  actions: InvoiceAction[];
}

export function ActivityTimeline({ actions }: ActivityTimelineProps) {
  if (actions.length === 0) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-2">
        <Clock className="h-3 w-3" />
        No actions taken yet
      </div>
    );
  }

  const sorted = [...actions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="space-y-0">
      {sorted.map((action, idx) => {
        const meta = ACTION_META[action.action];
        const Icon = meta.icon;
        const isLast = idx === sorted.length - 1;

        return (
          <div key={action.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`rounded-full p-1 ${meta.color} bg-muted`}>
                <Icon className="h-3 w-3" />
              </div>
              {!isLast && <div className="w-px flex-1 bg-border min-h-[16px]" />}
            </div>
            <div className="pb-3 min-w-0">
              <p className="text-xs font-medium">{meta.label}</p>
              {action.channel && (
                <span className="text-[10px] text-muted-foreground">via {action.channel}</span>
              )}
              <p className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
