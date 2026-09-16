import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";
import NewReconciliation from "@/pages/NewReconciliation";
import PeriodView from "@/pages/PeriodView";
import VendorView from "@/pages/VendorView";
import Settings from "@/pages/Settings";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reconcile" element={<NewReconciliation />} />
          <Route path="/periods/:periodId" element={<PeriodView />} />
          <Route path="/vendors/:vendorId" element={<VendorView />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
