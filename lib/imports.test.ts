import { describe, expect, it } from "vitest";
import { analysisToImportedCompany, importedCompanyToAnalysis, preserveUserAdjustments } from "@/lib/imports";
import { calculateMetrics } from "@/lib/finance";
import type { CompanyAnalysis } from "@/lib/types";
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

function manualAnalysis(): CompanyAnalysis {
  return {
    id: "manual-1", companyName: "Manual Co", ticker: "MAN", industry: "Software", currency: "USD",
    currentSharePrice: 10, sharesOutstanding: 100, cash: 20, debt: 10,
    financials: [
      { year: 2023, revenue: 110, ebitda: 27, ebit: 22, netIncome: 18, freeCashFlow: 16 },
      { year: 2024, revenue: 120, ebitda: 30, ebit: 25, netIncome: 20, freeCashFlow: 18 },
    ],
    thesis: {
      summary: "Durable franchise with pricing power.",
      recommendation: "Buy",
      targetPrice: 14,
      catalysts: ["New product launch"],
      risks: ["Margin pressure"],
    },
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("editing a manually created analysis", () => {
  it("preserves cash, debt, enterprise value and the thesis when only revenue changes", () => {
    const created = manualAnalysis();
    const before = calculateMetrics(created);
    expect(before.marketCap).toBe(1000);
    expect(before.enterpriseValue).toBe(990);

    const editor = analysisToImportedCompany(created);
    expect(editor.cashMillion).toBe(20);
    expect(editor.debtMillion).toBe(10);

    const latest = editor.annualFinancials.find((period) => period.fiscalYear === 2024)!;
    latest.revenueMillion = 125;

    const saved = importedCompanyToAnalysis(editor, ["financials.2024.revenue"], created);
    expect(saved.cash).toBe(20);
    expect(saved.debt).toBe(10);
    expect(saved.financials.find((period) => period.year === 2024)?.revenue).toBe(125);
    expect(saved.thesis.summary).toBe("Durable franchise with pricing power.");

    const after = calculateMetrics(saved);
    expect(after.enterpriseValue).toBe(990);
    expect(after.netDebt).toBe(-10);
    expect(after.evRevenue).toBeCloseTo(990 / 125);
    expect(after.evEbitda).toBeCloseTo(990 / 30);
  });

  it("persists the preserved values and thesis across a storage round-trip", () => {
    const created = manualAnalysis();
    const editor = analysisToImportedCompany(created);
    editor.annualFinancials.find((period) => period.fiscalYear === 2024)!.revenueMillion = 125;
    const saved = importedCompanyToAnalysis(editor, ["financials.2024.revenue"], created);

    const rehydrated = JSON.parse(JSON.stringify(saved)) as CompanyAnalysis;
    expect(rehydrated.cash).toBe(20);
    expect(rehydrated.debt).toBe(10);
    expect(rehydrated.thesis.summary).toBe("Durable franchise with pricing power.");
    expect(calculateMetrics(rehydrated).enterpriseValue).toBe(990);
  });

  it("keeps current valuation cash and debt separate from historical balance-sheet values", () => {
    const created = manualAnalysis();
    const editor = analysisToImportedCompany(created);
    const latest = editor.annualFinancials.find((period) => period.fiscalYear === 2024)!;
    latest.cashMillion = 999;
    latest.debtMillion = 777;

    const saved = importedCompanyToAnalysis(editor, ["financials.2024.cash", "financials.2024.totalDebt"], created);
    expect(saved.cash).toBe(20);
    expect(saved.debt).toBe(10);
    const savedLatest = saved.financials.find((period) => period.year === 2024);
    expect(savedLatest?.cash).toBe(999);
    expect(savedLatest?.totalDebt).toBe(777);
  });

  it("treats a valid zero as a real value and keeps missing values null", () => {
    const zero = importedCompanyToAnalysis({ ...imported(100), cashMillion: 0, debtMillion: 0 });
    expect(zero.cash).toBe(0);
    expect(zero.debt).toBe(0);

    const base = imported(100);
    const missing = importedCompanyToAnalysis({
      ...base,
      cashMillion: null,
      debtMillion: null,
      annualFinancials: [{ ...base.annualFinancials[0], cashMillion: null, debtMillion: null }],
    });
    expect(missing.cash).toBeNull();
    expect(missing.debt).toBeNull();
  });
});
