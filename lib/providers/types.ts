export type CompanySearchResult = {
  symbol: string;
  name: string;
  currency: string | null;
  exchange: string | null;
  exchangeShortName: string | null;
  country: string | null;
  sourceProvider?: "Alpha Vantage" | "FMP";
};

export type StatementCurrencies = {
  incomeStatement: string | null;
  balanceSheet: string | null;
  cashFlowStatement: string | null;
};

export type ImportedAnnualFinancials = {
  fiscalYear: number;
  periodEnd: string | null;
  currency: string | null;
  currencies: StatementCurrencies;
  revenueMillion: number | null;
  costOfRevenueMillion?: number | null;
  grossProfitMillion: number | null;
  ebitdaMillion: number | null;
  ebitMillion: number | null;
  netIncomeMillion: number | null;
  eps: number | null;
  shortTermInvestmentsMillion: number | null;
  totalAssetsMillion: number | null;
  currentAssetsMillion?: number | null;
  currentLiabilitiesMillion?: number | null;
  shortTermDebtMillion: number | null;
  longTermDebtMillion: number | null;
  totalLiabilitiesMillion: number | null;
  shareholdersEquityMillion: number | null;
  cashFlowFromOperationsMillion: number | null;
  capitalExpenditureMillion: number | null;
  freeCashFlowMillion: number | null;
  acquisitionsMillion: number | null;
  dividendsPaidMillion: number | null;
  shareRepurchasesMillion: number | null;
  cashMillion: number | null;
  debtMillion: number | null;
  dilutedSharesOutstandingMillion: number | null;
  filingDate?: string | null;
  fiscalPeriod?: string | null;
  form?: string | null;
  accessionNumber?: string | null;
  sourceProvider?: "SEC" | "Alpha Vantage" | "FMP";
};

export type FilingLink = {
  url: string;
  filingDate: string | null;
};

export type ImportSourceMetadata = {
  provider: string;
  retrievedAt: string;
  latestFiling: FilingLink | null;
  units: "millions";
};

export type ImportedCompany = {
  symbol: string;
  name: string;
  industry: string | null;
  sector: string | null;
  exchange: string | null;
  country: string | null;
  website: string | null;
  description: string | null;
  currency: string | null;
  sharePrice: number | null;
  sharesOutstandingMillion: number | null;
  marketCapitalizationMillion: number | null;
  cashMillion: number | null;
  debtMillion: number | null;
  annualFinancials: ImportedAnnualFinancials[];
  warnings: string[];
  source: ImportSourceMetadata;
};

export interface FinancialDataProvider {
  searchCompanies(query: string): Promise<CompanySearchResult[]>;
  importCompany(symbol: string): Promise<ImportedCompany>;
}

export type FinancialDataErrorCategory =
  | "configuration"
  | "authentication"
  | "subscription"
  | "rate_limit"
  | "invalid_query"
  | "unsupported_company"
  | "missing_data"
  | "network"
  | "provider";

export class FinancialDataProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 502,
    public readonly cause?: unknown,
    public readonly category: FinancialDataErrorCategory = "provider",
  ) {
    super(message);
    this.name = "FinancialDataProviderError";
  }
}
