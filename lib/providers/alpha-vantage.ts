import {
  FinancialDataProviderError,
  type CompanySearchResult,
  type ImportedAnnualFinancials,
  type ImportedCompany,
} from "@/lib/providers/types";

type NextFetchInit = RequestInit & { next?: { revalidate: number } };
type AlphaFetch = (input: string | URL, init?: NextFetchInit) => Promise<Response>;
type AlphaRecord = Record<string, unknown>;

export type AlphaCompanyDetails = {
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
  warnings?: string[];
};

export class AlphaVantageProvider {
  private readonly fetcher: AlphaFetch;
  private readonly cache = new Map<string, Promise<unknown>>();
  private readonly baseUrl: string;

  constructor(private readonly options: { apiKey: string; fetch?: AlphaFetch; baseUrl?: string }) {
    if (!options.apiKey.trim()) {
      throw new FinancialDataProviderError(
        "Alpha Vantage configuration error: ALPHA_VANTAGE_API_KEY is not configured on the server.",
        503,
        undefined,
        "configuration",
      );
    }
    this.fetcher = options.fetch ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://www.alphavantage.co/query";
  }

  async searchCompanies(query: string): Promise<CompanySearchResult[]> {
    const payload = await this.request("SYMBOL_SEARCH", { keywords: query.trim() }, 86_400);
    const matches = recordArray(payload, "bestMatches");
    return matches.flatMap((match) => {
      const symbol = text(match["1. symbol"]);
      const name = text(match["2. name"]);
      if (!symbol || !name) return [];
      return [{
        symbol: symbol.toUpperCase(),
        name,
        currency: text(match["8. currency"]),
        exchange: text(match["4. region"]),
        exchangeShortName: null,
        country: text(match["4. region"]),
        sourceProvider: "Alpha Vantage" as const,
      }];
    });
  }

  async getCompanyDetails(symbol: string): Promise<AlphaCompanyDetails> {
    const normalizedSymbol = validateSymbol(symbol);
    const overviewPayload = await this.request("OVERVIEW", { symbol: normalizedSymbol }, 86_400);
    let prices: Array<{ date: string; close: number }> = [];
    const warnings: string[] = [];
    try {
      prices = await this.getHistoricalPrices(normalizedSymbol);
    } catch (error) {
      if (!(error instanceof FinancialDataProviderError) || !["missing_data", "unsupported_company"].includes(error.category)) throw error;
      warnings.push("Alpha Vantage historical price data was unavailable.");
    }
    const overview = asRecord(overviewPayload);
    if (!text(overview.Symbol)) {
      throw new FinancialDataProviderError(`Alpha Vantage has no company overview for ${normalizedSymbol}.`, 404, undefined, "unsupported_company");
    }
    const latestPrice = prices[0]?.close ?? null;
    return {
      symbol: text(overview.Symbol)?.toUpperCase() ?? normalizedSymbol,
      name: text(overview.Name) ?? normalizedSymbol,
      industry: text(overview.Industry),
      sector: text(overview.Sector),
      exchange: text(overview.Exchange),
      country: text(overview.Country),
      website: text(overview.OfficialSite),
      description: text(overview.Description),
      currency: text(overview.Currency),
      sharePrice: latestPrice,
      sharesOutstandingMillion: millions(overview.SharesOutstanding),
      marketCapitalizationMillion: millions(overview.MarketCapitalization),
      warnings,
    };
  }

  async getHistoricalPrices(symbol: string): Promise<Array<{ date: string; close: number }>> {
    const normalizedSymbol = validateSymbol(symbol);
    const payload = await this.request("TIME_SERIES_DAILY", { symbol: normalizedSymbol, outputsize: "compact" }, 43_200);
    const series = asRecord(asRecord(payload)["Time Series (Daily)"]);
    const prices = Object.entries(series).flatMap(([date, value]) => {
      const close = number(asRecord(value)["4. close"]);
      return close === null ? [] : [{ date, close }];
    }).sort((a, b) => b.date.localeCompare(a.date));
    if (!prices.length) {
      throw new FinancialDataProviderError(`Alpha Vantage has no price data for ${normalizedSymbol}.`, 404, undefined, "missing_data");
    }
    return prices;
  }

  async getFinancialStatements(symbol: string): Promise<ImportedAnnualFinancials[]> {
    const normalizedSymbol = validateSymbol(symbol);
    const [incomePayload, balancePayload, cashPayload] = await Promise.all([
      this.request("INCOME_STATEMENT", { symbol: normalizedSymbol }, 86_400),
      this.request("BALANCE_SHEET", { symbol: normalizedSymbol }, 86_400),
      this.request("CASH_FLOW", { symbol: normalizedSymbol }, 86_400),
    ]);
    return normalizeAlphaStatements(incomePayload, balancePayload, cashPayload);
  }

  async importCompany(symbol: string): Promise<ImportedCompany> {
    const [details, annualFinancials] = await Promise.all([
      this.getCompanyDetails(symbol),
      this.getFinancialStatements(symbol),
    ]);
    return buildAlphaCompany(details, annualFinancials, new Date().toISOString());
  }

  private request(functionName: string, parameters: Record<string, string>, revalidate: number): Promise<unknown> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("function", functionName);
    for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
    url.searchParams.set("apikey", this.options.apiKey);
    const cacheKey = `${functionName}:${JSON.stringify(parameters)}`;
    const existing = this.cache.get(cacheKey);
    if (existing) return existing;
    const request = this.fetchJson(url, revalidate, functionName).catch((error) => {
      this.cache.delete(cacheKey);
      throw error;
    });
    this.cache.set(cacheKey, request);
    return request;
  }

  private async fetchJson(url: URL, revalidate: number, functionName: string) {
    let response: Response;
    try {
      response = await this.fetcher(url, { next: { revalidate } });
    } catch (error) {
      throw new FinancialDataProviderError("Alpha Vantage network error: unable to reach the provider.", 502, error, "network");
    }
    if (response.status === 429) {
      throw new FinancialDataProviderError("Alpha Vantage rate-limit error: request allowance reached.", 429, undefined, "rate_limit");
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (!response.ok) throw classifyAlphaError(response.status, null);
      throw new FinancialDataProviderError("Alpha Vantage returned invalid JSON.", 502, error);
    }
    const message = alphaErrorMessage(payload);
    if (!response.ok || message) throw classifyAlphaError(response.status, message);
    if (!hasExpectedPayload(functionName, payload)) {
      throw new FinancialDataProviderError(`Alpha Vantage returned no usable ${functionName} data.`, 404, undefined, "missing_data");
    }
    return payload;
  }
}

export function normalizeAlphaStatements(incomePayload: unknown, balancePayload: unknown, cashPayload: unknown) {
  const income = reportsByYear(incomePayload);
  const balance = reportsByYear(balancePayload);
  const cash = reportsByYear(cashPayload);
  const years = Array.from(new Set([
    ...Array.from(income.keys()),
    ...Array.from(balance.keys()),
    ...Array.from(cash.keys()),
  ])).sort((a, b) => b - a).slice(0, 5);
  if (!years.length) {
    throw new FinancialDataProviderError("Alpha Vantage returned no annual financial statements.", 404, undefined, "missing_data");
  }
  return years.map((fiscalYear): ImportedAnnualFinancials => {
    const incomeRecord = income.get(fiscalYear) ?? {};
    const balanceRecord = balance.get(fiscalYear) ?? {};
    const cashRecord = cash.get(fiscalYear) ?? {};
    const periodEnd = [incomeRecord, balanceRecord, cashRecord].map((record) => text(record.fiscalDateEnding)).filter((date): date is string => Boolean(date)).sort().at(-1) ?? null;
    const operatingCashFlow = millions(cashRecord.operatingCashflow);
    const capexRaw = millions(cashRecord.capitalExpenditures);
    const capitalExpenditure = capexRaw === null ? null : Math.abs(capexRaw);
    const shortTermDebt = millions(balanceRecord.currentDebt) ?? millions(balanceRecord.shortTermDebt);
    const longTermDebt = millions(balanceRecord.longTermDebtNoncurrent) ?? millions(balanceRecord.longTermDebt);
    const reportedDebt = millions(balanceRecord.shortLongTermDebtTotal);
    const currency = text(incomeRecord.reportedCurrency) ?? text(balanceRecord.reportedCurrency) ?? text(cashRecord.reportedCurrency);
    return {
      fiscalYear,
      periodEnd,
      currency,
      currencies: { incomeStatement: text(incomeRecord.reportedCurrency), balanceSheet: text(balanceRecord.reportedCurrency), cashFlowStatement: text(cashRecord.reportedCurrency) },
      revenueMillion: millions(incomeRecord.totalRevenue),
      costOfRevenueMillion: millions(incomeRecord.costOfRevenue) ?? millions(incomeRecord.costofGoodsAndServicesSold),
      grossProfitMillion: millions(incomeRecord.grossProfit),
      ebitdaMillion: millions(incomeRecord.ebitda),
      ebitMillion: millions(incomeRecord.operatingIncome) ?? millions(incomeRecord.ebit),
      netIncomeMillion: millions(incomeRecord.netIncome) ?? millions(cashRecord.netIncome),
      eps: null,
      cashMillion: millions(balanceRecord.cashAndCashEquivalentsAtCarryingValue) ?? millions(balanceRecord.cashAndShortTermInvestments),
      shortTermInvestmentsMillion: millions(balanceRecord.shortTermInvestments),
      totalAssetsMillion: millions(balanceRecord.totalAssets),
      currentAssetsMillion: millions(balanceRecord.totalCurrentAssets),
      currentLiabilitiesMillion: millions(balanceRecord.totalCurrentLiabilities),
      shortTermDebtMillion: shortTermDebt,
      longTermDebtMillion: longTermDebt,
      debtMillion: reportedDebt ?? sum(shortTermDebt, longTermDebt),
      totalLiabilitiesMillion: millions(balanceRecord.totalLiabilities),
      shareholdersEquityMillion: millions(balanceRecord.totalShareholderEquity),
      cashFlowFromOperationsMillion: operatingCashFlow,
      capitalExpenditureMillion: capitalExpenditure,
      freeCashFlowMillion: subtract(operatingCashFlow, capitalExpenditure),
      acquisitionsMillion: millions(cashRecord.proceedsFromAcquisitions),
      dividendsPaidMillion: absoluteMillions(cashRecord.dividendPayout),
      shareRepurchasesMillion: absoluteMillions(cashRecord.paymentsForRepurchaseOfCommonStock),
      dilutedSharesOutstandingMillion: millions(incomeRecord.weightedAverageShsOutDil),
      filingDate: null,
      fiscalPeriod: "FY",
      form: null,
      accessionNumber: null,
      sourceProvider: "Alpha Vantage",
    };
  });
}

export function buildAlphaCompany(details: AlphaCompanyDetails, annualFinancials: ImportedAnnualFinancials[], retrievedAt: string): ImportedCompany {
  return {
    ...details,
    cashMillion: annualFinancials[0]?.cashMillion ?? null,
    debtMillion: annualFinancials[0]?.debtMillion ?? null,
    annualFinancials,
    warnings: [...(details.warnings ?? []), "SEC Company Facts was unavailable; financial statements use Alpha Vantage fallback data.", "Free cash flow is calculated as operating cash flow minus capital expenditure; both source values are preserved."],
    source: { provider: "Alpha Vantage", retrievedAt, latestFiling: null, units: "millions" },
  };
}

function alphaErrorMessage(payload: unknown) {
  const record = asRecord(payload);
  for (const key of ["Error Message", "Information", "Note"]) {
    const value = text(record[key]);
    if (value) return value;
  }
  return null;
}

function classifyAlphaError(status: number, message: string | null) {
  const normalized = message?.toLowerCase() ?? "";
  if (status === 429 || ["rate limit", "call frequency", "requests per day", "requests per minute", "thank you for using alpha vantage"].some((term) => normalized.includes(term))) {
    return new FinancialDataProviderError("Alpha Vantage rate-limit error: request allowance reached.", 429, undefined, "rate_limit");
  }
  if (status === 401 || status === 403 || ["api key", "apikey", "invalid key"].some((term) => normalized.includes(term))) {
    return new FinancialDataProviderError("Alpha Vantage authentication error: the server API key was rejected.", 503, undefined, "authentication");
  }
  if (status === 402 || ["premium", "subscription", "entitlement"].some((term) => normalized.includes(term))) {
    return new FinancialDataProviderError("Alpha Vantage subscription error: this endpoint is unavailable for the configured key.", 503, undefined, "subscription");
  }
  if (status === 400 || status === 422 || normalized.includes("invalid api call") || normalized.includes("invalid symbol")) {
    return new FinancialDataProviderError("Alpha Vantage does not support this company or query.", 404, undefined, "unsupported_company");
  }
  return new FinancialDataProviderError(`Alpha Vantage request failed with status ${status || "unknown"}.`, 502);
}

function hasExpectedPayload(functionName: string, payload: unknown) {
  const record = asRecord(payload);
  if (functionName === "SYMBOL_SEARCH") return Array.isArray(record.bestMatches);
  if (functionName === "OVERVIEW") return Object.keys(record).length > 0;
  if (functionName === "TIME_SERIES_DAILY") return Object.keys(asRecord(record["Time Series (Daily)"])).length > 0;
  return Array.isArray(record.annualReports);
}

function reportsByYear(payload: unknown) {
  const result = new Map<number, AlphaRecord>();
  for (const report of recordArray(payload, "annualReports")) {
    const date = text(report.fiscalDateEnding);
    const year = date ? Number(date.slice(0, 4)) : NaN;
    const currentDate = text(result.get(year)?.fiscalDateEnding);
    if (Number.isInteger(year) && (!currentDate || date! > currentDate)) result.set(year, report);
  }
  return result;
}

function validateSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,20}$/.test(normalized)) {
    throw new FinancialDataProviderError("Invalid company symbol.", 400, undefined, "invalid_query");
  }
  return normalized;
}

function asRecord(value: unknown): AlphaRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AlphaRecord : {};
}

function recordArray(payload: unknown, key: string) {
  const value = asRecord(payload)[key];
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function text(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return !trimmed || trimmed.toLowerCase() === "none" ? null : trimmed;
}

function number(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() && value.toLowerCase() !== "none" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function millions(value: unknown) {
  const parsed = number(value);
  return parsed === null ? null : parsed / 1_000_000;
}

function absoluteMillions(value: unknown) {
  const parsed = millions(value);
  return parsed === null ? null : Math.abs(parsed);
}

function subtract(left: number | null, right: number | null) {
  return left === null || right === null ? null : left - right;
}

function sum(left: number | null, right: number | null) {
  if (left === null && right === null) return null;
  return (left ?? 0) + (right ?? 0);
}
