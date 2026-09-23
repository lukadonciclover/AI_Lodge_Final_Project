import { describe, expect, it, vi } from "vitest";

import { HybridFinancialDataProvider } from "@/lib/providers/hybrid";
import { FinancialDataProviderError, type ImportedAnnualFinancials } from "@/lib/providers/types";

const details = {
  symbol: "DUOL", name: "Duolingo, Inc.", industry: "Software", sector: "Technology", exchange: "NASDAQ",
  country: "USA", website: "https://duolingo.com", description: "Language learning", currency: "USD",
  sharePrice: 300, sharesOutstandingMillion: 48, marketCapitalizationMillion: 14_400,
};

const period: ImportedAnnualFinancials = {
  fiscalYear: 2025, periodEnd: "2025-12-31", currency: "USD",
  currencies: { incomeStatement: "USD", balanceSheet: "USD", cashFlowStatement: "USD" },
  revenueMillion: 1_037.589, grossProfitMillion: 749.457, ebitdaMillion: null, ebitMillion: 135.57,
  netIncomeMillion: 414.065, eps: 8.52, shortTermInvestmentsMillion: null, totalAssetsMillion: 1_992.182,
  shortTermDebtMillion: null, longTermDebtMillion: null, totalLiabilitiesMillion: 645.176,
  shareholdersEquityMillion: 1_347.006, cashFlowFromOperationsMillion: 387.823, capitalExpenditureMillion: 18.096,
  freeCashFlowMillion: 369.727, acquisitionsMillion: null, dividendsPaidMillion: null, shareRepurchasesMillion: null,
  cashMillion: 1_036.389, debtMillion: null, dilutedSharesOutstandingMillion: 48, sourceProvider: "SEC",
};

describe("hybrid financial provider", () => {
  it("uses SEC statements with Alpha Vantage company and price data", async () => {
    const alpha = { searchCompanies: vi.fn(), getCompanyDetails: vi.fn(async () => details), getFinancialStatements: vi.fn() };
    const sec = { importCompany: vi.fn(async () => ({ cik: "0001562088", entityName: details.name, annualFinancials: [period], warnings: [], latestFiling: { url: "https://sec.example/filing", filingDate: "2026-02-27" } })) };
    const provider = new HybridFinancialDataProvider(alpha, sec, undefined, () => new Date("2026-09-22T00:00:00.000Z"));

    const company = await provider.importCompany("DUOL");
    expect(company.source.provider).toBe("SEC Company Facts + Alpha Vantage");
    expect(company.annualFinancials[0].sourceProvider).toBe("SEC");
    expect(company.source.latestFiling?.url).toBe("https://sec.example/filing");
    expect(alpha.getFinancialStatements).not.toHaveBeenCalled();
  });

  it("falls back to Alpha Vantage statements for unsupported SEC companies", async () => {
    const alphaPeriod = { ...period, sourceProvider: "Alpha Vantage" as const };
    const alpha = { searchCompanies: vi.fn(), getCompanyDetails: vi.fn(async () => details), getFinancialStatements: vi.fn(async () => [alphaPeriod]) };
    const sec = { importCompany: vi.fn(async () => { throw new FinancialDataProviderError("unsupported", 404, undefined, "unsupported_company"); }) };
    const provider = new HybridFinancialDataProvider(alpha, sec);

    const company = await provider.importCompany("DUOL");
    expect(company.source.provider).toBe("Alpha Vantage");
    expect(alpha.getFinancialStatements).toHaveBeenCalledWith("DUOL");
  });

  it("uses optional FMP only when Alpha Vantage search has no result", async () => {
    const alpha = { searchCompanies: vi.fn(async () => []), getCompanyDetails: vi.fn(), getFinancialStatements: vi.fn() };
    const sec = { importCompany: vi.fn() };
    const fmp = { searchCompanies: vi.fn(async () => [{ symbol: "DUOL", name: "Duolingo", currency: "USD", exchange: "NASDAQ", exchangeShortName: "NASDAQ", country: "US" }]) };
    const provider = new HybridFinancialDataProvider(alpha, sec, fmp);

    await expect(provider.searchCompanies("DUOL")).resolves.toMatchObject([{ symbol: "DUOL", sourceProvider: "FMP" }]);
  });
});
