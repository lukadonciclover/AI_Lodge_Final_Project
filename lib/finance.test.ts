import { describe, expect, it } from "vitest";
import { calculateMetrics } from "@/lib/finance";
import type { CompanyAnalysis } from "@/lib/types";

function analysis(overrides: Partial<CompanyAnalysis> = {}): CompanyAnalysis {
  return {
    id: "test", companyName: "Test", ticker: "TEST", industry: "Software", currency: "USD",
    currentSharePrice: 10, sharesOutstanding: 100, cash: 300, debt: 100,
    financials: [
      { year: 2023, revenue: 100, grossProfit: 50, ebitda: 20, ebit: 15, netIncome: 10, freeCashFlow: 8, shareholdersEquity: 80 },
      { year: 2024, revenue: 121, grossProfit: 66, ebitda: 30, ebit: 24, netIncome: 18, freeCashFlow: 15, shareholdersEquity: 90 },
    ],
    thesis: { summary: "", recommendation: "Hold", targetPrice: 10, catalysts: [], risks: [] },
    updatedAt: "2026-01-01T00:00:00.000Z", ...overrides,
  };
}

describe("imported financial calculations", () => {
  it("calculates growth, CAGR, margins, net debt, valuation, FCF yield and ROE", () => {
    const metrics = calculateMetrics(analysis());
    expect(metrics.marketCap).toBe(1000);
    expect(metrics.netDebt).toBe(-200);
    expect(metrics.enterpriseValue).toBe(800);
    expect(metrics.revenueGrowth).toBeCloseTo(0.21);
    expect(metrics.revenueCagr).toBeCloseTo(0.21);
    expect(metrics.grossMargin).toBeCloseTo(66 / 121);
    expect(metrics.fcfYield).toBeCloseTo(0.015);
    expect(metrics.returnOnEquity).toBeCloseTo(0.2);
  });

  it("returns N/M for negative EBITDA and net income", () => {
    const value = analysis({ financials: [{ year: 2024, revenue: 100, ebitda: -5, ebit: -8, netIncome: -10, freeCashFlow: -4 }] });
    const metrics = calculateMetrics(value);
    expect(metrics.evEbitda).toBe("nm");
    expect(metrics.priceEarnings).toBe("nm");
  });

  it("returns N/M for zero valuation denominators and N/A for missing denominators", () => {
    const zero = calculateMetrics(analysis({ financials: [{ year: 2024, revenue: 0, ebitda: 0, ebit: 0, netIncome: 10, eps: 0, freeCashFlow: null }] }));
    expect(zero.evRevenue).toBe("nm");
    expect(zero.evEbitda).toBe("nm");
    expect(zero.priceEarnings).toBe("nm");
    const missing = calculateMetrics(analysis({ financials: [{ year: 2024, revenue: null, ebitda: null, ebit: null, netIncome: null, freeCashFlow: null }] }));
    expect(missing.evRevenue).toBeNull();
  });
});
