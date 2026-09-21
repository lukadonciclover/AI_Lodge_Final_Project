export type FinancialYear = {
  year: number;
  revenue: number;
  ebitda: number;
  ebit: number;
  netIncome: number;
  freeCashFlow: number;
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
  currency: string;
  currentSharePrice: number;
  sharesOutstanding: number;
  cash: number;
  debt: number;
  financials: FinancialYear[];
  thesis: Thesis;
  updatedAt: string;
};
