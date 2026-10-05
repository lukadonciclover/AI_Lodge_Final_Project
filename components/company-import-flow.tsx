"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, ExternalLink, LoaderCircle, Search } from "lucide-react";
import { useAnalyses } from "@/components/providers/analysis-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { importedCompanyToAnalysis } from "@/lib/imports";
import type { CompanySearchResult, ImportedAnnualFinancials, ImportedCompany } from "@/lib/providers/types";

type Props = {
  onCancel: () => void;
  initialCompany?: ImportedCompany;
  existingId?: string;
  onConfirm?: (company: ImportedCompany, adjustedFields: string[]) => void;
};

type CompanyApiPayload = {
  error?: string;
  results?: CompanySearchResult[];
  company?: ImportedCompany;
};

const incomeFields = [
  ["Revenue", "revenueMillion"], ["Cost of revenue", "costOfRevenueMillion"], ["Gross profit", "grossProfitMillion"], ["EBITDA", "ebitdaMillion"],
  ["Operating income", "ebitMillion"], ["Net income", "netIncomeMillion"], ["EPS", "eps"],
] as const;
const balanceFields = [
  ["Cash & equivalents", "cashMillion"], ["Short-term investments", "shortTermInvestmentsMillion"],
  ["Total assets", "totalAssetsMillion"], ["Current assets", "currentAssetsMillion"], ["Current liabilities", "currentLiabilitiesMillion"], ["Short-term debt", "shortTermDebtMillion"],
  ["Long-term debt", "longTermDebtMillion"], ["Total debt", "debtMillion"],
  ["Total liabilities", "totalLiabilitiesMillion"], ["Shareholders' equity", "shareholdersEquityMillion"],
] as const;
const cashFlowFields = [
  ["Cash flow from operations", "cashFlowFromOperationsMillion"], ["Capital expenditure", "capitalExpenditureMillion"],
  ["Free cash flow", "freeCashFlowMillion"], ["Acquisitions", "acquisitionsMillion"],
  ["Dividends paid", "dividendsPaidMillion"], ["Share repurchases", "shareRepurchasesMillion"],
] as const;

export function CompanyImportFlow({ onCancel, initialCompany, existingId, onConfirm }: Props) {
  const router = useRouter();
  const { getAnalysis, saveAnalysis } = useAnalyses();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanySearchResult[]>([]);
  const [company, setCompany] = useState<ImportedCompany | null>(initialCompany ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [adjusted, setAdjusted] = useState<Set<string>>(new Set());

  async function searchCompanies(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 1) { setError("Enter a company name or ticker."); return; }
    setLoading(true); setError(""); setResults([]);
    try {
      const response = await fetch(`/api/companies/search?q=${encodeURIComponent(query.trim())}`);
      const payload = await readApiPayload(response);
      if (!response.ok) throw new Error(payload.error || "Company search failed.");
      const searchResults = payload.results ?? [];
      setResults(searchResults);
      if (!searchResults.length) setError("No listed companies matched that search. Check the name or ticker and try again.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to search companies. Please try again.");
    } finally { setLoading(false); }
  }

  async function selectCompany(result: CompanySearchResult) {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/companies/import", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbol: result.symbol }),
      });
      const payload = await readApiPayload(response);
      if (!response.ok || !payload.company) throw new Error(payload.error || "Financial statements could not be retrieved.");
      setCompany(payload.company);
      setAdjusted(new Set());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to import this company. Please try again.");
    } finally { setLoading(false); }
  }

  function confirmImport() {
    if (!company) return;
    const years = company.annualFinancials.map((period) => period.fiscalYear);
    if (!years.length) { setError("No annual financial periods are available to import."); return; }
    if (years.some((year) => !Number.isInteger(year)) || new Set(years).size !== years.length) { setError("Financial periods must use unique, valid annual fiscal years."); return; }
    const companyNumbers = [company.sharePrice, company.sharesOutstandingMillion, company.marketCapitalizationMillion, company.cashMillion, company.debtMillion];
    const statementNumbers = company.annualFinancials.flatMap((period) => Object.entries(period).filter(([key]) => key.endsWith("Million") || key === "eps").map(([, value]) => value));
    if ([...companyNumbers, ...statementNumbers].some((value) => value !== null && (typeof value !== "number" || !Number.isFinite(value)))) { setError("Every imported financial value must be a finite number or left blank as N/A."); return; }
    if (onConfirm) { onConfirm(company, Array.from(adjusted)); return; }
    const existing = existingId ? getAnalysis(existingId) : undefined;
    const analysis = importedCompanyToAnalysis(company, Array.from(adjusted), existing);
    saveAnalysis(analysis);
    router.push(`/analysis/${analysis.id}`);
  }

  if (company) {
    return <ImportReview company={company} adjusted={adjusted} setCompany={setCompany} setAdjusted={setAdjusted} error={error} onConfirm={confirmImport} onCancel={() => { if (initialCompany) onCancel(); else { setCompany(null); setError(""); } }} confirmLabel={existingId ? "Confirm changes" : "Confirm import"} />;
  }

  return (
    <div className="max-w-4xl">
      <Button variant="ghost" className="mb-5" onClick={onCancel}><ArrowLeft size={16} />Choose another method</Button>
      <Card>
        <CardHeader className="border-b"><CardTitle>Search listed companies</CardTitle><p className="text-sm text-slate-500">Search by legal company name or exchange ticker, then select the exact security to import.</p></CardHeader>
        <CardContent className="pt-5">
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={searchCompanies}>
            <div className="relative flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><Input aria-label="Company name or ticker" className="pl-9" placeholder="e.g. Apple or AAPL" value={query} onChange={(event) => { setQuery(event.target.value); setError(""); }} /></div>
            <Button type="submit" variant="accent" disabled={loading}>{loading ? <LoaderCircle className="animate-spin" size={16} /> : <Search size={16} />}Search</Button>
          </form>
          {error && <ErrorMessage message={error} />}
          {loading && <div className="mt-8 flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><LoaderCircle className="animate-spin text-accent" size={20} />Retrieving company data...</div>}
          {!loading && results.length > 0 && <div className="mt-6 overflow-hidden rounded-md border"><div className="bg-slate-50 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Select the correct company</div>{results.map((result) => <button key={`${result.symbol}-${result.exchange}`} type="button" className="flex w-full items-center justify-between gap-4 border-t px-4 py-4 text-left hover:bg-blue-50/50" onClick={() => selectCompany(result)}><span className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-xs font-bold text-accent">{result.symbol.slice(0, 2)}</span><span className="min-w-0"><strong className="block truncate text-sm text-ink">{result.name}</strong><span className="mt-0.5 block text-xs text-slate-500">{result.symbol} · {result.exchangeShortName ?? result.exchange ?? "Exchange unavailable"}</span></span></span><span className="shrink-0 text-right text-xs text-slate-400">{result.country ?? result.exchange ?? "Location unavailable"}{result.sourceProvider && <span className="block">Source: {result.sourceProvider}</span>}</span></button>)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}

type ReviewProps = {
  company: ImportedCompany;
  adjusted: Set<string>;
  setCompany: React.Dispatch<React.SetStateAction<ImportedCompany | null>>;
  setAdjusted: React.Dispatch<React.SetStateAction<Set<string>>>;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel: string;
};

function ImportReview({ company, adjusted, setCompany, setAdjusted, error, onConfirm, onCancel, confirmLabel }: ReviewProps) {
  function mark(path: string) { setAdjusted((current) => new Set(current).add(path)); }
  function setText(field: keyof ImportedCompany, value: string, analysisField = String(field)) {
    setCompany({ ...company, [field]: value || null }); mark(`company.${analysisField}`);
  }
  function setNumber(field: keyof ImportedCompany, value: string, analysisField = String(field)) {
    setCompany({ ...company, [field]: value === "" ? null : Number(value) }); mark(`company.${analysisField}`);
  }
  function setPeriod(index: number, field: keyof ImportedAnnualFinancials, value: string) {
    const numeric = field === "periodEnd" ? value || null : value === "" ? null : Number(value);
    setCompany({ ...company, annualFinancials: company.annualFinancials.map((period, periodIndex) => periodIndex === index ? { ...period, [field]: numeric } : period) });
    mark(`financials.${company.annualFinancials[index].fiscalYear}.${importFieldToAnalysisField(field)}`);
  }
  const sorted = [...company.annualFinancials].sort((a, b) => b.fiscalYear - a.fiscalYear);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 rounded-lg bg-navy-950 p-5 text-white sm:flex-row sm:items-center"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-300">Import review</p><h2 className="mt-1 text-xl font-bold">{company.name} <span className="text-slate-400">{company.symbol}</span></h2><p className="mt-1 text-xs text-slate-400">Source: {company.source.provider} · Retrieved {new Date(company.source.retrievedAt).toLocaleString()} · Currency {company.currency ?? "N/A"}</p></div><div className="flex gap-2"><Button variant="outline" onClick={onCancel}><ArrowLeft size={15} />Cancel</Button><Button variant="accent" onClick={onConfirm}><Check size={15} />{confirmLabel}</Button></div></div>
      {error && <ErrorMessage message={error} />}
      {company.warnings.length > 0 && <Card className="border-amber-200 bg-amber-50"><CardContent className="pt-5"><p className="flex items-center gap-2 text-sm font-bold text-amber-800"><AlertTriangle size={16} />Review source-data warnings</p><ul className="mt-3 space-y-1 text-xs leading-5 text-amber-800">{company.warnings.map((warning, index) => <li key={index}>• {warning}</li>)}</ul></CardContent></Card>}
      <Card><CardHeader className="border-b"><CardTitle>Company and market information</CardTitle><p className="text-sm text-slate-500">All imported values can be adjusted before confirmation.</p></CardHeader><CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <ReviewText label="Company name" path="company.companyName" value={company.name} adjusted={adjusted} onChange={(value) => setText("name", value, "companyName")} />
        <ReviewText label="Ticker" path="company.ticker" value={company.symbol} adjusted={adjusted} onChange={(value) => setText("symbol", value, "ticker")} />
        <ReviewText label="Exchange" path="company.exchange" value={company.exchange} adjusted={adjusted} onChange={(value) => setText("exchange", value)} />
        <ReviewText label="Country" path="company.country" value={company.country} adjusted={adjusted} onChange={(value) => setText("country", value)} />
        <ReviewText label="Sector" path="company.sector" value={company.sector} adjusted={adjusted} onChange={(value) => setText("sector", value)} />
        <ReviewText label="Industry" path="company.industry" value={company.industry} adjusted={adjusted} onChange={(value) => setText("industry", value)} />
        <ReviewText label="Reporting currency" path="company.currency" value={company.currency} adjusted={adjusted} onChange={(value) => setText("currency", value)} />
        <ReviewNumber label="Share price" path="company.currentSharePrice" value={company.sharePrice} adjusted={adjusted} onChange={(value) => setNumber("sharePrice", value, "currentSharePrice")} />
        <ReviewNumber label="Market cap (m)" path="company.marketCapitalization" value={company.marketCapitalizationMillion} adjusted={adjusted} onChange={(value) => setNumber("marketCapitalizationMillion", value, "marketCapitalization")} />
        <ReviewNumber label="Shares outstanding (m)" path="company.sharesOutstanding" value={company.sharesOutstandingMillion} adjusted={adjusted} onChange={(value) => setNumber("sharesOutstandingMillion", value, "sharesOutstanding")} />
        <div className="sm:col-span-2 lg:col-span-4"><Label>Company description</Label><Textarea rows={4} value={company.description ?? ""} onChange={(event) => setText("description", event.target.value)} />{adjusted.has("company.description") && <Adjusted />}</div>
      </CardContent></Card>
      <StatementTable title="Income statement" fields={incomeFields} periods={sorted} adjusted={adjusted} setPeriod={setPeriod} />
      <StatementTable title="Balance sheet" fields={balanceFields} periods={sorted} adjusted={adjusted} setPeriod={setPeriod} />
      <StatementTable title="Cash flow statement" fields={cashFlowFields} periods={sorted} adjusted={adjusted} setPeriod={setPeriod} />
      <div className="flex flex-col justify-between gap-3 rounded-lg border bg-white p-4 sm:flex-row sm:items-center"><p className="text-xs leading-5 text-slate-500">Missing values remain N/A and are never estimated. Figures are in {company.currency ?? "reporting currency"} millions except per-share data.</p><div className="flex gap-2"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button variant="accent" onClick={onConfirm}>{confirmLabel}</Button></div></div>
      {company.source.latestFiling && <a className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline" href={company.source.latestFiling.url} target="_blank" rel="noreferrer">Latest available filing <ExternalLink size={13} /></a>}
    </div>
  );
}

function StatementTable({ title, fields, periods, adjusted, setPeriod }: { title: string; fields: readonly (readonly [string, keyof ImportedAnnualFinancials])[]; periods: ImportedAnnualFinancials[]; adjusted: Set<string>; setPeriod: (index: number, field: keyof ImportedAnnualFinancials, value: string) => void }) {
  return <Card className="overflow-hidden"><CardHeader className="border-b"><CardTitle>{title}</CardTitle><p className="text-xs text-slate-500">Annual periods · reporting-currency millions unless noted</p></CardHeader><div className="scrollbar-thin overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-slate-500">Metric</th>{periods.map((period) => <th key={period.fiscalYear} className="px-3 py-3 text-right text-[10px] font-bold uppercase text-slate-500">FY {period.fiscalYear}<span className="block font-normal normal-case text-slate-400">{period.periodEnd ?? "Date N/A"}</span>{period.sourceProvider && <span className="block font-normal normal-case text-slate-400">{period.sourceProvider}{period.form ? ` · ${period.form}` : ""}</span>}</th>)}</tr></thead><tbody>{fields.map(([label, field]) => <tr key={field} className="border-t"><td className="whitespace-nowrap px-4 py-3 font-medium">{label}</td>{periods.map((period) => { const originalIndex = periods.indexOf(period); const path = `financials.${period.fiscalYear}.${importFieldToAnalysisField(field)}`; const value = period[field]; return <td key={period.fiscalYear} className="min-w-32 px-3 py-2"><Input aria-label={`${label} ${period.fiscalYear}`} type="number" step="any" className="text-right financial-number" placeholder="N/A" value={typeof value === "number" ? value : ""} onChange={(event) => setPeriod(originalIndex, field, event.target.value)} />{adjusted.has(path) && <Adjusted />}</td>; })}</tr>)}</tbody></table></div></Card>;
}

function ReviewText({ label, path, value, adjusted, onChange }: { label: string; path: string; value: string | null; adjusted: Set<string>; onChange: (value: string) => void }) { return <div><Label>{label}</Label><Input value={value ?? ""} placeholder="N/A" onChange={(event) => onChange(event.target.value)} />{adjusted.has(path) && <Adjusted />}</div>; }
function ReviewNumber({ label, path, value, adjusted, onChange }: { label: string; path: string; value: number | null; adjusted: Set<string>; onChange: (value: string) => void }) { return <div><Label>{label}</Label><Input type="number" step="any" value={value ?? ""} placeholder="N/A" onChange={(event) => onChange(event.target.value)} />{adjusted.has(path) && <Adjusted />}</div>; }
function Adjusted() { return <span className="mt-1 block text-[9px] font-bold uppercase tracking-wide text-amber-600">User adjusted</span>; }
function ErrorMessage({ message }: { message: string }) { return <div role="alert" className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>; }

async function readApiPayload(response: Response): Promise<CompanyApiPayload> {
  try {
    return await response.json();
  } catch {
    return { error: response.ok ? "The server returned an invalid response." : `The server request failed with status ${response.status}.` };
  }
}

function importFieldToAnalysisField(field: keyof ImportedAnnualFinancials) {
  const map: Partial<Record<keyof ImportedAnnualFinancials, string>> = {
    revenueMillion: "revenue", costOfRevenueMillion: "costOfRevenue", grossProfitMillion: "grossProfit", ebitdaMillion: "ebitda", ebitMillion: "ebit", netIncomeMillion: "netIncome", eps: "eps",
    cashMillion: "cash", shortTermInvestmentsMillion: "shortTermInvestments", totalAssetsMillion: "totalAssets", currentAssetsMillion: "currentAssets", currentLiabilitiesMillion: "currentLiabilities", shortTermDebtMillion: "shortTermDebt", longTermDebtMillion: "longTermDebt", debtMillion: "totalDebt", totalLiabilitiesMillion: "totalLiabilities", shareholdersEquityMillion: "shareholdersEquity",
    cashFlowFromOperationsMillion: "cashFlowFromOperations", capitalExpenditureMillion: "capitalExpenditure", freeCashFlowMillion: "freeCashFlow", acquisitionsMillion: "acquisitions", dividendsPaidMillion: "dividendsPaid", shareRepurchasesMillion: "shareRepurchases",
  };
  return map[field] ?? String(field);
}
