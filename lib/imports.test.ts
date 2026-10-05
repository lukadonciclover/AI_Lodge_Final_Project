import { describe, expect, it } from "vitest";
import { importedCompanyToAnalysis, preserveUserAdjustments } from "@/lib/imports";
import type { ImportedCompany } from "@/lib/providers/types";

function imported(revenue = 100): ImportedCompany {
  return {
    symbol: "TEST", name: "Test Company", industry: "Software", sector: "Technology", exchange: "NASDAQ", country: "US", website: null, description: null, currency: "USD",
    sharePrice: 10, sharesOutstandingMillion: 100, marketCapitalizationMillion: 1000, cashMillion: 50, debtMillion: 100,
    annualFinancials: [{
      fiscalYear: 2024, periodEnd: "2024-12-31", currency: "USD", currencies: { incomeStatement: "USD", balanceSheet: "USD", cashFlowStatement: "USD" },
      revenueMillion: revenue, grossProfitMillion: 50, ebitdaMillion: 20, ebitMillion: 15, netIncomeMillion: 10, eps: 1,
      cashMillion: 50, shortTermInvestmentsMillion: null, totalAssetsMillion: 500, shortTermDebtMillion: 20, longTermDebtMillion: 80, debtMillion: 100, totalLiabilitiesMillion: 300, shareholdersEquityMillion: 200,
      cashFlowFromOperationsMillion: 18, capitalExpenditureMillion: -5, freeCashFlowMillion: 13, acquisitionsMillion: null, dividendsPaidMillion: -2, shareRepurchasesMillion: -3, dilutedSharesOutstandingMillion: 100,
    }],
    warnings: [], source: { provider: "Financial Modeling Prep", retrievedAt: "2026-01-01T00:00:00.000Z", latestFiling: null, units: "millions" },
  };
}

describe("refresh preservation", () => {
  it("preserves user-adjusted values while accepting other refreshed values", () => {
    const existing = importedCompanyToAnalysis(imported(100), ["company.currentSharePrice", "financials.2024.revenue"]);
    existing.currentSharePrice = 12;
    existing.financials[0].revenue = 110;
    const refreshed = importedCompanyToAnalysis(imported(150), existing.userAdjustedFields, existing);
    refreshed.currentSharePrice = 11;
    const merged = preserveUserAdjustments(existing, refreshed);
    expect(merged.currentSharePrice).toBe(12);
    expect(merged.financials[0].revenue).toBe(110);
    expect(merged.financials[0].grossProfit).toBe(50);
  });
});
