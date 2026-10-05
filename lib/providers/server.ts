import "server-only";

import { AlphaVantageProvider } from "@/lib/providers/alpha-vantage";
import { FmpFinancialDataProvider } from "@/lib/providers/fmp";
import { HybridFinancialDataProvider } from "@/lib/providers/hybrid";
import { SecCompanyFactsProvider } from "@/lib/providers/sec";
import type { FinancialDataProvider } from "@/lib/providers/types";

const alphaVantageApiKey = process.env.ALPHA_VANTAGE_API_KEY?.trim() ?? "";
const secUserAgent = process.env.SEC_USER_AGENT?.trim() ?? "";
const fmpApiKey = process.env.FMP_API_KEY?.trim() ?? "";

console.info("[financial-data] provider configuration", {
  alphaVantageConfigured: alphaVantageApiKey.length > 0,
  secUserAgentConfigured: secUserAgent.length > 0,
  fmpSearchFallbackConfigured: fmpApiKey.length > 0,
});

let provider: FinancialDataProvider | undefined;

export function createFinancialDataProvider() {
  provider ??= new HybridFinancialDataProvider(
    new AlphaVantageProvider({ apiKey: alphaVantageApiKey }),
    new SecCompanyFactsProvider({ userAgent: secUserAgent }),
    fmpApiKey ? new FmpFinancialDataProvider({ apiKey: fmpApiKey }) : undefined,
  );
  return provider;
}
