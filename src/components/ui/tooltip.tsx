import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

/**
 * Thin wrapper over Radix Tooltip.
 *
 * Wrap the whole app once in <TooltipProvider> (see App.tsx), then use the
 * convenience <Tooltip> for one-off hints:
 *
 *   <Tooltip content="No vendors to nudge in the current view">
 *     <span><Button disabled>Bulk Nudge</Button></span>
 *   </Tooltip>
 *
 * Note: a disabled button doesn't emit pointer events, so wrap it in a <span>
 * (as above) for the tooltip to still trigger.
 */

const TooltipProvider = TooltipPrimitive.Provider;
const TooltipRoot = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-[110] max-w-xs rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-md",
        "animate-toast-in",
        className,
      )}
      {...props}
    >
      {props.children}
      <TooltipPrimitive.Arrow className="fill-foreground" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = "TooltipContent";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  /** Which side to prefer. Defaults to "top". */
  side?: "top" | "right" | "bottom" | "left";
  /** When false, renders children without a tooltip (handy for conditional hints). */
  enabled?: boolean;
}

/** Convenience single-child tooltip for short hints. */
function Tooltip({ content, children, side = "top", enabled = true }: TooltipProps) {
  if (!enabled || content == null || content === "") return <>{children}</>;
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </TooltipRoot>
  );
}

export {
  Tooltip,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
};
