import { CompanyAnalysis, FinancialYear } from "@/lib/types";

export type MultipleValue = number | null | "nm";

function ratio(numerator: number | null | undefined, denominator: number | null | undefined) {
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0
    ? (numerator as number) / (denominator as number)
    : null;
}

function valuationRatio(numerator: number | null, denominator: number | null | undefined): MultipleValue {
  if (denominator !== null && denominator !== undefined && Number.isFinite(denominator) && denominator <= 0) return "nm";
  return ratio(numerator, denominator);
}

export function latestFinancials(analysis: CompanyAnalysis): FinancialYear | undefined {
  return [...analysis.financials].sort((a, b) => b.year - a.year)[0];
}

export function calculateMetrics(analysis: CompanyAnalysis) {
  const latest = latestFinancials(analysis);
  const calculatedMarketCap = analysis.currentSharePrice !== null && analysis.sharesOutstanding !== null
    ? analysis.currentSharePrice * analysis.sharesOutstanding
    : null;
  const marketCap = Number.isFinite(analysis.marketCapitalization) ? analysis.marketCapitalization! : calculatedMarketCap;
  const enterpriseValue = marketCap !== null && analysis.debt !== null && analysis.cash !== null ? marketCap + analysis.debt - analysis.cash : null;
  const prior = [...analysis.financials].sort((a, b) => b.year - a.year)[1];
  const oldest = [...analysis.financials].sort((a, b) => a.year - b.year)[0];
  const periods = latest && oldest ? latest.year - oldest.year : 0;
  const revenueCagr = latest?.revenue && oldest?.revenue && latest.revenue > 0 && oldest.revenue > 0 && periods > 0
    ? Math.pow(latest.revenue / oldest.revenue, 1 / periods) - 1
    : null;
  const priceEarnings = latest?.eps !== null && latest?.eps !== undefined
    ? valuationRatio(analysis.currentSharePrice, latest.eps)
    : valuationRatio(marketCap, latest?.netIncome);

  return {
    marketCap,
    enterpriseValue,
    netDebt: analysis.debt !== null && analysis.cash !== null ? analysis.debt - analysis.cash : null,
    revenueGrowth: ratio(latest?.revenue, prior?.revenue) === null ? null : ratio(latest?.revenue, prior?.revenue)! - 1,
    revenueCagr,
    grossMargin: ratio(latest?.grossProfit, latest?.revenue),
    ebitdaMargin: ratio(latest?.ebitda, latest?.revenue),
    operatingMargin: ratio(latest?.ebit, latest?.revenue),
    netMargin: ratio(latest?.netIncome, latest?.revenue),
    fcfMargin: ratio(latest?.freeCashFlow, latest?.revenue),
    evRevenue: valuationRatio(enterpriseValue, latest?.revenue),
    evEbitda: valuationRatio(enterpriseValue, latest?.ebitda),
    priceEarnings,
    fcfYield: ratio(latest?.freeCashFlow, marketCap),
    returnOnEquity: ratio(latest?.netIncome, latest?.shareholdersEquity)
  };
}

export function growthRate(current: number | null, previous?: number | null) {
  return ratio(current, previous) === null ? null : ratio(current, previous)! - 1;
}
