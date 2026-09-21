"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Banknote, Building2, CircleDollarSign, Gauge, Lightbulb, ShieldAlert, TrendingUp } from "lucide-react";
import { useAnalyses } from "@/components/providers/analysis-provider";
import { AnalysisTabs } from "@/components/analysis-tabs";
import { FinancialYear } from "@/lib/types";
import { calculateMetrics, growthRate, latestFinancials } from "@/lib/finance";
import { formatMoney, formatMultiple, formatPercent } from "@/lib/format";
import { PageHeading } from "@/components/page-heading";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfitabilityChart, RevenueChart } from "@/components/financial-charts";

export function CompanyAnalysisView() {
  const params = useParams<{ id: string }>();
  const { getAnalysis, hydrated } = useAnalyses();
  const analysis = getAnalysis(params.id);
  if (!hydrated && !analysis) return <Loading />;
  if (!analysis) return <NotFound />;

  const latest = latestFinancials(analysis);
  const metrics = calculateMetrics(analysis);
  const sorted = [...analysis.financials].sort((a, b) => a.year - b.year);
  const upside = analysis.currentSharePrice ? analysis.thesis.targetPrice / analysis.currentSharePrice - 1 : null;

  return (
    <>
      <PageHeading eyebrow={`${analysis.ticker} · ${analysis.industry}`} title={analysis.companyName} description={`Financial performance and valuation overview · Figures in ${analysis.currency} millions, except per-share data.`} actions={<><Button asChild variant="outline"><Link href="/"><ArrowLeft size={15} />Dashboard</Link></Button><Button asChild variant="accent"><Link href={`/analysis/${analysis.id}/thesis`}>Build thesis <ArrowUpRight size={15} /></Link></Button></>} />
      <AnalysisTabs id={analysis.id} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard accent label="Current share price" value={formatMoney(analysis.currentSharePrice, analysis.currency, false)} detail={`${analysis.thesis.recommendation} · ${formatPercent(upside)} implied upside`} icon={<TrendingUp size={18} />} />
        <MetricCard label="Market capitalisation" value={formatMoney(metrics.marketCap, analysis.currency)} detail={`${analysis.sharesOutstanding.toLocaleString()}m diluted shares`} icon={<Building2 size={18} />} />
        <MetricCard label="Enterprise value" value={formatMoney(metrics.enterpriseValue, analysis.currency)} detail={`Net cash ${formatMoney(analysis.cash - analysis.debt, analysis.currency)}`} icon={<Banknote size={18} />} />
        <MetricCard label="LTM revenue" value={formatMoney(latest?.revenue ?? 0, analysis.currency)} detail={`${formatPercent(metrics.revenueGrowth)} year-over-year`} icon={<CircleDollarSign size={18} />} />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="EBITDA margin" value={formatPercent(metrics.ebitdaMargin)} />
        <MetricCard label="Net margin" value={formatPercent(metrics.netMargin)} />
        <MetricCard label="FCF margin" value={formatPercent(metrics.fcfMargin)} />
        <MetricCard label="EV / Revenue" value={formatMultiple(metrics.evRevenue)} />
        <MetricCard label="EV / EBITDA" value={formatMultiple(metrics.evEbitda)} detail={`P / E ${formatMultiple(metrics.priceEarnings)}`} />
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <Card><CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle>Revenue development</CardTitle><p className="mt-1 text-xs text-slate-500">Annual revenue and growth trajectory</p></div><span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-slate-500"><i className="h-2 w-2 rounded-sm bg-accent" />Revenue</span></CardHeader><CardContent><RevenueChart financials={sorted} currency={analysis.currency} /></CardContent></Card>
        <Card><CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle>Profitability & cash flow</CardTitle><p className="mt-1 text-xs text-slate-500">EBITDA and free cash flow progression</p></div><div className="flex gap-3 text-[10px] font-semibold uppercase text-slate-500"><span className="flex items-center gap-1.5"><i className="h-0.5 w-3 bg-accent" />EBITDA</span><span className="flex items-center gap-1.5"><i className="h-0.5 w-3 bg-blue-300" />FCF</span></div></CardHeader><CardContent><ProfitabilityChart financials={sorted} currency={analysis.currency} /></CardContent></Card>
      </div>
      <Card className="mb-5 overflow-hidden"><CardHeader className="border-b"><CardTitle>Historical financial performance</CardTitle><p className="text-xs text-slate-500">Income statement and cash flow highlights</p></CardHeader><div className="scrollbar-thin overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50"><tr><th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{analysis.currency}m</th>{sorted.map((row) => <th key={row.year} className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">FY {row.year}</th>)}</tr></thead><tbody>{[
        { label: "Revenue", key: "revenue" as keyof FinancialYear, growth: true }, { label: "Revenue growth", key: "revenue" as keyof FinancialYear, percentGrowth: true }, { label: "EBITDA", key: "ebitda" as keyof FinancialYear }, { label: "EBITDA margin", key: "ebitda" as keyof FinancialYear, margin: true }, { label: "EBIT", key: "ebit" as keyof FinancialYear }, { label: "Net income", key: "netIncome" as keyof FinancialYear }, { label: "Net profit margin", key: "netIncome" as keyof FinancialYear, margin: true }, { label: "Free cash flow", key: "freeCashFlow" as keyof FinancialYear }, { label: "FCF margin", key: "freeCashFlow" as keyof FinancialYear, margin: true }
      ].map((item, rowIndex) => <tr key={item.label} className={rowIndex === 2 || rowIndex === 4 || rowIndex === 5 || rowIndex === 7 ? "border-t" : ""}><td className={`px-5 py-3 ${item.margin || item.percentGrowth ? "pl-8 text-xs text-slate-500" : "font-semibold text-ink"}`}>{item.label}</td>{sorted.map((row, index) => <td key={row.year} className="financial-number px-5 py-3 text-right text-slate-700">{item.percentGrowth ? formatPercent(growthRate(row.revenue, sorted[index - 1]?.revenue)) : item.margin ? formatPercent((row[item.key] as number) / row.revenue) : formatMoney(row[item.key] as number, analysis.currency)}</td>)}</tr>)}</tbody></table></div></Card>
      <Card><CardHeader className="border-b"><div className="flex items-center justify-between"><div><CardTitle>Investment case snapshot</CardTitle><p className="mt-1 text-xs text-slate-500">Current recommendation, catalysts and risks</p></div><Button asChild size="sm" variant="outline"><Link href={`/analysis/${analysis.id}/thesis`}>Edit thesis</Link></Button></div></CardHeader><CardContent className="grid gap-6 pt-5 lg:grid-cols-3"><div><p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500"><Lightbulb size={14} className="text-amber-500" />Core thesis</p><p className="text-sm leading-6 text-slate-600">{analysis.thesis.summary || "Add your investment thesis to connect the financial evidence to a clear recommendation."}</p></div><ListPreview title="Catalysts" icon={<Gauge size={14} className="text-emerald-600" />} items={analysis.thesis.catalysts} /><ListPreview title="Key risks" icon={<ShieldAlert size={14} className="text-red-500" />} items={analysis.thesis.risks} /></CardContent></Card>
    </>
  );
}

function ListPreview({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) { return <div><p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{icon}{title}</p><ul className="space-y-2">{items.filter(Boolean).slice(0, 3).map((item, index) => <li key={index} className="flex gap-2 text-sm leading-5 text-slate-600"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />{item}</li>)}{!items.some(Boolean) && <li className="text-sm text-slate-400">None added yet.</li>}</ul></div>; }
function Loading() { return <div className="animate-pulse"><div className="h-8 w-72 rounded bg-slate-200" /><div className="mt-8 grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-lg bg-slate-200" />)}</div></div>; }
function NotFound() { return <Card className="mx-auto max-w-lg p-10 text-center"><h1 className="text-xl font-bold">Analysis not found</h1><p className="mt-2 text-sm text-slate-500">This analysis may have been removed from local storage.</p><Button asChild className="mt-5"><Link href="/">Return to dashboard</Link></Button></Card>; }
