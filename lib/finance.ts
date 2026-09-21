import { CompanyAnalysis, FinancialYear } from "@/lib/types";

export function latestFinancials(analysis: CompanyAnalysis): FinancialYear | undefined {
  return [...analysis.financials].sort((a, b) => b.year - a.year)[0];
}

export function calculateMetrics(analysis: CompanyAnalysis) {
  const latest = latestFinancials(analysis);
  const marketCap = analysis.currentSharePrice * analysis.sharesOutstanding;
  const enterpriseValue = marketCap + analysis.debt - analysis.cash;
  const prior = [...analysis.financials].sort((a, b) => b.year - a.year)[1];

  return {
    marketCap,
    enterpriseValue,
    revenueGrowth: latest && prior && prior.revenue ? latest.revenue / prior.revenue - 1 : null,
    ebitdaMargin: latest?.revenue ? latest.ebitda / latest.revenue : null,
    netMargin: latest?.revenue ? latest.netIncome / latest.revenue : null,
    fcfMargin: latest?.revenue ? latest.freeCashFlow / latest.revenue : null,
    evRevenue: latest?.revenue ? enterpriseValue / latest.revenue : null,
    evEbitda: latest?.ebitda ? enterpriseValue / latest.ebitda : null,
    priceEarnings: latest?.netIncome ? marketCap / latest.netIncome : null
  };
}

export function growthRate(current: number, previous?: number) {
  return previous ? current / previous - 1 : null;
}
