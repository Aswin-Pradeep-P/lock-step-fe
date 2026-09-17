import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FilePlus,
  ScrollText,
  Building2,
  Shield,
  Menu,
  X,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { logout } from "@/lib/auth";
import { Tooltip } from "@/components/ui/tooltip";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  /** Not yet built — shown greyed out with a "Coming soon" tooltip. */
  comingSoon?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "New Reconciliation", href: "/reconcile", icon: FilePlus },
  { label: "Reconciliation Logs", href: "/logs", icon: ScrollText, comingSoon: true },
  { label: "Vendor Bank", href: "/vendors", icon: Building2, comingSoon: true },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const renderNavItem = (item: NavItem) => {
    const isActive =
      !item.comingSoon &&
      (item.href === "/" ? location.pathname === "/" : location.pathname.startsWith(item.href));

    const inner = (
      <>
        <item.icon className="h-5 w-5 shrink-0" />
        <span className={cn("whitespace-nowrap", collapsed && "lg:hidden")}>{item.label}</span>
      </>
    );

    const base = cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
      collapsed && "lg:justify-center lg:px-0",
    );

    const node = item.comingSoon ? (
      <div className={cn(base, "cursor-not-allowed text-sidebar-foreground/40")} aria-disabled>
        {inner}
      </div>
    ) : (
      <Link
        to={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          base,
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
        )}
      >
        {inner}
      </Link>
    );

    // Tooltip when collapsed (reveals the hidden label) or when the item is a
    // not-yet-built placeholder (explains why it's greyed out).
    return (
      <Tooltip
        key={item.href}
        content={item.comingSoon ? "Coming soon" : item.label}
        side="right"
        enabled={item.comingSoon || collapsed}
      >
        {node}
      </Tooltip>
    );
  };

  return (
    <>
      <button
        className="fixed top-4 left-4 z-50 rounded-md bg-sidebar p-2 text-sidebar-foreground lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 lg:translate-x-0",
          collapsed ? "lg:w-16" : "lg:w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center gap-2 border-b border-sidebar-border px-6",
            collapsed && "lg:justify-center lg:px-0",
          )}
        >
          <Shield className="h-7 w-7 text-primary shrink-0" />
          <span className={cn("text-xl font-bold tracking-tight", collapsed && "lg:hidden")}>
            Lockstep
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">{navItems.map(renderNavItem)}</nav>

        <div className="border-t border-sidebar-border p-3 space-y-1">
          <button
            onClick={onToggleCollapsed}
            className={cn(
              "hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground lg:flex",
              collapsed && "lg:justify-center lg:px-0",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>

          <Tooltip content="Log out" side="right" enabled={collapsed}>
            <button
              onClick={handleLogout}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                collapsed && "lg:justify-center lg:px-0",
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className={cn(collapsed && "lg:hidden")}>Log out</span>
            </button>
          </Tooltip>

          <div className={cn("px-3 text-xs text-sidebar-foreground/50", collapsed && "lg:hidden")}>
            Lockstep v0.1.0
          </div>
        </div>
      </aside>
    </>
  );
}
