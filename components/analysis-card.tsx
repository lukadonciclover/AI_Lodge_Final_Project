"use client";

import Link from "next/link";
import { ArrowRight, Building2, MoreHorizontal, Trash2 } from "lucide-react";
import { CompanyAnalysis } from "@/lib/types";
import { calculateMetrics, latestFinancials } from "@/lib/finance";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function AnalysisCard({ analysis, onDelete }: { analysis: CompanyAnalysis; onDelete: () => void }) {
  const [menu, setMenu] = useState(false);
  const latest = latestFinancials(analysis);
  const metrics = calculateMetrics(analysis);

  return (
    <Card className="group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg">
      <div className="h-1 bg-gradient-to-r from-accent to-blue-300" />
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-blue-50 text-sm font-bold text-accent">{analysis.ticker.slice(0, 2)}</div>
            <div className="min-w-0"><h2 className="truncate font-semibold text-navy-950">{analysis.companyName}</h2><p className="mt-0.5 text-xs text-slate-500">{analysis.ticker} · {analysis.industry}</p></div>
          </div>
          <div className="relative">
            <Button aria-label="Analysis options" variant="ghost" size="icon" onClick={() => setMenu(!menu)}><MoreHorizontal size={18} /></Button>
            {menu && <div className="absolute right-0 top-10 z-10 w-36 rounded-md border bg-white p-1 shadow-lg"><button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50" onClick={onDelete}><Trash2 size={14} />Delete</button></div>}
          </div>
        </div>
        <div className="my-5 grid grid-cols-3 divide-x border-y py-4">
          <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Revenue</p><p className="financial-number mt-1 text-sm font-bold">{formatMoney(latest?.revenue ?? 0, analysis.currency)}</p></div>
          <div className="pl-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">EV</p><p className="financial-number mt-1 text-sm font-bold">{formatMoney(metrics.enterpriseValue, analysis.currency)}</p></div>
          <div className="pl-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Margin</p><p className="financial-number mt-1 text-sm font-bold">{formatPercent(metrics.ebitdaMargin)}</p></div>
        </div>
        <div className="flex items-center justify-between"><p className="text-[11px] text-slate-400">Updated {formatDate(analysis.updatedAt)}</p><Link href={`/analysis/${analysis.id}`} className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-blue-700">Open analysis <ArrowRight size={14} /></Link></div>
      </div>
    </Card>
  );
}
