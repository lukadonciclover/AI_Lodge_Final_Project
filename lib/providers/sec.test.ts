import { describe, expect, it, vi } from "vitest";

import { normalizeSecCompanyFacts, SecCompanyFactsProvider } from "@/lib/providers/sec";

type TestFact = {
  start?: string; end: string; val: number; accn: string; fy: number; fp: string; form: string; filed: string;
};

const annual = (val: number, overrides: Partial<TestFact> = {}): TestFact => ({
  start: "2025-01-01",
  end: "2025-12-31",
  val,
  accn: "0001628280-26-012494",
  fy: 2025,
  fp: "FY",
  form: "10-K",
  filed: "2026-02-27",
  ...overrides,
});

const instant = (val: number, overrides: Record<string, unknown> = {}) => {
  const fact = annual(val, overrides);
  delete fact.start;
  return fact;
};

function concept(unit: string, facts: TestFact[]) {
  return { units: { [unit]: facts } };
}

const duolFacts = {
  cik: 1562088,
  entityName: "Duolingo, Inc.",
  facts: {
    "us-gaap": {
      RevenueFromContractWithCustomerExcludingAssessedTax: concept("USD", [
        annual(1_000_000_000, { filed: "2026-02-20", accn: "old" }),
        annual(1_037_589_000),
        annual(298_454_000, { start: "2026-04-01", end: "2026-06-30", form: "10-Q", fp: "Q2" }),
      ]),
      CostOfRevenue: concept("USD", [annual(288_132_000)]),
      GrossProfit: concept("USD", [annual(749_457_000)]),
      OperatingIncomeLoss: concept("USD", [annual(135_570_000)]),
      NetIncomeLoss: concept("USD", [annual(414_065_000)]),
      CashAndCashEquivalentsAtCarryingValue: concept("USD", [instant(1_036_389_000)]),
      Assets: concept("USD", [instant(1_992_182_000)]),
      AssetsCurrent: concept("USD", [instant(1_436_606_000)]),
      LiabilitiesCurrent: concept("USD", [instant(551_148_000)]),
      Liabilities: concept("USD", [instant(645_176_000)]),
      StockholdersEquity: concept("USD", [instant(1_347_006_000)]),
      NetCashProvidedByUsedInOperatingActivities: concept("USD", [annual(387_823_000)]),
      PaymentsToAcquirePropertyPlantAndEquipment: concept("USD", [annual(18_096_000)]),
      WeightedAverageNumberOfDilutedSharesOutstanding: concept("shares", [annual(48_308_000)]),
      EarningsPerShareDiluted: concept("USD/shares", [annual(8.57)]),
    },
  },
};

describe("SEC Company Facts", () => {
  it("normalizes DUOL annual facts, deduplicates filings and derives free cash flow", () => {
    const result = normalizeSecCompanyFacts(duolFacts, "0001562088", "Duolingo, Inc.");
    expect(result.annualFinancials).toHaveLength(1);
    expect(result.annualFinancials[0]).toMatchObject({
      fiscalYear: 2025,
      fiscalPeriod: "FY",
      form: "10-K",
      accessionNumber: "0001628280-26-012494",
      filingDate: "2026-02-27",
      sourceProvider: "SEC",
      revenueMillion: 1_037.589,
      costOfRevenueMillion: 288.132,
      grossProfitMillion: 749.457,
      ebitMillion: 135.57,
      netIncomeMillion: 414.065,
      cashMillion: 1_036.389,
      totalAssetsMillion: 1_992.182,
      currentAssetsMillion: 1_436.606,
      currentLiabilitiesMillion: 551.148,
      totalLiabilitiesMillion: 645.176,
      shareholdersEquityMillion: 1_347.006,
      cashFlowFromOperationsMillion: 387.823,
      capitalExpenditureMillion: 18.096,
      freeCashFlowMillion: 369.727,
      dilutedSharesOutstandingMillion: 48.308,
      eps: 8.57,
    });
    expect(result.latestFiling?.url).toContain("/1562088/000162828026012494/");
  });

  it("uses an identifying User-Agent, caches requests and pads CIK values", async () => {
    const fetchMock = vi.fn(async (input: string | URL, _init?: RequestInit & { next?: { revalidate: number } }) => {
      void _init;
      const url = String(input);
      return new Response(JSON.stringify(url.includes("company_tickers")
        ? { 0: { cik_str: 1562088, ticker: "DUOL", title: "Duolingo, Inc." } }
        : duolFacts));
    });
    const provider = new SecCompanyFactsProvider({
      userAgent: "InvestmentPitchCopilot/1.0 tests@example.com",
      fetch: fetchMock,
      minimumIntervalMs: 0,
    });

    await provider.importCompany("duol");
    await provider.importCompany("DUOL");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain("CIK0001562088.json");
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ "User-Agent": "InvestmentPitchCopilot/1.0 tests@example.com" });
    expect(fetchMock.mock.calls[0][1]?.next).toEqual({ revalidate: 86_400 });
  });

  it("requires an SEC-compliant contact email", () => {
    expect(() => new SecCompanyFactsProvider({ userAgent: "InvestmentPitchCopilot" })).toThrow(expect.objectContaining({ category: "configuration" }));
  });
});
