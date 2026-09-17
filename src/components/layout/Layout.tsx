import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "lockstep:sidebar-collapsed";

export function Layout() {
  // Collapse state lives here so the main content's left padding can track it.
  // Persisted per-viewer; reads are guarded because storage can throw/be empty.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore — a remembered collapse state is a convenience, not essential
    }
  }, [collapsed]);

  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />
      <main
        className={cn(
          "transition-[padding] duration-200",
          collapsed ? "lg:pl-16" : "lg:pl-64",
        )}
      >
        <Outlet />
      </main>
    </div>
  );
}
