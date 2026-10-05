import { describe, expect, it, vi } from "vitest";

import { AlphaVantageProvider, normalizeAlphaStatements } from "@/lib/providers/alpha-vantage";

const jsonResponse = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status });

describe("Alpha Vantage provider", () => {
  it("searches symbols with server-side caching and source labels", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit & { next?: { revalidate: number } }) => {
      void input;
      void init;
      return jsonResponse({ bestMatches: [{
        "1. symbol": "DUOL", "2. name": "Duolingo, Inc.", "4. region": "United States", "8. currency": "USD",
      }] });
    });
    const provider = new AlphaVantageProvider({ apiKey: "secret", fetch: fetchMock });

    await expect(provider.searchCompanies("Duolingo")).resolves.toMatchObject([{ symbol: "DUOL", sourceProvider: "Alpha Vantage" }]);
    await provider.searchCompanies("Duolingo");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("function=SYMBOL_SEARCH");
    expect(String(fetchMock.mock.calls[0][0])).toContain("apikey=secret");
    expect(fetchMock.mock.calls[0][1]).toEqual({ next: { revalidate: 86_400 } });
  });

  it("detects rate limits returned with HTTP 200 without exposing the key", async () => {
    const provider = new AlphaVantageProvider({
      apiKey: "do-not-expose",
      fetch: vi.fn(async () => jsonResponse({ Note: "Thank you for using Alpha Vantage. Our standard API rate limit applies." })),
    });
    const error = await provider.searchCompanies("DUOL").catch((caught) => caught);
    expect(error).toMatchObject({ category: "rate_limit", statusCode: 429 });
    expect(error.message).not.toContain("do-not-expose");
  });

  it("distinguishes invalid authentication messages returned with HTTP 200", async () => {
    const provider = new AlphaVantageProvider({
      apiKey: "bad",
      fetch: vi.fn(async () => jsonResponse({ Information: "Please provide a valid API key." })),
    });
    await expect(provider.searchCompanies("DUOL")).rejects.toMatchObject({ category: "authentication", statusCode: 503 });
  });

  it("classifies non-JSON HTTP authentication failures", async () => {
    const provider = new AlphaVantageProvider({ apiKey: "bad", fetch: vi.fn(async () => new Response("Forbidden", { status: 403 })) });
    await expect(provider.searchCompanies("DUOL")).rejects.toMatchObject({ category: "authentication", statusCode: 503 });
  });

  it("normalizes annual statements and calculates free cash flow from source values", () => {
    const periods = normalizeAlphaStatements(
      { annualReports: [{ fiscalDateEnding: "2025-12-31", reportedCurrency: "USD", totalRevenue: "1037589000", costOfRevenue: "288132000", grossProfit: "749457000", operatingIncome: "135570000", netIncome: "414065000" }] },
      { annualReports: [{ fiscalDateEnding: "2025-12-31", reportedCurrency: "USD", cashAndCashEquivalentsAtCarryingValue: "1036389000", totalAssets: "1992182000", totalCurrentAssets: "1200000000", totalCurrentLiabilities: "400000000", totalLiabilities: "645176000", totalShareholderEquity: "1347006000" }] },
      { annualReports: [{ fiscalDateEnding: "2025-12-31", reportedCurrency: "USD", operatingCashflow: "387823000", capitalExpenditures: "-18096000" }] },
    );
    expect(periods[0]).toMatchObject({
      revenueMillion: 1_037.589,
      netIncomeMillion: 414.065,
      cashMillion: 1_036.389,
      cashFlowFromOperationsMillion: 387.823,
      capitalExpenditureMillion: 18.096,
      freeCashFlowMillion: 369.727,
      sourceProvider: "Alpha Vantage",
    });
  });
});
