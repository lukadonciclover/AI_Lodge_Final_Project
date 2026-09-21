"use client";

import Link from "next/link";
import { Activity, ArrowUpRight, BarChart3, BriefcaseBusiness, Plus } from "lucide-react";
import { useAnalyses } from "@/components/providers/analysis-provider";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { AnalysisCard } from "@/components/analysis-card";
import { Card } from "@/components/ui/card";
import { calculateMetrics } from "@/lib/finance";
import { formatMoney } from "@/lib/format";

export default function DashboardPage() {
  const { analyses, deleteAnalysis } = useAnalyses();
  const totalMarketCap = analyses.reduce((sum, item) => sum + calculateMetrics(item).marketCap, 0);

  return (
    <>
      <PageHeading eyebrow="Portfolio workspace" title="Analysis dashboard" description="Build, compare and refine your equity research in one place." actions={<Button asChild variant="accent"><Link href="/new"><Plus size={16} />New analysis</Link></Button>} />
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-4"><div className="rounded-md bg-blue-50 p-2.5 text-accent"><BriefcaseBusiness size={19} /></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Companies covered</p><p className="financial-number mt-1 text-xl font-bold">{analyses.length}</p></div></Card>
        <Card className="flex items-center gap-4 p-4"><div className="rounded-md bg-emerald-50 p-2.5 text-emerald-600"><Activity size={19} /></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active recommendations</p><p className="financial-number mt-1 text-xl font-bold">{analyses.filter((a) => a.thesis.recommendation === "Buy").length} Buy</p></div></Card>
        <Card className="flex items-center gap-4 p-4"><div className="rounded-md bg-indigo-50 p-2.5 text-indigo-600"><BarChart3 size={19} /></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Combined market cap</p><p className="financial-number mt-1 text-xl font-bold">{formatMoney(totalMarketCap)}</p></div></Card>
      </div>
      <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-navy-950">Company analyses</h2><p className="mt-1 text-xs text-slate-500">Your saved research and financial models</p></div><span className="text-xs font-medium text-slate-400">{analyses.length} total</span></div>
      {analyses.length ? <div className="grid gap-4 xl:grid-cols-2">{analyses.map((analysis) => <AnalysisCard key={analysis.id} analysis={analysis} onDelete={() => deleteAnalysis(analysis.id)} />)}<Link href="/new" className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/50 text-center transition-colors hover:border-accent hover:bg-blue-50/40"><span className="mb-3 rounded-full border bg-white p-3 text-accent shadow-sm"><Plus size={20} /></span><span className="text-sm font-semibold">Start a new company</span><span className="mt-1 text-xs text-slate-500">Add financials and build your case</span></Link></div> : <Card className="flex min-h-72 flex-col items-center justify-center p-8 text-center"><ArrowUpRight className="mb-4 text-accent" /><h2 className="font-semibold">Start your first analysis</h2><p className="mt-2 max-w-sm text-sm text-slate-500">Enter a company’s core financials to calculate valuation and operating metrics.</p><Button asChild className="mt-5" variant="accent"><Link href="/new">Create analysis</Link></Button></Card>}
    </>
  );
}
