import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A tiny self-contained toast system — no external dependency.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success("Vendor nudged");
 *   toast.error("Couldn't send the reminder");
 *
 * Toasts appear bottom-right on desktop and as a full-width stack at the bottom
 * on mobile. They auto-dismiss (default 4s), pause while hovered, and can be
 * dismissed manually. At most MAX_VISIBLE are shown; older ones drop off.
 */

type ToastVariant = "success" | "error" | "info";

interface ToastOptions {
  /** Auto-dismiss delay in ms. Pass 0 to keep it until dismissed. */
  duration?: number;
}

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastApi {
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  dismiss: (id: number) => void;
}

interface ToastContextValue {
  toast: ToastApi;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4000;
const ERROR_DURATION = 6000; // errors linger a little longer
const MAX_VISIBLE = 3;

const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: typeof CheckCircle2; accent: string; iconColor: string }
> = {
  success: {
    icon: CheckCircle2,
    accent: "border-l-risk-low",
    iconColor: "text-risk-low",
  },
  error: {
    icon: AlertCircle,
    accent: "border-l-destructive",
    iconColor: "text-destructive",
  },
  info: {
    icon: Info,
    accent: "border-l-primary",
    iconColor: "text-primary",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string, options?: ToastOptions) => {
      const id = nextId.current++;
      const duration =
        options?.duration ??
        (variant === "error" ? ERROR_DURATION : DEFAULT_DURATION);
      setToasts((prev) => {
        const next = [...prev, { id, message, variant, duration }];
        // Keep only the most recent MAX_VISIBLE.
        return next.slice(-MAX_VISIBLE);
      });
    },
    [],
  );

  const toast = useMemo<ToastApi>(
    () => ({
      success: (message, options) => push("success", message, options),
      error: (message, options) => push("error", message, options),
      info: (message, options) => push("info", message, options),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-stretch gap-2 p-4 sm:inset-x-auto sm:right-0 sm:bottom-0 sm:w-full sm:max-w-sm"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(toast.duration);
  const startRef = useRef(0);

  const beginLeave = useCallback(() => {
    setLeaving(true);
    // Remove after the exit animation finishes.
    window.setTimeout(() => onDismiss(toast.id), 160);
  }, [onDismiss, toast.id]);

  const startTimer = useCallback(() => {
    if (toast.duration === 0) return; // sticky
    startRef.current = Date.now();
    timerRef.current = setTimeout(beginLeave, remainingRef.current);
  }, [beginLeave, toast.duration]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      remainingRef.current -= Date.now() - startRef.current;
    }
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // Run once on mount; timer control is handled by the hover handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { icon: Icon, accent, iconColor } = VARIANT_STYLES[toast.variant];

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg border border-l-4 border-border bg-card px-4 py-3 shadow-lg",
        accent,
        leaving ? "animate-toast-out" : "animate-toast-in",
      )}
      role="status"
      aria-live={toast.variant === "error" ? "assertive" : "polite"}
      onMouseEnter={pauseTimer}
      onMouseLeave={startTimer}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", iconColor)} />
      <p className="flex-1 text-sm text-card-foreground">{toast.message}</p>
      <button
        onClick={beginLeave}
        className="mt-0.5 shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}
