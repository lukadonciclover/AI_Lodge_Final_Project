import { describe, expect, it, vi } from "vitest";

import { FmpFinancialDataProvider, type ProviderFetch } from "@/lib/providers/fmp";
import { FinancialDataProviderError } from "@/lib/providers/types";

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("FmpFinancialDataProvider", () => {
  it("reports a missing server key as a configuration error", () => {
    expect(() => new FmpFinancialDataProvider({ apiKey: " " })).toThrow(expect.objectContaining({
      statusCode: 503,
      category: "configuration",
      message: expect.stringContaining("FMP_API_KEY"),
    }));
  });

  it("searches companies with an injected fetch and Next revalidation", async () => {
    const fetchMock = vi.fn(async () => jsonResponse([
      { symbol: "MSFT", name: "Microsoft Corporation", currency: "USD", exchangeShortName: "NASDAQ" },
    ]));
    const provider = new FmpFinancialDataProvider({
      apiKey: "server-secret",
      fetch: fetchMock as ProviderFetch,
    });

    await expect(provider.searchCompanies(" microsoft ")).resolves.toEqual([{
      symbol: "MSFT",
      name: "Microsoft Corporation",
      currency: "USD",
      exchange: null,
      exchangeShortName: "NASDAQ",
      country: null,
    }]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string | URL,
      RequestInit & { next: { revalidate: number } },
    ];
    expect(String(url)).toContain("query=microsoft");
    expect(String(url)).toContain("apikey=server-secret");
    expect(String(url)).toContain("/stable/search-name");
    expect(init).toEqual({ next: { revalidate: 3_600 } });
  });

  it("imports all company datasets and normalizes the response", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const path = new URL(input).pathname;
      if (path.endsWith("/profile")) return jsonResponse([{ symbol: "ACME", companyName: "Acme" }]);
      if (path.endsWith("/quote")) return jsonResponse([{ symbol: "ACME", price: 10 }]);
      if (path.endsWith("/income-statement")) return jsonResponse([{ calendarYear: "2025", revenue: 5_000_000 }]);
      if (path.endsWith("/balance-sheet-statement")) return jsonResponse([{ calendarYear: "2025", totalDebt: 1_000_000 }]);
      return jsonResponse([{ calendarYear: "2025", freeCashFlow: 2_000_000 }]);
    });
    const provider = new FmpFinancialDataProvider({
      apiKey: "key",
      fetch: fetchMock as ProviderFetch,
      now: () => new Date("2026-09-21T12:00:00.000Z"),
    });

    const company = await provider.importCompany("acme");
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(company.symbol).toBe("ACME");
    expect(company.annualFinancials[0]).toMatchObject({
      revenueMillion: 5,
      debtMillion: 1,
      freeCashFlowMillion: 2,
    });
    expect(company.source.retrievedAt).toBe("2026-09-21T12:00:00.000Z");
  });

  it("maps HTTP failures to provider errors without exposing the API key", async () => {
    const provider = new FmpFinancialDataProvider({
      apiKey: "do-not-expose",
      fetch: vi.fn(async () => jsonResponse({ message: "failure" }, 500)) as ProviderFetch,
    });

    const error = await provider.searchCompanies("Apple").catch((caught) => caught);
    expect(error).toBeInstanceOf(FinancialDataProviderError);
    expect(error.statusCode).toBe(502);
    expect(error.message).not.toContain("do-not-expose");
  });

  it("classifies an HTTP authentication failure even when its body is not JSON", async () => {
    const provider = new FmpFinancialDataProvider({
      apiKey: "do-not-expose",
      fetch: vi.fn(async () => new Response("Forbidden", { status: 403 })) as ProviderFetch,
    });

    await expect(provider.searchCompanies("Apple")).rejects.toMatchObject({
      statusCode: 503,
      category: "authentication",
      message: expect.not.stringContaining("do-not-expose"),
    });
  });

  it("rejects API error payloads returned with a successful HTTP status", async () => {
    const provider = new FmpFinancialDataProvider({
      apiKey: "key",
      fetch: vi.fn(async () => jsonResponse({ "Error Message": "Invalid API KEY" })) as ProviderFetch,
    });

    await expect(provider.searchCompanies("Apple")).rejects.toMatchObject({ statusCode: 503, category: "authentication", message: expect.stringContaining("authentication error") });
  });

  it("returns a useful rate-limit error", async () => {
    const provider = new FmpFinancialDataProvider({ apiKey: "key", fetch: vi.fn(async () => jsonResponse({}, 429)) as ProviderFetch });
    await expect(provider.searchCompanies("Apple")).rejects.toMatchObject({ statusCode: 429, category: "rate_limit", message: expect.stringContaining("rate-limit error") });
  });

  it("distinguishes subscription access from authentication failures", async () => {
    const provider = new FmpFinancialDataProvider({ apiKey: "key", fetch: vi.fn(async () => jsonResponse({ message: "Payment Required" }, 402)) as ProviderFetch });
    await expect(provider.searchCompanies("Apple")).rejects.toMatchObject({ statusCode: 503, category: "subscription", message: expect.stringContaining("subscription tier") });
  });

  it("distinguishes malformed queries", async () => {
    const provider = new FmpFinancialDataProvider({ apiKey: "key", fetch: vi.fn(async () => jsonResponse({ message: "Invalid query" }, 400)) as ProviderFetch });
    await expect(provider.searchCompanies("???")).rejects.toMatchObject({ statusCode: 400, category: "invalid_query", message: expect.stringContaining("query error") });
  });
});
