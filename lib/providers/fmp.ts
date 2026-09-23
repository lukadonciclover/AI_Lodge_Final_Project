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
  type FinancialDataProviderErrorCode,
  type ImportedCompany,
} from "@/lib/providers/types";

const SUBSCRIPTION_KEYWORDS = [
  "subscription",
  "not part of your",
  "not subscribed",
  "upgrade",
  "premium",
  "entitlement",
  "not authorized",
] as const;

const RATE_LIMIT_KEYWORDS = [
  "limit",
  "too many",
  "throttled",
  "calls per minute",
] as const;

const AUTH_KEYWORDS = [
  "api key",
  "apikey",
  "authentication",
  "unauthorized",
  "invalid key",
  "wrong key",
  "invalid credentials",
  "not active",
] as const;

function containsAny(normalized: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => normalized.includes(keyword));
}

function classifyProviderError(message: string): FinancialDataProviderErrorCode {
  const normalized = message.toLowerCase();
  if (containsAny(normalized, SUBSCRIPTION_KEYWORDS)) return "SUBSCRIPTION";
  if (containsAny(normalized, RATE_LIMIT_KEYWORDS)) return "RATE_LIMIT";
  if (containsAny(normalized, AUTH_KEYWORDS)) return "INVALID_API_KEY";
  return "PROVIDER_DOWN";
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of ["Error Message", "message", "errorMessage", "error", "HTTP MESSAGE", "Message"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function statusCodeFor(code: FinancialDataProviderErrorCode): number {
  switch (code) {
    case "MISSING_API_KEY": return 503;
    case "INVALID_API_KEY": return 503;
    case "SUBSCRIPTION": return 403;
    case "RATE_LIMIT": return 429;
    case "NOT_FOUND": return 404;
    case "INVALID_REQUEST": return 400;
    case "PROVIDER_DOWN": return 502;
  }
}

function messageFor(code: FinancialDataProviderErrorCode): string {
  switch (code) {
    case "MISSING_API_KEY":
      return "Financial data is not configured. Add the server-side FMP_API_KEY environment variable locally in .env.local and in your Vercel project settings, then restart or redeploy.";
    case "INVALID_API_KEY":
      return "Financial data authentication error: authentication failed. The server API key (FMP_API_KEY) is invalid or expired; check it locally in .env.local and in your Vercel project settings.";
    case "SUBSCRIPTION":
      return "Your Financial Modeling Prep plan does not provide access to the requested data. Check your subscription and endpoint entitlements.";
    case "RATE_LIMIT":
      return "Financial data rate-limit error: request limit reached. Please try again later.";
    case "NOT_FOUND":
      return "No matching company was found.";
    case "INVALID_REQUEST":
      return "The financial data request was invalid.";
    case "PROVIDER_DOWN":
      return "Financial Modeling Prep is temporarily unavailable. Please try again shortly.";
  }
}

function categoryFor(code: FinancialDataProviderErrorCode) {
  switch (code) {
    case "MISSING_API_KEY": return "configuration" as const;
    case "INVALID_API_KEY": return "authentication" as const;
    case "SUBSCRIPTION": return "subscription" as const;
    case "RATE_LIMIT": return "rate_limit" as const;
    case "NOT_FOUND": return "unsupported_company" as const;
    case "INVALID_REQUEST": return "invalid_query" as const;
    case "PROVIDER_DOWN": return "provider" as const;
  }
}

function providerError(code: FinancialDataProviderErrorCode, cause?: unknown): FinancialDataProviderError {
  return new FinancialDataProviderError(
    messageFor(code),
    statusCodeFor(code),
    cause,
    categoryFor(code),
    code,
  );
}

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
      throw providerError("MISSING_API_KEY");
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
      throw new FinancialDataProviderError(
        "Invalid company symbol.",
        400,
        undefined,
        "invalid_query",
        "INVALID_REQUEST",
      );
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
      throw new FinancialDataProviderError(
        `No company found for symbol ${normalizedSymbol}.`,
        404,
        undefined,
        "unsupported_company",
        "NOT_FOUND",
      );
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
      throw new FinancialDataProviderError(
        `Financial Modeling Prep returned invalid ${label}.`,
        502,
        undefined,
        "provider",
        "PROVIDER_DOWN",
      );
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
      throw new FinancialDataProviderError(
        "Financial data network error: unable to reach Financial Modeling Prep.",
        502,
        error,
        "network",
        "PROVIDER_DOWN",
      );
    }
    if (!response.ok) {
      throw await this.httpError(response);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw providerError("PROVIDER_DOWN", error);
    }
    const providerMessage = extractErrorMessage(payload);
    if (providerMessage) {
      const code = classifyProviderError(providerMessage);
      throw new FinancialDataProviderError(
        messageFor(code),
        statusCodeFor(code),
        providerMessage,
        categoryFor(code),
        code,
      );
    }
    return payload;
  }

  private async httpError(response: Response): Promise<FinancialDataProviderError> {
    if (response.status === 429) {
      return providerError("RATE_LIMIT");
    }

    let details: string | null = null;
    try {
      details = extractErrorMessage(await response.json());
    } catch {
      details = null;
    }

    if (response.status === 402) {
      return providerError("SUBSCRIPTION", details);
    }

    if (response.status === 401 || response.status === 403) {
      const code = details ? classifyProviderError(details) : "INVALID_API_KEY";
      return new FinancialDataProviderError(
        messageFor(code),
        statusCodeFor(code),
        details,
        categoryFor(code),
        code,
      );
    }

    if (response.status === 400 || response.status === 422) {
      return providerError("INVALID_REQUEST", details);
    }

    return providerError("PROVIDER_DOWN");
  }
}
