"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, Check, LineChart, Plus, Trash2 } from "lucide-react";
import { useAnalyses } from "@/components/providers/analysis-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FinancialYear } from "@/lib/types";
import { cn } from "@/lib/utils";

type CompanyFields = { companyName: string; ticker: string; industry: string; currency: string; currentSharePrice: string; sharesOutstanding: string; cash: string; debt: string };
const currentYear = new Date().getFullYear() - 1;
const emptyFinancial = (year: number): FinancialYear => ({ year, revenue: 0, ebitda: 0, ebit: 0, netIncome: 0, freeCashFlow: 0 });

export function AnalysisForm() {
  const router = useRouter();
  const { saveAnalysis } = useAnalyses();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [company, setCompany] = useState<CompanyFields>({ companyName: "", ticker: "", industry: "", currency: "USD", currentSharePrice: "", sharesOutstanding: "", cash: "", debt: "" });
  const [financials, setFinancials] = useState<FinancialYear[]>([emptyFinancial(currentYear), emptyFinancial(currentYear - 1), emptyFinancial(currentYear - 2)]);

  function setField(field: keyof CompanyFields, value: string) { setCompany((current) => ({ ...current, [field]: value })); }
  function setFinancial(index: number, field: keyof FinancialYear, value: number) { setFinancials((items) => items.map((item, i) => i === index ? { ...item, [field]: value } : item)); }

  function validateCompany() {
    if (!company.companyName.trim() || !company.ticker.trim() || !company.industry.trim()) return "Complete the company name, ticker and industry.";
    const numeric = [company.currentSharePrice, company.sharesOutstanding, company.cash, company.debt];
    if (numeric.some((value) => value === "" || Number(value) < 0 || !Number.isFinite(Number(value)))) return "Enter valid, non-negative values for all company financial fields.";
    if (Number(company.currentSharePrice) === 0 || Number(company.sharesOutstanding) === 0) return "Share price and shares outstanding must be greater than zero.";
    return "";
  }

  function continueToFinancials() { const message = validateCompany(); setError(message); if (!message) setStep(2); }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (financials.some((row) => !Number.isInteger(row.year) || row.year < 1900 || Object.values(row).some((value) => !Number.isFinite(value)))) { setError("Check that every financial input contains a valid number."); return; }
    if (new Set(financials.map((row) => row.year)).size !== financials.length) { setError("Each financial row must use a different year."); return; }
    if (financials.some((row) => row.revenue <= 0)) { setError("Revenue must be greater than zero for every year."); return; }
    const id = `${company.ticker.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
    saveAnalysis({ id, companyName: company.companyName.trim(), ticker: company.ticker.trim().toUpperCase(), industry: company.industry.trim(), currency: company.currency, currentSharePrice: Number(company.currentSharePrice), sharesOutstanding: Number(company.sharesOutstanding), cash: Number(company.cash), debt: Number(company.debt), financials: [...financials].sort((a, b) => a.year - b.year), thesis: { summary: "", recommendation: "Hold", targetPrice: Number(company.currentSharePrice), catalysts: [""], risks: [""] }, updatedAt: new Date().toISOString() });
    router.push(`/analysis/${id}`);
  }

  const numberFields: { key: keyof CompanyFields; label: string; suffix: string; placeholder: string }[] = [
    { key: "currentSharePrice", label: "Current share price", suffix: company.currency, placeholder: "0.00" },
    { key: "sharesOutstanding", label: "Shares outstanding", suffix: "millions", placeholder: "0" },
    { key: "cash", label: "Cash & equivalents", suffix: "millions", placeholder: "0" },
    { key: "debt", label: "Total debt", suffix: "millions", placeholder: "0" }
  ];
  const financialFields: { key: Exclude<keyof FinancialYear, "year">; label: string }[] = [{ key: "revenue", label: "Revenue" }, { key: "ebitda", label: "EBITDA" }, { key: "ebit", label: "EBIT" }, { key: "netIncome", label: "Net income" }, { key: "freeCashFlow", label: "Free cash flow" }];

  return (
    <form onSubmit={submit}>
      <div className="mb-7 flex max-w-xl items-center">
        {[{ n: 1, label: "Company details", icon: Building2 }, { n: 2, label: "Financial history", icon: LineChart }].map((item, index) => <div key={item.n} className={cn("flex items-center", index === 0 && "flex-1")}><div className="flex items-center gap-2"><span className={cn("flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold", step >= item.n ? "border-accent bg-accent text-white" : "bg-white text-slate-400")}>{step > item.n ? <Check size={14} /> : item.n}</span><span className={cn("hidden text-xs font-semibold sm:block", step >= item.n ? "text-ink" : "text-slate-400")}>{item.label}</span></div>{index === 0 && <div className={cn("mx-4 h-px flex-1", step > 1 ? "bg-accent" : "bg-line")} />}</div>)}
      </div>
      {error && <div role="alert" className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {step === 1 ? <Card className="max-w-4xl"><CardHeader className="border-b"><CardTitle>Company information</CardTitle><p className="text-sm text-slate-500">Enter balance sheet values in millions. These inputs drive the valuation calculations.</p></CardHeader><CardContent className="grid gap-5 pt-5 sm:grid-cols-2">
        <div><Label htmlFor="companyName">Company name</Label><Input id="companyName" placeholder="e.g. Acme Corporation" value={company.companyName} onChange={(e) => setField("companyName", e.target.value)} /></div>
        <div><Label htmlFor="ticker">Ticker</Label><Input id="ticker" placeholder="e.g. ACME" maxLength={8} value={company.ticker} onChange={(e) => setField("ticker", e.target.value.toUpperCase())} /></div>
        <div><Label htmlFor="industry">Industry</Label><Input id="industry" placeholder="e.g. Enterprise Software" value={company.industry} onChange={(e) => setField("industry", e.target.value)} /></div>
        <div><Label htmlFor="currency">Currency</Label><select id="currency" className="h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-blue-100" value={company.currency} onChange={(e) => setField("currency", e.target.value)}>{["USD", "EUR", "GBP", "CAD", "AUD"].map((value) => <option key={value}>{value}</option>)}</select></div>
        {numberFields.map((field) => <div key={field.key}><Label htmlFor={field.key}>{field.label}</Label><div className="relative"><Input id={field.key} type="number" min="0" step="any" placeholder={field.placeholder} className="pr-20" value={company[field.key]} onChange={(e) => setField(field.key, e.target.value)} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-slate-400">{field.suffix}</span></div></div>)}
        <div className="flex justify-end border-t pt-5 sm:col-span-2"><Button type="button" variant="accent" onClick={continueToFinancials}>Continue <ArrowRight size={16} /></Button></div>
      </CardContent></Card> : <Card><CardHeader className="border-b"><CardTitle>Historical financials</CardTitle><p className="text-sm text-slate-500">Add up to five years. Enter all figures in {company.currency} millions.</p></CardHeader><CardContent className="pt-5"><div className="scrollbar-thin overflow-x-auto"><table className="w-full min-w-[800px] text-left"><thead><tr>{["Year", ...financialFields.map((field) => field.label), ""].map((label) => <th key={label} className="pb-3 pr-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</th>)}</tr></thead><tbody>{financials.map((row, index) => <tr key={index} className="border-t"><td className="w-28 py-3 pr-3"><Input aria-label={`Year ${index + 1}`} type="number" min="1900" max="2100" value={row.year} onChange={(e) => setFinancial(index, "year", Number(e.target.value))} /></td>{financialFields.map((field) => <td key={field.key} className="py-3 pr-3"><Input aria-label={`${field.label} for row ${index + 1}`} type="number" step="any" value={row[field.key]} onChange={(e) => setFinancial(index, field.key, Number(e.target.value))} /></td>)}<td className="py-3"><Button aria-label={`Delete year ${row.year}`} type="button" variant="ghost" size="icon" disabled={financials.length === 1} onClick={() => setFinancials(financials.filter((_, i) => i !== index))}><Trash2 size={15} /></Button></td></tr>)}</tbody></table></div>
        <div className="mt-4 flex flex-col justify-between gap-3 border-t pt-5 sm:flex-row"><Button type="button" variant="outline" size="sm" disabled={financials.length >= 5} onClick={() => setFinancials([...financials, emptyFinancial(Math.min(...financials.map((row) => row.year)) - 1)])}><Plus size={15} />Add year</Button><div className="flex gap-2"><Button type="button" variant="ghost" onClick={() => { setError(""); setStep(1); }}><ArrowLeft size={16} />Back</Button><Button type="submit" variant="accent">Create analysis <ArrowRight size={16} /></Button></div></div>
      </CardContent></Card>}
    </form>
  );
}
