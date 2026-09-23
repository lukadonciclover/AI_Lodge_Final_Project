import { FinancialDataProviderError, type ImportedAnnualFinancials } from "@/lib/providers/types";

type NextFetchInit = RequestInit & { next?: { revalidate: number } };
type SecFetch = (input: string | URL, init?: NextFetchInit) => Promise<Response>;

type SecTickerEntry = { cik_str?: number; ticker?: string; title?: string };
type SecFact = {
  start?: string;
  end?: string;
  val?: number;
  accn?: string;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  frame?: string;
};
type SecConcept = { units?: Record<string, SecFact[]> };
type SecCompanyFacts = {
  cik?: number;
  entityName?: string;
  facts?: { "us-gaap"?: Record<string, SecConcept> };
};

export type SecFinancialData = {
  cik: string;
  entityName: string;
  annualFinancials: ImportedAnnualFinancials[];
  warnings: string[];
  latestFiling: { url: string; filingDate: string | null } | null;
};

type MetricName =
  | "revenue" | "costOfRevenue" | "grossProfit" | "operatingIncome" | "netIncome"
  | "cash" | "totalAssets" | "currentAssets" | "currentLiabilities" | "totalLiabilities"
  | "shortTermDebt" | "longTermDebt" | "totalDebt" | "stockholdersEquity"
  | "operatingCashFlow" | "capitalExpenditure" | "dilutedSharesOutstanding" | "eps";

const metricTags: Record<MetricName, string[]> = {
  revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet", "SalesRevenueGoodsNet", "SalesRevenueServicesNet"],
  costOfRevenue: ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold"],
  grossProfit: ["GrossProfit"],
  operatingIncome: ["OperatingIncomeLoss"],
  netIncome: ["NetIncomeLoss", "ProfitLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"],
  cash: ["CashAndCashEquivalentsAtCarryingValue"],
  totalAssets: ["Assets"],
  currentAssets: ["AssetsCurrent"],
  currentLiabilities: ["LiabilitiesCurrent"],
  totalLiabilities: ["Liabilities"],
  shortTermDebt: ["ShortTermBorrowings", "LongTermDebtCurrent", "LongTermDebtAndFinanceLeaseObligationsCurrent"],
  longTermDebt: ["LongTermDebtNoncurrent", "LongTermDebtAndFinanceLeaseObligationsNoncurrent"],
  totalDebt: ["LongTermDebtAndFinanceLeaseObligations", "LongTermDebt", "DebtAndCapitalLeaseObligations"],
  stockholdersEquity: ["StockholdersEquity"],
  operatingCashFlow: ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"],
  capitalExpenditure: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsForAdditionsToPropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets"],
  dilutedSharesOutstanding: ["WeightedAverageNumberOfDilutedSharesOutstanding"],
  eps: ["EarningsPerShareDiluted"],
};

const durationMetrics = new Set<MetricName>([
  "revenue", "costOfRevenue", "grossProfit", "operatingIncome", "netIncome",
  "operatingCashFlow", "capitalExpenditure", "dilutedSharesOutstanding", "eps",
]);

let nextSecRequestAt = 0;
let secRequestQueue = Promise.resolve();

export class SecCompanyFactsProvider {
  private readonly fetcher: SecFetch;
  private readonly cache = new Map<string, Promise<unknown>>();
  private readonly minimumIntervalMs: number;

  constructor(private readonly options: { userAgent: string; fetch?: SecFetch; minimumIntervalMs?: number }) {
    if (!options.userAgent.trim() || !/[^@\s]+@[^@\s]+\.[^@\s]+/.test(options.userAgent)) {
      throw new FinancialDataProviderError(
        "SEC configuration error: SEC_USER_AGENT must include an application name and contact email.",
        503,
        undefined,
        "configuration",
      );
    }
    this.fetcher = options.fetch ?? fetch;
    this.minimumIntervalMs = options.minimumIntervalMs ?? 125;
  }

  async importCompany(symbol: string): Promise<SecFinancialData> {
    const normalizedSymbol = normalizeSymbol(symbol);
    const mapping = await this.tickerMapping();
    const match = Object.values(mapping).find((entry) => normalizeSymbol(entry.ticker ?? "") === normalizedSymbol);
    if (!match?.cik_str) {
      throw new FinancialDataProviderError(
        `SEC does not list ${normalizedSymbol} as a supported US filer.`,
        404,
        undefined,
        "unsupported_company",
      );
    }

    const cik = String(match.cik_str).padStart(10, "0");
    const payload = await this.cachedJson<SecCompanyFacts>(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
      21_600,
    );
    return normalizeSecCompanyFacts(payload, cik, match.title ?? normalizedSymbol);
  }

  private tickerMapping() {
    return this.cachedJson<Record<string, SecTickerEntry>>(
      "https://www.sec.gov/files/company_tickers.json",
      86_400,
    );
  }

  private cachedJson<T>(url: string, revalidate: number): Promise<T> {
    const existing = this.cache.get(url);
    if (existing) return existing as Promise<T>;
    const request = this.requestJson<T>(url, revalidate).catch((error) => {
      this.cache.delete(url);
      throw error;
    });
    this.cache.set(url, request);
    return request;
  }

  private async requestJson<T>(url: string, revalidate: number): Promise<T> {
    await this.waitForRateLimit();
    let response: Response;
    try {
      response = await this.fetcher(url, {
        headers: { "User-Agent": this.options.userAgent, Accept: "application/json" },
        next: { revalidate },
      });
    } catch (error) {
      throw new FinancialDataProviderError("SEC network error: unable to reach EDGAR.", 502, error, "network");
    }
    if (response.status === 429) {
      throw new FinancialDataProviderError("SEC rate-limit error: please try again later.", 429, undefined, "rate_limit");
    }
    if (response.status === 404) {
      throw new FinancialDataProviderError("SEC has no Company Facts data for this company.", 404, undefined, "unsupported_company");
    }
    if (!response.ok) {
      throw new FinancialDataProviderError(`SEC EDGAR request failed with status ${response.status}.`, 502);
    }
    try {
      return await response.json() as T;
    } catch (error) {
      throw new FinancialDataProviderError("SEC EDGAR returned invalid JSON.", 502, error);
    }
  }

  private waitForRateLimit() {
    if (this.minimumIntervalMs <= 0) return Promise.resolve();
    const wait = secRequestQueue.then(async () => {
      const delay = Math.max(0, nextSecRequestAt - Date.now());
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      nextSecRequestAt = Date.now() + this.minimumIntervalMs;
    });
    secRequestQueue = wait.catch(() => undefined);
    return wait;
  }
}

export function normalizeSecCompanyFacts(payload: SecCompanyFacts, paddedCik: string, fallbackName: string): SecFinancialData {
  const concepts = payload.facts?.["us-gaap"];
  if (!concepts) {
    throw new FinancialDataProviderError("SEC Company Facts contains no US GAAP financial data.", 404, undefined, "missing_data");
  }

  const selected = new Map<MetricName, Map<string, SecFact>>();
  for (const metric of Object.keys(metricTags) as MetricName[]) {
    selected.set(metric, selectAnnualFacts(concepts, metric));
  }
  const periodEnds = Array.from(new Set(Array.from(selected.values()).flatMap((facts) => Array.from(facts.keys()))))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 5);
  if (!periodEnds.length) {
    throw new FinancialDataProviderError("SEC has no usable annual financial facts for this company.", 404, undefined, "missing_data");
  }

  const warnings: string[] = [];
  const annualFinancials = periodEnds.map((periodEnd) => {
    const fact = (metric: MetricName) => selected.get(metric)?.get(periodEnd);
    const monetary = (metric: MetricName) => toMillions(fact(metric)?.val);
    const revenue = monetary("revenue");
    const costOfRevenue = monetary("costOfRevenue");
    const reportedGrossProfit = monetary("grossProfit");
    const shortTermDebt = monetary("shortTermDebt");
    const longTermDebt = monetary("longTermDebt");
    const reportedTotalDebt = monetary("totalDebt");
    const operatingCashFlow = monetary("operatingCashFlow");
    const capexValue = monetary("capitalExpenditure");
    const capitalExpenditure = capexValue === null ? null : Math.abs(capexValue);
    const periodFacts = Array.from(selected.values()).map((facts) => facts.get(periodEnd)).filter(isFact);
    const metadata = fact("revenue") ?? newestFact(periodFacts);
    const accessions = new Set(periodFacts.map((item) => item.accn).filter(Boolean));
    if (accessions.size > 1) warnings.push(`${periodEnd}: SEC values include facts from multiple filings or restatements.`);
    const endYear = Number(periodEnd.slice(0, 4));
    const fiscalYear = metadata?.fy === endYear ? metadata.fy : endYear;
    return {
      fiscalYear,
      periodEnd,
      currency: "USD",
      currencies: { incomeStatement: "USD", balanceSheet: "USD", cashFlowStatement: "USD" },
      revenueMillion: revenue,
      costOfRevenueMillion: costOfRevenue,
      grossProfitMillion: reportedGrossProfit ?? subtract(revenue, costOfRevenue),
      ebitdaMillion: null,
      ebitMillion: monetary("operatingIncome"),
      netIncomeMillion: monetary("netIncome"),
      eps: finiteNumber(fact("eps")?.val),
      shortTermInvestmentsMillion: null,
      totalAssetsMillion: monetary("totalAssets"),
      currentAssetsMillion: monetary("currentAssets"),
      currentLiabilitiesMillion: monetary("currentLiabilities"),
      shortTermDebtMillion: shortTermDebt,
      longTermDebtMillion: longTermDebt,
      debtMillion: reportedTotalDebt ?? sum(shortTermDebt, longTermDebt),
      totalLiabilitiesMillion: monetary("totalLiabilities"),
      shareholdersEquityMillion: monetary("stockholdersEquity"),
      cashFlowFromOperationsMillion: operatingCashFlow,
      capitalExpenditureMillion: capitalExpenditure,
      freeCashFlowMillion: subtract(operatingCashFlow, capitalExpenditure),
      acquisitionsMillion: null,
      dividendsPaidMillion: null,
      shareRepurchasesMillion: null,
      cashMillion: monetary("cash"),
      dilutedSharesOutstandingMillion: toMillions(fact("dilutedSharesOutstanding")?.val),
      filingDate: metadata?.filed ?? null,
      fiscalPeriod: metadata?.fp ?? "FY",
      form: metadata?.form ?? null,
      accessionNumber: metadata?.accn ?? null,
      sourceProvider: "SEC" as const,
    };
  });

  for (const period of annualFinancials) {
    const missing = ["revenueMillion", "netIncomeMillion", "cashMillion", "totalAssetsMillion", "cashFlowFromOperationsMillion"]
      .filter((key) => period[key as keyof typeof period] === null);
    if (missing.length) warnings.push(`${period.fiscalYear}: SEC Company Facts is missing ${missing.join(", ")}.`);
  }
  warnings.push("Free cash flow is calculated as operating cash flow minus capital expenditure; both source values are preserved.");
  const latest = newestFact(annualFinancials.flatMap((period) => period.accessionNumber ? [{
    accn: period.accessionNumber,
    filed: period.filingDate ?? undefined,
  }] : []));
  return {
    cik: paddedCik,
    entityName: payload.entityName ?? fallbackName,
    annualFinancials,
    warnings,
    latestFiling: latest?.accn ? {
      url: secFilingUrl(paddedCik, latest.accn),
      filingDate: latest.filed ?? null,
    } : null,
  };
}

function selectAnnualFacts(concepts: Record<string, SecConcept>, metric: MetricName) {
  const byEnd = new Map<string, SecFact>();
  for (const tag of metricTags[metric]) {
    const units = concepts[tag]?.units;
    if (!units) continue;
    const preferredUnits = metric === "dilutedSharesOutstanding" ? ["shares"] : metric === "eps" ? ["USD/shares"] : ["USD"];
    const facts = preferredUnits.flatMap((unit) => units[unit] ?? []);
    const tagFacts = new Map<string, SecFact>();
    for (const fact of facts) {
      if (!fact.end || !fact.form || !["10-K", "10-K/A"].includes(fact.form)) continue;
      if (durationMetrics.has(metric)) {
        if (!fact.start || !isAnnualDuration(fact.start, fact.end)) continue;
      } else if (fact.start) continue;
      const current = tagFacts.get(fact.end);
      if (!current || isNewerFact(fact, current)) tagFacts.set(fact.end, fact);
    }
    for (const [end, fact] of Array.from(tagFacts.entries())) {
      if (!byEnd.has(end)) byEnd.set(end, fact);
    }
  }
  return byEnd;
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase().replace(/\./g, "-");
}

function isAnnualDuration(start: string, end: string) {
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000;
  return Number.isFinite(days) && days >= 300 && days <= 430;
}

function isNewerFact(next: SecFact, current: SecFact) {
  return `${next.filed ?? ""}|${next.accn ?? ""}` > `${current.filed ?? ""}|${current.accn ?? ""}`;
}

function newestFact(facts: SecFact[]) {
  return [...facts].sort((a, b) => `${b.filed ?? ""}|${b.accn ?? ""}`.localeCompare(`${a.filed ?? ""}|${a.accn ?? ""}`))[0];
}

function isFact(value: SecFact | undefined): value is SecFact {
  return Boolean(value);
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toMillions(value: unknown) {
  const number = finiteNumber(value);
  return number === null ? null : number / 1_000_000;
}

function subtract(left: number | null, right: number | null) {
  return left === null || right === null ? null : left - right;
}

function sum(left: number | null, right: number | null) {
  if (left === null && right === null) return null;
  return (left ?? 0) + (right ?? 0);
}

function secFilingUrl(cik: string, accessionNumber: string) {
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionNumber.replace(/-/g, "")}/`;
}
