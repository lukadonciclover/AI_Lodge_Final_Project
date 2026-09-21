export type FinancialYear = {
  year: number;
  periodEnd?: string | null;
  revenue: number | null;
  grossProfit?: number | null;
  ebitda: number | null;
  ebit: number | null;
  netIncome: number | null;
  eps?: number | null;
  cash?: number | null;
  shortTermInvestments?: number | null;
  totalAssets?: number | null;
  shortTermDebt?: number | null;
  longTermDebt?: number | null;
  totalDebt?: number | null;
  totalLiabilities?: number | null;
  shareholdersEquity?: number | null;
  cashFlowFromOperations?: number | null;
  capitalExpenditure?: number | null;
  freeCashFlow: number | null;
  acquisitions?: number | null;
  dividendsPaid?: number | null;
  shareRepurchases?: number | null;
};

export type AnalysisSource = {
  provider: string;
  retrievedAt: string;
  latestFilingUrl: string | null;
};

export type Thesis = {
  summary: string;
  recommendation: "Buy" | "Hold" | "Sell";
  targetPrice: number;
  catalysts: string[];
  risks: string[];
};

export type CompanyAnalysis = {
  id: string;
  companyName: string;
  ticker: string;
  industry: string;
  sector?: string | null;
  exchange?: string | null;
  country?: string | null;
  description?: string | null;
  currency: string;
  currentSharePrice: number | null;
  sharesOutstanding: number | null;
  marketCapitalization?: number | null;
  cash: number | null;
  debt: number | null;
  financials: FinancialYear[];
  thesis: Thesis;
  source?: AnalysisSource | null;
  importWarnings?: string[];
  userAdjustedFields?: string[];
  updatedAt: string;
};
