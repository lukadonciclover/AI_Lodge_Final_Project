"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { sampleAnalysis } from "@/lib/sample-data";
import { CompanyAnalysis } from "@/lib/types";

const STORAGE_KEY = "investment-pitch-copilot-analyses";

type AnalysisContextValue = {
  analyses: CompanyAnalysis[];
  hydrated: boolean;
  getAnalysis: (id: string) => CompanyAnalysis | undefined;
  saveAnalysis: (analysis: CompanyAnalysis) => void;
  deleteAnalysis: (id: string) => void;
};

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [analyses, setAnalyses] = useState<CompanyAnalysis[]>([sampleAnalysis]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (!Array.isArray(parsed)) throw new Error("Invalid saved analysis data");
        setAnalyses(parsed as CompanyAnalysis[]);
      }
      else window.localStorage.setItem(STORAGE_KEY, JSON.stringify([sampleAnalysis]));
    } catch {
      // The sample remains available if storage is disabled or contains invalid data.
    }
    setHydrated(true);
  }, []);

  function persist(next: CompanyAnalysis[]) {
    setAnalyses(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // State remains usable for the current session when storage is unavailable.
    }
  }

  return (
    <AnalysisContext.Provider
      value={{
        analyses,
        hydrated,
        getAnalysis: (id) => analyses.find((analysis) => analysis.id === id),
        saveAnalysis: (analysis) => persist([analysis, ...analyses.filter((item) => item.id !== analysis.id)]),
        deleteAnalysis: (id) => persist(analyses.filter((analysis) => analysis.id !== id))
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalyses() {
  const context = useContext(AnalysisContext);
  if (!context) throw new Error("useAnalyses must be used inside AnalysisProvider");
  return context;
}
