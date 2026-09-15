import { formatDistanceToNow } from "date-fns";
import {
  Flag,
  AlertTriangle,
  CheckCircle2,
  Send,
  Clock,
  Mail,
  MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ActivityEntry } from "@/types";

interface ActivityTimelineProps {
  entries: ActivityEntry[];
}

const typeConfig = {
  created: {
    icon: Clock,
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
  flagged: {
    icon: Flag,
    color: "text-risk-high",
    bg: "bg-risk-high/10",
  },
  escalated: {
    icon: AlertTriangle,
    color: "text-risk-critical",
    bg: "bg-risk-critical/10",
  },
  resolved: {
    icon: CheckCircle2,
    color: "text-risk-low",
    bg: "bg-risk-low/10",
  },
  nudge_sent: {
    icon: Send,
    color: "text-primary",
    bg: "bg-primary/10",
  },
};

export function ActivityTimeline({ entries }: ActivityTimelineProps) {
  if (entries.length <= 1) return null;

  const sorted = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <div className="space-y-1.5">
      <div className="text-sm font-medium">Activity Timeline</div>
      <div className="space-y-0">
        {sorted.map((entry, idx) => {
          const config = typeConfig[entry.type];
          const Icon = config.icon;
          const isLast = idx === sorted.length - 1;

          return (
            <div key={entry.id} className="flex gap-3 relative">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${config.bg}`}
                >
                  <Icon className={`h-3 w-3 ${config.color}`} />
                </div>
                {!isLast && (
                  <div className="w-px flex-1 bg-border min-h-[16px]" />
                )}
              </div>
              <div className="pb-3 -mt-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium">{entry.description}</p>
                  {entry.channel && (
                    <Badge variant="secondary" className="h-4 text-[10px] px-1.5 gap-0.5">
                      {entry.channel === "email" ? (
                        <Mail className="h-2.5 w-2.5" />
                      ) : (
                        <MessageCircle className="h-2.5 w-2.5" />
                      )}
                      {entry.channel === "email" ? "Email" : "WhatsApp"}
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {entry.actor} &middot;{" "}
                  {formatDistanceToNow(new Date(entry.timestamp), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
