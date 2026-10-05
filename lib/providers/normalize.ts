import type {
  CompanySearchResult,
  ImportedAnnualFinancials,
  ImportedCompany,
} from "@/lib/providers/types";

export type FmpRecord = Record<string, unknown>;

export type CompanyNormalizationInput = {
  symbol: string;
  profile: FmpRecord | null;
  quote: FmpRecord | null;
  incomeStatements: FmpRecord[];
  balanceSheets: FmpRecord[];
  cashFlowStatements: FmpRecord[];
  retrievedAt: string;
};

const MILLION = 1_000_000;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function millions(value: unknown): number | null {
  const parsed = number(value);
  return parsed === null ? null : parsed / MILLION;
}

function fiscalYear(record: FmpRecord): number | null {
  const raw = text(record.calendarYear) ?? text(record.fiscalYear);
  const fromDate = text(record.date)?.slice(0, 4) ?? null;
  const parsed = Number(raw ?? fromDate);
  return Number.isInteger(parsed) && parsed >= 1900 && parsed <= 2200 ? parsed : null;
}

function recordTimestamp(record: FmpRecord): number {
  for (const key of ["acceptedDate", "fillingDate", "filingDate", "date"]) {
    const value = text(record[key]);
    if (value) {
      const timestamp = Date.parse(value);
      if (!Number.isNaN(timestamp)) return timestamp;
    }
  }
  return 0;
}

function dedupeAnnual(
  records: FmpRecord[],
  statementName: string,
  warnings: string[],
): Map<number, FmpRecord> {
  const grouped = new Map<number, FmpRecord[]>();

  for (const record of records) {
    const period = text(record.period);
    if (period && period.toUpperCase() !== "FY" && period.toLowerCase() !== "annual") {
      warnings.push(`${statementName}: ignored a non-annual period.`);
      continue;
    }
    const year = fiscalYear(record);
    if (year === null) {
      warnings.push(`${statementName}: ignored a record without a valid fiscal year.`);
      continue;
    }
    grouped.set(year, [...(grouped.get(year) ?? []), record]);
  }

  const result = new Map<number, FmpRecord>();
  grouped.forEach((candidates, year) => {
    const latest = [...candidates].sort((a, b) => recordTimestamp(b) - recordTimestamp(a))[0];
    result.set(year, latest);
    if (candidates.length > 1) {
      warnings.push(
        `${statementName}: ${candidates.length} records found for ${year}; used the latest filing/restatement.`,
      );
    }
  });
  return result;
}

function firstRecord(records: unknown): FmpRecord | null {
  if (!Array.isArray(records)) return null;
  const value = records.find((record) => record && typeof record === "object");
  return (value as FmpRecord | undefined) ?? null;
}

export function normalizeSearchResults(payload: unknown): CompanySearchResult[] {
  if (!Array.isArray(payload)) return [];

  return payload.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const record = raw as FmpRecord;
    const symbol = text(record.symbol);
    const name = text(record.name);
    if (!symbol || !name) return [];
    return [{
      symbol: symbol.toUpperCase(),
      name,
      currency: text(record.currency),
      exchange: text(record.stockExchange) ?? text(record.exchangeFullName) ?? text(record.exchange),
      exchangeShortName: text(record.exchangeShortName) ?? text(record.exchange),
      country: text(record.country),
    }];
  });
}

export function normalizeCompany(input: CompanyNormalizationInput): ImportedCompany {
  const warnings: string[] = [];
  const income = dedupeAnnual(input.incomeStatements, "Income statement", warnings);
  const balance = dedupeAnnual(input.balanceSheets, "Balance sheet", warnings);
  const cashFlow = dedupeAnnual(input.cashFlowStatements, "Cash flow statement", warnings);
  const years = Array.from(new Set([
    ...Array.from(income.keys()),
    ...Array.from(balance.keys()),
    ...Array.from(cashFlow.keys()),
  ]))
    .sort((a, b) => b - a)
    .slice(0, 5);

  const periodSets = [income, balance, cashFlow].filter((statement) => statement.size > 0);
  if (periodSets.length > 1 && periodSets.some((statement) => years.some((year) => !statement.has(year)))) {
    warnings.push("Income statement, balance sheet and cash flow periods are not fully aligned.");
  }

  const annualFinancials: ImportedAnnualFinancials[] = years.map((year) => {
    const incomeRecord = income.get(year);
    const balanceRecord = balance.get(year);
    const cashFlowRecord = cashFlow.get(year);
    const currencies = {
      incomeStatement: text(incomeRecord?.reportedCurrency),
      balanceSheet: text(balanceRecord?.reportedCurrency),
      cashFlowStatement: text(cashFlowRecord?.reportedCurrency),
    };
    const reportedCurrencies = Array.from(new Set(Object.values(currencies).filter(Boolean))) as string[];
    if (reportedCurrencies.length > 1) {
      warnings.push(`${year}: source statements report inconsistent currencies (${reportedCurrencies.join(", ")}); values were not converted.`);
    }
    const periodEnds = Array.from(new Set([incomeRecord, balanceRecord, cashFlowRecord].map((record) => text(record?.date)).filter(Boolean)));
    if (periodEnds.length > 1) warnings.push(`${year}: source statements have inconsistent period ending dates (${periodEnds.join(", ")}).`);

    const result: ImportedAnnualFinancials = {
      fiscalYear: year,
      periodEnd: text(incomeRecord?.date) ?? text(balanceRecord?.date) ?? text(cashFlowRecord?.date),
      currency: currencies.incomeStatement ?? currencies.balanceSheet ?? currencies.cashFlowStatement,
      currencies,
      revenueMillion: millions(incomeRecord?.revenue),
      grossProfitMillion: millions(incomeRecord?.grossProfit),
      ebitdaMillion: millions(incomeRecord?.ebitda),
      ebitMillion: millions(incomeRecord?.operatingIncome),
      netIncomeMillion: millions(incomeRecord?.netIncome),
      eps: number(incomeRecord?.epsdiluted) ?? number(incomeRecord?.eps),
      freeCashFlowMillion: millions(cashFlowRecord?.freeCashFlow),
      cashMillion: millions(balanceRecord?.cashAndCashEquivalents),
      shortTermInvestmentsMillion: millions(balanceRecord?.shortTermInvestments),
      totalAssetsMillion: millions(balanceRecord?.totalAssets),
      shortTermDebtMillion: millions(balanceRecord?.shortTermDebt),
      longTermDebtMillion: millions(balanceRecord?.longTermDebt),
      debtMillion: millions(balanceRecord?.totalDebt),
      totalLiabilitiesMillion: millions(balanceRecord?.totalLiabilities),
      shareholdersEquityMillion: millions(balanceRecord?.totalStockholdersEquity),
      cashFlowFromOperationsMillion: millions(cashFlowRecord?.operatingCashFlow ?? cashFlowRecord?.netCashProvidedByOperatingActivities),
      capitalExpenditureMillion: millions(cashFlowRecord?.capitalExpenditure),
      acquisitionsMillion: millions(cashFlowRecord?.acquisitionsNet),
      dividendsPaidMillion: millions(cashFlowRecord?.dividendsPaid),
      shareRepurchasesMillion: millions(cashFlowRecord?.commonStockRepurchased),
      dilutedSharesOutstandingMillion: millions(incomeRecord?.weightedAverageShsOutDil),
    };

    const missing = Object.entries(result)
      .filter(([key, value]) => key.endsWith("Million") && value === null)
      .map(([key]) => key);
    if (missing.length) warnings.push(`${year}: missing ${missing.join(", ")}.`);
    return result;
  });

  const currenciesAcrossPeriods = Array.from(new Set(
    annualFinancials.flatMap((period) => Object.values(period.currencies)).filter(Boolean),
  )) as string[];
  if (currenciesAcrossPeriods.length > 1) {
    warnings.push(
      `Annual statements contain multiple reported currencies (${currenciesAcrossPeriods.join(", ")}); values were not converted.`,
    );
  }

  const allStatements = [
    ...input.incomeStatements,
    ...input.balanceSheets,
    ...input.cashFlowStatements,
  ];
  const latestFilingRecord = allStatements
    .filter((record) => text(record.finalLink) ?? text(record.link))
    .sort((a, b) => recordTimestamp(b) - recordTimestamp(a))[0];
  const profile = input.profile ?? {};
  const quote = input.quote ?? {};
  const symbol = (text(profile.symbol) ?? text(quote.symbol) ?? input.symbol).toUpperCase();

  if (!input.profile) warnings.push("Company profile was unavailable.");
  if (!input.quote) warnings.push("Current market quote was unavailable.");
  if (!annualFinancials.length) warnings.push("No annual financial statements were available.");

  return {
    symbol,
    name: text(profile.companyName) ?? text(quote.name) ?? symbol,
    industry: text(profile.industry),
    sector: text(profile.sector),
    exchange: text(profile.exchangeShortName) ?? text(profile.exchange),
    country: text(profile.country),
    website: text(profile.website),
    description: text(profile.description),
    currency: text(profile.currency),
    sharePrice: number(quote.price) ?? number(profile.price),
    sharesOutstandingMillion: millions(quote.sharesOutstanding),
    marketCapitalizationMillion: millions(quote.marketCap) ?? millions(profile.marketCap) ?? millions(profile.mktCap),
    cashMillion: annualFinancials.find((period) => period.cashMillion !== null)?.cashMillion ?? null,
    debtMillion: annualFinancials.find((period) => period.debtMillion !== null)?.debtMillion ?? null,
    annualFinancials,
    warnings,
    source: {
      provider: "Financial Modeling Prep",
      retrievedAt: input.retrievedAt,
      units: "millions",
      latestFiling: latestFilingRecord ? {
        url: (text(latestFilingRecord.finalLink) ?? text(latestFilingRecord.link))!,
        filingDate: text(latestFilingRecord.fillingDate) ?? text(latestFilingRecord.filingDate),
      } : null,
    },
  };
}

export function firstFmpRecord(payload: unknown): FmpRecord | null {
  return firstRecord(payload);
}
