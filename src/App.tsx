import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";
import NewReconciliation from "@/pages/NewReconciliation";
import ReconciliationResults from "@/pages/ReconciliationResults";
import Login from "@/pages/Login";
import { isAuthenticated } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <TooltipProvider delayDuration={200} skipDelayDuration={300}>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/reconcile" element={<NewReconciliation />} />
          <Route path="/reconcile/:periodId" element={<ReconciliationResults />} />
          <Route path="/reconcile/:periodId/:checkId" element={<ReconciliationResults />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ToastProvider>
  );
}
