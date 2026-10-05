import { describe, expect, it } from "vitest";

import { normalizeCompany, normalizeSearchResults } from "@/lib/providers/normalize";

const baseInput = {
  symbol: "TEST",
  profile: { symbol: "TEST", companyName: "Test Company", currency: "USD" },
  quote: { symbol: "TEST", price: 25, sharesOutstanding: 50_000_000, marketCap: 1_250_000_000 },
  incomeStatements: [],
  balanceSheets: [],
  cashFlowStatements: [],
  retrievedAt: "2026-09-21T12:00:00.000Z",
};

describe("search normalization", () => {
  it("normalizes valid companies and removes malformed rows", () => {
    expect(normalizeSearchResults([
      { symbol: "aapl", name: "Apple Inc.", currency: "USD", stockExchange: "NASDAQ" },
      { symbol: "NO_NAME" },
      null,
    ])).toEqual([{
      symbol: "AAPL",
      name: "Apple Inc.",
      currency: "USD",
      exchange: "NASDAQ",
      exchangeShortName: null,
      country: null,
    }]);
  });
});

describe("company normalization", () => {
  it("scales monetary and share quantities to millions and retains filing metadata", () => {
    const company = normalizeCompany({
      ...baseInput,
      incomeStatements: [{
        calendarYear: "2025",
        date: "2025-12-31",
        reportedCurrency: "USD",
        revenue: 2_500_000_000,
        ebitda: 400_000_000,
        operatingIncome: 350_000_000,
        netIncome: 250_000_000,
        weightedAverageShsOutDil: 50_000_000,
        fillingDate: "2026-02-15",
        finalLink: "https://example.com/10-k",
      }],
      balanceSheets: [{
        calendarYear: "2025",
        reportedCurrency: "USD",
        cashAndCashEquivalents: 100_000_000,
        totalDebt: 300_000_000,
      }],
      cashFlowStatements: [{
        calendarYear: "2025",
        reportedCurrency: "USD",
        freeCashFlow: 200_000_000,
      }],
    });

    expect(company.sharesOutstandingMillion).toBe(50);
    expect(company.marketCapitalizationMillion).toBe(1_250);
    expect(company.cashMillion).toBe(100);
    expect(company.debtMillion).toBe(300);
    expect(company.annualFinancials[0]).toMatchObject({
      fiscalYear: 2025,
      currency: "USD",
      revenueMillion: 2_500,
      ebitdaMillion: 400,
      ebitMillion: 350,
      netIncomeMillion: 250,
      freeCashFlowMillion: 200,
      cashMillion: 100,
      debtMillion: 300,
      dilutedSharesOutstandingMillion: 50,
    });
    expect(company.source.latestFiling).toEqual({
      url: "https://example.com/10-k",
      filingDate: "2026-02-15",
    });
  });

  it("keeps missing fields null and reports them", () => {
    const company = normalizeCompany({
      ...baseInput,
      quote: null,
      incomeStatements: [{ calendarYear: "2025", reportedCurrency: "USD", revenue: null }],
    });

    expect(company.sharePrice).toBeNull();
    expect(company.annualFinancials[0].revenueMillion).toBeNull();
    expect(company.annualFinancials[0].freeCashFlowMillion).toBeNull();
    expect(company.warnings).toContain("Current market quote was unavailable.");
    expect(company.warnings.some((warning) => warning.includes("missing revenueMillion"))).toBe(true);
  });

  it("uses the newest filing when duplicate annual periods represent restatements", () => {
    const company = normalizeCompany({
      ...baseInput,
      incomeStatements: [
        { calendarYear: "2024", revenue: 100_000_000, acceptedDate: "2025-02-01" },
        { calendarYear: "2024", revenue: 120_000_000, acceptedDate: "2025-04-01" },
      ],
    });

    expect(company.annualFinancials).toHaveLength(1);
    expect(company.annualFinancials[0].revenueMillion).toBe(120);
    expect(company.warnings.some((warning) => warning.includes("latest filing/restatement"))).toBe(true);
  });

  it("preserves differing statement currencies and warns without converting values", () => {
    const company = normalizeCompany({
      ...baseInput,
      incomeStatements: [{ calendarYear: "2025", reportedCurrency: "USD", revenue: 1_000_000 }],
      balanceSheets: [{ calendarYear: "2025", reportedCurrency: "EUR", totalDebt: 2_000_000 }],
      cashFlowStatements: [{ calendarYear: "2025", reportedCurrency: "GBP", freeCashFlow: 3_000_000 }],
    });

    expect(company.annualFinancials[0].currencies).toEqual({
      incomeStatement: "USD",
      balanceSheet: "EUR",
      cashFlowStatement: "GBP",
    });
    expect(company.annualFinancials[0]).toMatchObject({
      revenueMillion: 1,
      debtMillion: 2,
      freeCashFlowMillion: 3,
    });
    expect(company.warnings.some((warning) => warning.includes("inconsistent currencies"))).toBe(true);
  });

  it("excludes quarterly records from annual history", () => {
    const company = normalizeCompany({
      ...baseInput,
      incomeStatements: [
        { calendarYear: "2025", period: "Q4", revenue: 25_000_000 },
        { calendarYear: "2024", period: "FY", revenue: 100_000_000 },
      ],
    });
    expect(company.annualFinancials.map((period) => period.fiscalYear)).toEqual([2024]);
    expect(company.warnings.some((warning) => warning.includes("non-annual"))).toBe(true);
  });

  it("warns when statement period ending dates do not align", () => {
    const company = normalizeCompany({
      ...baseInput,
      incomeStatements: [{ calendarYear: "2025", date: "2025-12-31", revenue: 10_000_000 }],
      balanceSheets: [{ calendarYear: "2025", date: "2025-09-30", totalAssets: 20_000_000 }],
    });
    expect(company.warnings.some((warning) => warning.includes("inconsistent period ending dates"))).toBe(true);
  });
});
