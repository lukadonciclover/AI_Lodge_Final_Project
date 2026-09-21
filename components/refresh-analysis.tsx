"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { CompanyImportFlow } from "@/components/company-import-flow";
import { useAnalyses } from "@/components/providers/analysis-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { importedCompanyToAnalysis, preserveUserAdjustments } from "@/lib/imports";
import type { ImportedCompany } from "@/lib/providers/types";

export function RefreshAnalysisView() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { getAnalysis, saveAnalysis, hydrated } = useAnalyses();
  const analysis = getAnalysis(params.id);
  const [company, setCompany] = useState<ImportedCompany | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!analysis?.source) return;
    const controller = new AbortController();
    fetch("/api/companies/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: analysis.ticker }), signal: controller.signal })
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Refresh failed."); return payload.company; })
      .then(setCompany)
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError instanceof Error ? requestError.message : "Unable to refresh financials."); });
    return () => controller.abort();
  }, [analysis]);

  if (!hydrated && !analysis) return <div className="h-64 animate-pulse rounded-lg bg-slate-200" />;
  if (!analysis) return <Card className="p-8 text-center">Analysis not found.</Card>;
  if (!analysis.source) return <Card className="p-8 text-center"><p className="font-semibold">Manual analyses do not have an external source to refresh.</p><Button asChild className="mt-4"><Link href={`/analysis/${analysis.id}`}>Return to analysis</Link></Button></Card>;
  if (error) return <Card className="p-8 text-center"><p className="text-sm text-red-700">{error}</p><Button asChild className="mt-4" variant="outline"><Link href={`/analysis/${analysis.id}`}><ArrowLeft size={15} />Return to analysis</Link></Button></Card>;
  if (!company) return <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-500"><LoaderCircle className="animate-spin text-accent" size={20} />Retrieving refreshed annual statements...</div>;

  return <><div className="mb-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"><span className="font-semibold">Refresh comparison:</span> review the latest provider values before confirming. {analysis.userAdjustedFields?.length ? `${analysis.userAdjustedFields.length} previously adjusted value(s) will be preserved.` : "No existing user adjustments were detected."}</div><CompanyImportFlow initialCompany={company} existingId={analysis.id} onCancel={() => router.push(`/analysis/${analysis.id}`)} onConfirm={(reviewed, newAdjusted) => { const allAdjusted = Array.from(new Set([...(analysis.userAdjustedFields ?? []), ...newAdjusted])); const refreshed = importedCompanyToAnalysis(reviewed, allAdjusted, analysis); saveAnalysis(preserveUserAdjustments(analysis, refreshed)); router.push(`/analysis/${analysis.id}`); }} /></>;
}
