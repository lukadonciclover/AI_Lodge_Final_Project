import { NextResponse } from "next/server";

import { createFinancialDataProvider } from "@/lib/providers/server";
import { FinancialDataProviderError } from "@/lib/providers/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 1) {
    return NextResponse.json({ error: "Enter a company name or ticker." }, { status: 400 });
  }

  try {
    const results = await createFinancialDataProvider().searchCompanies(query);
    return NextResponse.json({ results });
  } catch (error) {
    return providerErrorResponse(error);
  }
}

function providerErrorResponse(error: unknown) {
  if (error instanceof FinancialDataProviderError) {
    return NextResponse.json({ error: error.message, category: error.category }, { status: error.statusCode });
  }
  console.error("Company search failed", error);
  return NextResponse.json({ error: "Unable to search companies." }, { status: 500 });
}
