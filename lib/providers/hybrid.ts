import { buildAlphaCompany, type AlphaCompanyDetails, AlphaVantageProvider } from "@/lib/providers/alpha-vantage";
import { SecCompanyFactsProvider, type SecFinancialData } from "@/lib/providers/sec";
import {
  FinancialDataProviderError,
  type CompanySearchResult,
  type FinancialDataProvider,
  type ImportedAnnualFinancials,
  type ImportedCompany,
} from "@/lib/providers/types";

type SearchProvider = { searchCompanies(query: string): Promise<CompanySearchResult[]> };
type AlphaProvider = Pick<AlphaVantageProvider, "searchCompanies" | "getCompanyDetails" | "getFinancialStatements">;
type SecProvider = Pick<SecCompanyFactsProvider, "importCompany">;

export class HybridFinancialDataProvider implements FinancialDataProvider {
  constructor(
    private readonly alphaVantage: AlphaProvider,
    private readonly sec: SecProvider,
    private readonly fmpSearch?: SearchProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async searchCompanies(query: string) {
    let primaryError: unknown;
    try {
      const results = await this.alphaVantage.searchCompanies(query);
      if (results.length) return results;
    } catch (error) {
      primaryError = error;
    }
    if (this.fmpSearch) {
      try {
        return (await this.fmpSearch.searchCompanies(query)).map((result) => ({ ...result, sourceProvider: "FMP" as const }));
      } catch {
        // Preserve the primary provider's actionable failure when both searches fail.
      }
    }
    if (primaryError) throw primaryError;
    return [];
  }

  async importCompany(symbol: string): Promise<ImportedCompany> {
    const [details, statements] = await Promise.all([
      this.alphaVantage.getCompanyDetails(symbol),
      this.getStatements(symbol),
    ]);
    if (statements.source === "alpha") {
      return buildAlphaCompany(details, statements.annualFinancials, this.now().toISOString());
    }
    return buildSecCompany(details, statements.data, this.now().toISOString());
  }

  private async getStatements(symbol: string): Promise<
    | { source: "sec"; data: SecFinancialData }
    | { source: "alpha"; annualFinancials: ImportedAnnualFinancials[] }
  > {
    try {
      const data = await this.sec.importCompany(symbol);
      const latest = data.annualFinancials[0];
      if (!latest
        || latest.revenueMillion === null
        || latest.netIncomeMillion === null
        || latest.totalAssetsMillion === null
        || latest.cashMillion === null
        || latest.cashFlowFromOperationsMillion === null) {
        throw new FinancialDataProviderError("SEC Company Facts is missing core financial statements.", 404, undefined, "missing_data");
      }
      return { source: "sec", data };
    } catch (error) {
      if (!(error instanceof FinancialDataProviderError) || !["unsupported_company", "missing_data", "network", "rate_limit", "provider"].includes(error.category)) {
        throw error;
      }
      return { source: "alpha", annualFinancials: await this.alphaVantage.getFinancialStatements(symbol) };
    }
  }
}

function buildSecCompany(details: AlphaCompanyDetails, sec: SecFinancialData, retrievedAt: string): ImportedCompany {
  const latest = sec.annualFinancials[0];
  return {
    ...details,
    name: details.name || sec.entityName,
    cashMillion: latest?.cashMillion ?? null,
    debtMillion: latest?.debtMillion ?? null,
    annualFinancials: sec.annualFinancials,
    warnings: [...(details.warnings ?? []), ...sec.warnings],
    source: {
      provider: "SEC Company Facts + Alpha Vantage",
      retrievedAt,
      latestFiling: sec.latestFiling,
      units: "millions",
    },
  };
}
