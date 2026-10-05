"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Banknote, Building2, CircleDollarSign, ExternalLink, Gauge, Lightbulb, RefreshCw, ShieldAlert, TrendingUp } from "lucide-react";
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
      <PageHeading eyebrow={`${analysis.ticker} · ${analysis.industry}`} title={analysis.companyName} description={`Financial performance and valuation overview · Figures in ${analysis.currency} millions, except per-share data.`} actions={<><Button asChild variant="outline"><Link href="/"><ArrowLeft size={15} />Dashboard</Link></Button><Button asChild variant="outline"><Link href={`/analysis/${analysis.id}/edit`}>Edit data</Link></Button>{analysis.source && <Button asChild variant="outline"><Link href={`/analysis/${analysis.id}/refresh`}><RefreshCw size={15} />Refresh financials</Link></Button>}<Button asChild variant="accent"><Link href={`/analysis/${analysis.id}/thesis`}>Build thesis <ArrowUpRight size={15} /></Link></Button></>} />
      <AnalysisTabs id={analysis.id} />
      {analysis.source && <div className="mb-5 flex flex-col justify-between gap-3 rounded-md border bg-white px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center"><span><strong className="text-slate-700">Source:</strong> {analysis.source.provider} · Last updated {new Date(analysis.source.retrievedAt).toLocaleString()}</span>{analysis.source.latestFilingUrl && <a href={analysis.source.latestFilingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline">Latest available filing <ExternalLink size={13} /></a>}</div>}
      {analysis.importWarnings && analysis.importWarnings.length > 0 && <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"><strong>Source-data warnings:</strong> {analysis.importWarnings.slice(0, 3).join(" · ")}{analysis.importWarnings.length > 3 ? ` · ${analysis.importWarnings.length - 3} more available in Edit data` : ""}</div>}
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard accent label="Current share price" value={formatMoney(analysis.currentSharePrice, analysis.currency, false)} detail={`${analysis.thesis.recommendation} · ${formatPercent(upside)} implied upside`} icon={<TrendingUp size={18} />} />
        <MetricCard label="Market capitalisation" value={formatMoney(metrics.marketCap, analysis.currency)} detail={`${analysis.sharesOutstanding?.toLocaleString() ?? "N/A"}m diluted shares`} icon={<Building2 size={18} />} />
        <MetricCard label="Enterprise value" value={formatMoney(metrics.enterpriseValue, analysis.currency)} detail={`Net debt ${formatMoney(metrics.netDebt, analysis.currency)}`} icon={<Banknote size={18} />} />
        <MetricCard label="LTM revenue" value={formatMoney(latest?.revenue ?? 0, analysis.currency)} detail={`${formatPercent(metrics.revenueGrowth)} year-over-year`} icon={<CircleDollarSign size={18} />} />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Revenue CAGR" value={formatPercent(metrics.revenueCagr)} />
        <MetricCard label="Gross margin" value={formatPercent(metrics.grossMargin)} />
        <MetricCard label="EBITDA margin" value={formatPercent(metrics.ebitdaMargin)} />
        <MetricCard label="Operating margin" value={formatPercent(metrics.operatingMargin)} />
        <MetricCard label="Net margin" value={formatPercent(metrics.netMargin)} />
        <MetricCard label="FCF margin" value={formatPercent(metrics.fcfMargin)} />
        <MetricCard label="EV / Revenue" value={formatMultiple(metrics.evRevenue)} />
        <MetricCard label="EV / EBITDA" value={formatMultiple(metrics.evEbitda)} detail={`P / E ${formatMultiple(metrics.priceEarnings)}`} />
        <MetricCard label="FCF yield" value={formatPercent(metrics.fcfYield)} />
        <MetricCard label="Return on equity" value={formatPercent(metrics.returnOnEquity)} />
      </div>
      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <Card><CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle>Revenue development</CardTitle><p className="mt-1 text-xs text-slate-500">Annual revenue and growth trajectory</p></div><span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-slate-500"><i className="h-2 w-2 rounded-sm bg-accent" />Revenue</span></CardHeader><CardContent><RevenueChart financials={sorted} currency={analysis.currency} /></CardContent></Card>
        <Card><CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle>Profitability & cash flow</CardTitle><p className="mt-1 text-xs text-slate-500">EBITDA and free cash flow progression</p></div><div className="flex gap-3 text-[10px] font-semibold uppercase text-slate-500"><span className="flex items-center gap-1.5"><i className="h-0.5 w-3 bg-accent" />EBITDA</span><span className="flex items-center gap-1.5"><i className="h-0.5 w-3 bg-blue-300" />FCF</span></div></CardHeader><CardContent><ProfitabilityChart financials={sorted} currency={analysis.currency} /></CardContent></Card>
      </div>
      <FinancialHistoryTable financials={sorted} currency={analysis.currency} />
      <Card><CardHeader className="border-b"><div className="flex items-center justify-between"><div><CardTitle>Investment case snapshot</CardTitle><p className="mt-1 text-xs text-slate-500">Current recommendation, catalysts and risks</p></div><Button asChild size="sm" variant="outline"><Link href={`/analysis/${analysis.id}/thesis`}>Edit thesis</Link></Button></div></CardHeader><CardContent className="grid gap-6 pt-5 lg:grid-cols-3"><div><p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500"><Lightbulb size={14} className="text-amber-500" />Core thesis</p><p className="text-sm leading-6 text-slate-600">{analysis.thesis.summary || "Add your investment thesis to connect the financial evidence to a clear recommendation."}</p></div><ListPreview title="Catalysts" icon={<Gauge size={14} className="text-emerald-600" />} items={analysis.thesis.catalysts} /><ListPreview title="Key risks" icon={<ShieldAlert size={14} className="text-red-500" />} items={analysis.thesis.risks} /></CardContent></Card>
    </>
  );
}

function financialMargin(value: FinancialYear[keyof FinancialYear], revenue: number | null) {
  return typeof value === "number" && revenue ? value / revenue : null;
}

const financialRows: { label: string; key: keyof FinancialYear; kind?: "growth" | "margin" | "perShare"; section?: boolean }[] = [
  { label: "Revenue", key: "revenue" },
  { label: "Revenue growth", key: "revenue", kind: "growth" },
  { label: "Gross profit", key: "grossProfit", section: true },
  { label: "Gross margin", key: "grossProfit", kind: "margin" },
  { label: "EBITDA", key: "ebitda", section: true },
  { label: "EBITDA margin", key: "ebitda", kind: "margin" },
  { label: "Operating income", key: "ebit", section: true },
  { label: "Operating margin", key: "ebit", kind: "margin" },
  { label: "Net income", key: "netIncome", section: true },
  { label: "Net profit margin", key: "netIncome", kind: "margin" },
  { label: "EPS", key: "eps", kind: "perShare" },
  { label: "Cash flow from operations", key: "cashFlowFromOperations", section: true },
  { label: "Capital expenditure", key: "capitalExpenditure" },
  { label: "Free cash flow", key: "freeCashFlow" },
  { label: "FCF margin", key: "freeCashFlow", kind: "margin" },
  { label: "Acquisitions", key: "acquisitions" },
  { label: "Dividends paid", key: "dividendsPaid" },
  { label: "Share repurchases", key: "shareRepurchases" },
  { label: "Cash & equivalents", key: "cash", section: true },
  { label: "Short-term investments", key: "shortTermInvestments" },
  { label: "Total assets", key: "totalAssets" },
  { label: "Short-term debt", key: "shortTermDebt" },
  { label: "Long-term debt", key: "longTermDebt" },
  { label: "Total debt", key: "totalDebt" },
  { label: "Total liabilities", key: "totalLiabilities" },
  { label: "Shareholders' equity", key: "shareholdersEquity" },
];

function FinancialHistoryTable({ financials, currency }: { financials: FinancialYear[]; currency: string }) {
  return <Card className="mb-5 overflow-hidden"><CardHeader className="border-b"><CardTitle>Historical financial performance</CardTitle><p className="text-xs text-slate-500">Annual income statement, balance sheet and cash-flow data</p></CardHeader><div className="scrollbar-thin overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50"><tr><th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">{currency}m</th>{financials.map((row) => <th key={row.year} className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">FY {row.year}<span className="block font-normal normal-case text-slate-400">{row.periodEnd ?? ""}</span></th>)}</tr></thead><tbody>{financialRows.map((item) => <tr key={item.label} className={item.section ? "border-t" : ""}><td className={`px-5 py-3 ${item.kind === "margin" || item.kind === "growth" ? "pl-8 text-xs text-slate-500" : "font-semibold text-ink"}`}>{item.label}</td>{financials.map((row, index) => { const value = row[item.key]; const display = item.kind === "growth" ? formatPercent(growthRate(row.revenue, financials[index - 1]?.revenue)) : item.kind === "margin" ? formatPercent(financialMargin(value, row.revenue)) : item.kind === "perShare" ? formatMoney(typeof value === "number" ? value : null, currency, false) : formatMoney(typeof value === "number" ? value : null, currency); return <td key={row.year} className="financial-number px-5 py-3 text-right text-slate-700">{display}</td>; })}</tr>)}</tbody></table></div></Card>;
}

function ListPreview({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) { return <div><p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">{icon}{title}</p><ul className="space-y-2">{items.filter(Boolean).slice(0, 3).map((item, index) => <li key={index} className="flex gap-2 text-sm leading-5 text-slate-600"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />{item}</li>)}{!items.some(Boolean) && <li className="text-sm text-slate-400">None added yet.</li>}</ul></div>; }
function Loading() { return <div className="animate-pulse"><div className="h-8 w-72 rounded bg-slate-200" /><div className="mt-8 grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-lg bg-slate-200" />)}</div></div>; }
function NotFound() { return <Card className="mx-auto max-w-lg p-10 text-center"><h1 className="text-xl font-bold">Analysis not found</h1><p className="mt-2 text-sm text-slate-500">This analysis may have been removed from local storage.</p><Button asChild className="mt-5"><Link href="/">Return to dashboard</Link></Button></Card>; }
