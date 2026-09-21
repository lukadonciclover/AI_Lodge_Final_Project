import {
  firstFmpRecord,
  normalizeCompany,
  normalizeSearchResults,
  type FmpRecord,
} from "@/lib/providers/normalize";
import {
  FinancialDataProviderError,
  type CompanySearchResult,
  type FinancialDataProvider,
  type ImportedCompany,
} from "@/lib/providers/types";

type NextFetchInit = RequestInit & { next?: { revalidate: number } };
export type ProviderFetch = (input: string | URL, init?: NextFetchInit) => Promise<Response>;

type FmpProviderOptions = {
  apiKey: string;
  fetch?: ProviderFetch;
  baseUrl?: string;
  now?: () => Date;
  annualPeriods?: number;
};

export class FmpFinancialDataProvider implements FinancialDataProvider {
  private readonly fetcher: ProviderFetch;
  private readonly baseUrl: string;
  private readonly now: () => Date;
  private readonly annualPeriods: number;

  constructor(private readonly options: FmpProviderOptions) {
    if (!options.apiKey.trim()) {
      throw new FinancialDataProviderError("FMP_API_KEY is not configured.", 503);
    }
    this.fetcher = options.fetch ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://financialmodelingprep.com/api/v3";
    this.now = options.now ?? (() => new Date());
    this.annualPeriods = options.annualPeriods ?? 5;
  }

  async searchCompanies(query: string): Promise<CompanySearchResult[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];
    const payload = await this.request("search", {
      query: normalizedQuery,
      limit: "10",
    }, 3_600);
    return normalizeSearchResults(payload);
  }

  getCompanyProfile(symbol: string) {
    return this.request(`profile/${encodeURIComponent(symbol.trim().toUpperCase())}`, {}, 86_400);
  }

  getQuote(symbol: string) {
    return this.request(`quote/${encodeURIComponent(symbol.trim().toUpperCase())}`, {}, 900);
  }

  getIncomeStatements(symbol: string, period: "annual", limit: number) {
    return this.request(`income-statement/${encodeURIComponent(symbol.trim().toUpperCase())}`, { period, limit: String(limit) }, 86_400);
  }

  getBalanceSheets(symbol: string, period: "annual", limit: number) {
    return this.request(`balance-sheet-statement/${encodeURIComponent(symbol.trim().toUpperCase())}`, { period, limit: String(limit) }, 86_400);
  }

  getCashFlowStatements(symbol: string, period: "annual", limit: number) {
    return this.request(`cash-flow-statement/${encodeURIComponent(symbol.trim().toUpperCase())}`, { period, limit: String(limit) }, 86_400);
  }

  async importCompany(symbol: string): Promise<ImportedCompany> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,20}$/.test(normalizedSymbol)) {
      throw new FinancialDataProviderError("Invalid company symbol.", 400);
    }
    const [profilePayload, quotePayload, incomePayload, balancePayload, cashFlowPayload] =
      await Promise.all([
        this.getCompanyProfile(normalizedSymbol),
        this.getQuote(normalizedSymbol),
        this.getIncomeStatements(normalizedSymbol, "annual", this.annualPeriods),
        this.getBalanceSheets(normalizedSymbol, "annual", this.annualPeriods),
        this.getCashFlowStatements(normalizedSymbol, "annual", this.annualPeriods),
      ]);

    const profile = firstFmpRecord(profilePayload);
    if (!profile) {
      throw new FinancialDataProviderError(`No company found for symbol ${normalizedSymbol}.`, 404);
    }

    return normalizeCompany({
      symbol: normalizedSymbol,
      profile,
      quote: firstFmpRecord(quotePayload),
      incomeStatements: this.records(incomePayload, "income statements"),
      balanceSheets: this.records(balancePayload, "balance sheets"),
      cashFlowStatements: this.records(cashFlowPayload, "cash flow statements"),
      retrievedAt: this.now().toISOString(),
    });
  }

  private records(payload: unknown, label: string): FmpRecord[] {
    if (!Array.isArray(payload)) {
      throw new FinancialDataProviderError(`FMP returned invalid ${label}.`);
    }
    return payload.filter((item): item is FmpRecord => Boolean(item) && typeof item === "object");
  }

  private async request(
    path: string,
    parameters: Record<string, string>,
    revalidate: number,
  ): Promise<unknown> {
    const url = new URL(`${this.baseUrl.replace(/\/$/, "")}/${path}`);
    for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
    url.searchParams.set("apikey", this.options.apiKey);

    let response: Response;
    try {
      response = await this.fetcher(url, { next: { revalidate } });
    } catch (error) {
      throw new FinancialDataProviderError("Unable to reach Financial Modeling Prep.", 502, error);
    }
    if (!response.ok) {
      const message = response.status === 401 || response.status === 403
        ? "Financial data authentication failed. Check the server API key."
        : response.status === 429
          ? "Financial data request limit reached. Please try again later."
          : `Financial Modeling Prep request failed with status ${response.status}.`;
      throw new FinancialDataProviderError(
        message,
        response.status === 429 ? 429 : response.status === 401 || response.status === 403 ? 503 : 502,
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new FinancialDataProviderError("Financial Modeling Prep returned invalid JSON.", 502, error);
    }
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const errorMessage = (payload as Record<string, unknown>)["Error Message"];
      if (typeof errorMessage === "string") {
        const normalized = errorMessage.toLowerCase();
        if (normalized.includes("api key") || normalized.includes("apikey")) throw new FinancialDataProviderError("Financial data authentication failed. Check the server API key.", 503);
        if (normalized.includes("limit") || normalized.includes("rate")) throw new FinancialDataProviderError("Financial data request limit reached. Please try again later.", 429);
        throw new FinancialDataProviderError("Financial Modeling Prep rejected the request.", 502);
      }
    }
    return payload;
  }
}
