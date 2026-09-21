import "server-only";

import { FmpFinancialDataProvider } from "@/lib/providers/fmp";

export function createFinancialDataProvider() {
  return new FmpFinancialDataProvider({ apiKey: process.env.FMP_API_KEY ?? "" });
}
