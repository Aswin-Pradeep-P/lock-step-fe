import { create } from "zustand";
import type {
  ReconciliationRun,
  ReconciliationRunSummary,
  Vendor,
  RiskCategory,
} from "@/types";

interface AppState {
  runs: ReconciliationRunSummary[];
  currentRun: ReconciliationRun | null;
  vendors: Vendor[];
  isLoading: boolean;
  activeFilter: RiskCategory | null;

  setRuns: (runs: ReconciliationRunSummary[]) => void;
  setCurrentRun: (run: ReconciliationRun | null) => void;
  setVendors: (vendors: Vendor[]) => void;
  setLoading: (loading: boolean) => void;
  setActiveFilter: (filter: RiskCategory | null) => void;
  toggleFilter: (filter: RiskCategory) => void;
}

export const useStore = create<AppState>((set, get) => ({
  runs: [],
  currentRun: null,
  vendors: [],
  isLoading: false,
  activeFilter: null,

  setRuns: (runs) => set({ runs }),
  setCurrentRun: (currentRun) => set({ currentRun }),
  setVendors: (vendors) => set({ vendors }),
  setLoading: (isLoading) => set({ isLoading }),
  setActiveFilter: (activeFilter) => set({ activeFilter }),
  toggleFilter: (filter) => {
    const current = get().activeFilter;
    set({ activeFilter: current === filter ? null : filter });
  },
}));
