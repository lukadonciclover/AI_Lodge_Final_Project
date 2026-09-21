"use client";

import { useParams, useRouter } from "next/navigation";
import { CompanyImportFlow } from "@/components/company-import-flow";
import { useAnalyses } from "@/components/providers/analysis-provider";
import { Card } from "@/components/ui/card";
import { analysisToImportedCompany, importedCompanyToAnalysis } from "@/lib/imports";

export function EditAnalysisView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { getAnalysis, saveAnalysis, hydrated } = useAnalyses();
  const analysis = getAnalysis(params.id);
  if (!hydrated && !analysis) return <div className="h-64 animate-pulse rounded-lg bg-slate-200" />;
  if (!analysis) return <Card className="p-8 text-center">Analysis not found.</Card>;
  return <CompanyImportFlow initialCompany={analysisToImportedCompany(analysis)} existingId={analysis.id} onCancel={() => router.push(`/analysis/${analysis.id}`)} onConfirm={(company, adjustedFields) => { const allAdjusted = Array.from(new Set([...(analysis.userAdjustedFields ?? []), ...adjustedFields])); saveAnalysis(importedCompanyToAnalysis(company, allAdjusted, analysis)); router.push(`/analysis/${analysis.id}`); }} />;
}
