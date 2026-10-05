import type { CompanyAnalysis, FinancialYear } from "@/lib/types";
import type { ImportedAnnualFinancials, ImportedCompany } from "@/lib/providers/types";

export const importedFinancialFieldMap: Record<string, keyof ImportedAnnualFinancials> = {
  revenue: "revenueMillion",
  costOfRevenue: "costOfRevenueMillion",
  grossProfit: "grossProfitMillion",
  ebitda: "ebitdaMillion",
  ebit: "ebitMillion",
  netIncome: "netIncomeMillion",
  eps: "eps",
  cash: "cashMillion",
  shortTermInvestments: "shortTermInvestmentsMillion",
  totalAssets: "totalAssetsMillion",
  currentAssets: "currentAssetsMillion",
  currentLiabilities: "currentLiabilitiesMillion",
  shortTermDebt: "shortTermDebtMillion",
  longTermDebt: "longTermDebtMillion",
  totalDebt: "debtMillion",
  totalLiabilities: "totalLiabilitiesMillion",
  shareholdersEquity: "shareholdersEquityMillion",
  cashFlowFromOperations: "cashFlowFromOperationsMillion",
  capitalExpenditure: "capitalExpenditureMillion",
  freeCashFlow: "freeCashFlowMillion",
  acquisitions: "acquisitionsMillion",
  dividendsPaid: "dividendsPaidMillion",
  shareRepurchases: "shareRepurchasesMillion",
};

function toFinancialYear(period: ImportedAnnualFinancials): FinancialYear {
  const value = (field: keyof typeof importedFinancialFieldMap) => {
    const result = period[importedFinancialFieldMap[field]];
    return typeof result === "number" && Number.isFinite(result) ? result : null;
  };
  return {
    year: period.fiscalYear,
    periodEnd: period.periodEnd,
    revenue: value("revenue"),
    costOfRevenue: value("costOfRevenue"),
    grossProfit: value("grossProfit"),
    ebitda: value("ebitda"),
    ebit: value("ebit"),
    netIncome: value("netIncome"),
    eps: value("eps"),
    cash: value("cash"),
    shortTermInvestments: value("shortTermInvestments"),
    totalAssets: value("totalAssets"),
    currentAssets: value("currentAssets"),
    currentLiabilities: value("currentLiabilities"),
    shortTermDebt: value("shortTermDebt"),
    longTermDebt: value("longTermDebt"),
    totalDebt: value("totalDebt"),
    totalLiabilities: value("totalLiabilities"),
    shareholdersEquity: value("shareholdersEquity"),
    cashFlowFromOperations: value("cashFlowFromOperations"),
    capitalExpenditure: value("capitalExpenditure"),
    freeCashFlow: value("freeCashFlow"),
    acquisitions: value("acquisitions"),
    dividendsPaid: value("dividendsPaid"),
    shareRepurchases: value("shareRepurchases"),
    filingDate: period.filingDate ?? null,
    fiscalPeriod: period.fiscalPeriod ?? null,
    form: period.form ?? null,
    accessionNumber: period.accessionNumber ?? null,
    sourceProvider: period.sourceProvider ?? null,
  };
}

export function importedCompanyToAnalysis(
  company: ImportedCompany,
  adjustedFields: string[] = [],
  existing?: CompanyAnalysis,
): CompanyAnalysis {
  const latest = company.annualFinancials[0];
  const currency = company.currency ?? latest?.currency ?? "N/A";
  return {
    id: existing?.id ?? `${company.symbol.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`,
    companyName: company.name,
    ticker: company.symbol,
    industry: company.industry ?? "N/A",
    sector: company.sector,
    exchange: company.exchange,
    country: company.country,
    description: company.description,
    currency,
    currentSharePrice: company.sharePrice,
    sharesOutstanding: company.sharesOutstandingMillion,
    marketCapitalization: company.marketCapitalizationMillion,
    cash: latest ? latest.cashMillion : company.cashMillion,
    debt: latest ? latest.debtMillion : company.debtMillion,
    financials: company.annualFinancials.map(toFinancialYear).sort((a, b) => a.year - b.year),
    thesis: existing?.thesis ?? {
      summary: "",
      recommendation: "Hold",
      targetPrice: company.sharePrice ?? 0,
      catalysts: [""],
      risks: [""],
    },
    source: existing && !existing.source ? null : {
      provider: company.source.provider,
      retrievedAt: company.source.retrievedAt,
      latestFilingUrl: company.source.latestFiling?.url ?? null,
    },
    importWarnings: company.warnings,
    userAdjustedFields: adjustedFields,
    updatedAt: new Date().toISOString(),
  };
}

export function preserveUserAdjustments(existing: CompanyAnalysis, refreshed: CompanyAnalysis) {
  const adjusted = new Set(existing.userAdjustedFields ?? []);
  const companyFields: (keyof CompanyAnalysis)[] = [
    "companyName", "ticker", "industry", "sector", "exchange", "country", "description", "currency",
    "currentSharePrice", "sharesOutstanding", "marketCapitalization", "cash", "debt",
  ];
  for (const field of companyFields) {
    if (adjusted.has(`company.${String(field)}`)) (refreshed[field] as unknown) = existing[field];
  }
  refreshed.financials = refreshed.financials.map((period) => {
    const previous = existing.financials.find((item) => item.year === period.year);
    if (!previous) return period;
    const next = { ...period };
    for (const field of Object.keys(importedFinancialFieldMap) as (keyof FinancialYear)[]) {
      if (adjusted.has(`financials.${period.year}.${String(field)}`)) {
        (next[field] as unknown) = previous[field];
      }
    }
    return next;
  });
  const latest = [...refreshed.financials].sort((a, b) => b.year - a.year)[0];
  if (latest) {
    refreshed.cash = latest.cash ?? null;
    refreshed.debt = latest.totalDebt ?? null;
  }
  refreshed.userAdjustedFields = Array.from(adjusted);
  refreshed.thesis = existing.thesis;
  return refreshed;
}

export function analysisToImportedCompany(analysis: CompanyAnalysis): ImportedCompany {
  const currency = analysis.currency === "N/A" ? null : analysis.currency;
  return {
    symbol: analysis.ticker,
    name: analysis.companyName,
    industry: analysis.industry,
    sector: analysis.sector ?? null,
    exchange: analysis.exchange ?? null,
    country: analysis.country ?? null,
    website: null,
    description: analysis.description ?? null,
    currency,
    sharePrice: analysis.currentSharePrice,
    sharesOutstandingMillion: analysis.sharesOutstanding,
    marketCapitalizationMillion: analysis.marketCapitalization ?? null,
    cashMillion: analysis.cash,
    debtMillion: analysis.debt,
    annualFinancials: [...analysis.financials].sort((a, b) => b.year - a.year).map((period) => ({
      fiscalYear: period.year,
      periodEnd: period.periodEnd ?? null,
      currency,
      currencies: { incomeStatement: currency, balanceSheet: currency, cashFlowStatement: currency },
      revenueMillion: period.revenue,
      costOfRevenueMillion: period.costOfRevenue ?? null,
      grossProfitMillion: period.grossProfit ?? null,
      ebitdaMillion: period.ebitda,
      ebitMillion: period.ebit,
      netIncomeMillion: period.netIncome,
      eps: period.eps ?? null,
      cashMillion: period.cash ?? null,
      shortTermInvestmentsMillion: period.shortTermInvestments ?? null,
      totalAssetsMillion: period.totalAssets ?? null,
      currentAssetsMillion: period.currentAssets ?? null,
      currentLiabilitiesMillion: period.currentLiabilities ?? null,
      shortTermDebtMillion: period.shortTermDebt ?? null,
      longTermDebtMillion: period.longTermDebt ?? null,
      debtMillion: period.totalDebt ?? null,
      totalLiabilitiesMillion: period.totalLiabilities ?? null,
      shareholdersEquityMillion: period.shareholdersEquity ?? null,
      cashFlowFromOperationsMillion: period.cashFlowFromOperations ?? null,
      capitalExpenditureMillion: period.capitalExpenditure ?? null,
      freeCashFlowMillion: period.freeCashFlow,
      acquisitionsMillion: period.acquisitions ?? null,
      dividendsPaidMillion: period.dividendsPaid ?? null,
      shareRepurchasesMillion: period.shareRepurchases ?? null,
      dilutedSharesOutstandingMillion: null,
      filingDate: period.filingDate ?? null,
      fiscalPeriod: period.fiscalPeriod ?? null,
      form: period.form ?? null,
      accessionNumber: period.accessionNumber ?? null,
      sourceProvider: period.sourceProvider === "SEC" || period.sourceProvider === "Alpha Vantage" || period.sourceProvider === "FMP" ? period.sourceProvider : undefined,
    })),
    warnings: analysis.importWarnings ?? [],
    source: {
      provider: analysis.source?.provider ?? "Manual entry",
      retrievedAt: analysis.source?.retrievedAt ?? analysis.updatedAt,
      latestFiling: analysis.source?.latestFilingUrl ? { url: analysis.source.latestFilingUrl, filingDate: null } : null,
      units: "millions",
    },
  };
}
