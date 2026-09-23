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
      throw new FinancialDataProviderError(
        "Financial data configuration error: FMP_API_KEY is not configured on the server. Add it to .env.local for local development or to the deployment environment, then restart the server.",
        503,
        undefined,
        "configuration",
      );
    }
    this.fetcher = options.fetch ?? fetch;
    this.baseUrl = options.baseUrl ?? "https://financialmodelingprep.com/stable";
    this.now = options.now ?? (() => new Date());
    this.annualPeriods = options.annualPeriods ?? 5;
  }

  async searchCompanies(query: string): Promise<CompanySearchResult[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];
    const payload = await this.request("search-name", {
      query: normalizedQuery,
      limit: "10",
    }, 3_600);
    return normalizeSearchResults(payload);
  }

  getCompanyProfile(symbol: string) {
    return this.request("profile", { symbol: symbol.trim().toUpperCase() }, 86_400);
  }

  getQuote(symbol: string) {
    return this.request("quote", { symbol: symbol.trim().toUpperCase() }, 900);
  }

  getIncomeStatements(symbol: string, period: "annual", limit: number) {
    return this.request("income-statement", { symbol: symbol.trim().toUpperCase(), period, limit: String(limit) }, 86_400);
  }

  getBalanceSheets(symbol: string, period: "annual", limit: number) {
    return this.request("balance-sheet-statement", { symbol: symbol.trim().toUpperCase(), period, limit: String(limit) }, 86_400);
  }

  getCashFlowStatements(symbol: string, period: "annual", limit: number) {
    return this.request("cash-flow-statement", { symbol: symbol.trim().toUpperCase(), period, limit: String(limit) }, 86_400);
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
      throw new FinancialDataProviderError("Financial data network error: unable to reach Financial Modeling Prep.", 502, error, "network");
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      if (!response.ok) throw this.responseError(response.status, null);
      throw new FinancialDataProviderError("Financial Modeling Prep returned invalid JSON.", 502, error);
    }
    const providerMessage = this.providerErrorMessage(payload);
    if (!response.ok || providerMessage) {
      throw this.responseError(response.status, providerMessage);
    }
    return payload;
  }

  private providerErrorMessage(payload: unknown): string | null {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const record = payload as Record<string, unknown>;
    for (const key of ["Error Message", "message", "error"]) {
      if (typeof record[key] === "string" && record[key].trim()) return record[key];
    }
    return null;
  }

  private responseError(status: number, providerMessage: string | null): FinancialDataProviderError {
    const normalized = providerMessage?.toLowerCase() ?? "";
    const isSubscription = status === 402
      || ["subscription", "current plan", "upgrade", "premium", "not available"].some((term) => normalized.includes(term));
    if (isSubscription) {
      return new FinancialDataProviderError(
        "Financial data access error: this FMP endpoint is not included in the API key's subscription tier.",
        503,
        undefined,
        "subscription",
      );
    }
    if (status === 429 || normalized.includes("rate limit") || normalized.includes("limit reached")) {
      return new FinancialDataProviderError(
        "Financial data rate-limit error: the FMP request limit was reached. Please try again later.",
        429,
        undefined,
        "rate_limit",
      );
    }
    if (status === 401 || status === 403 || normalized.includes("api key") || normalized.includes("apikey")) {
      return new FinancialDataProviderError(
        "Financial data authentication error: FMP rejected the server API key. Verify or rotate the key and restart the server.",
        503,
        undefined,
        "authentication",
      );
    }
    if (status === 400 || status === 422 || normalized.includes("invalid symbol") || normalized.includes("invalid query")) {
      return new FinancialDataProviderError(
        "Financial data query error: check the company name or ticker and try again.",
        400,
        undefined,
        "invalid_query",
      );
    }
    if (status === 404) {
      return new FinancialDataProviderError(
        "Financial data endpoint error: the requested FMP endpoint is unavailable or unsupported.",
        502,
      );
    }
    return new FinancialDataProviderError(
      `Financial Modeling Prep request failed with status ${status || "unknown"}.`,
      502,
    );
  }
}
