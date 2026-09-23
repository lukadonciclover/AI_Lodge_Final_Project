import { NextResponse } from "next/server";

import { createFinancialDataProvider } from "@/lib/providers/server";
import { FinancialDataProviderError } from "@/lib/providers/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const symbol = body && typeof body === "object" && "symbol" in body
    ? (body as { symbol?: unknown }).symbol
    : null;
  if (typeof symbol !== "string" || !symbol.trim()) {
    return NextResponse.json({ error: "A company symbol is required." }, { status: 400 });
  }

  try {
    const company = await createFinancialDataProvider().importCompany(symbol);
    return NextResponse.json({ company });
  } catch (error) {
    if (error instanceof FinancialDataProviderError) {
      return NextResponse.json(
        { error: error.message, code: error.code, category: error.category },
        { status: error.statusCode },
      );
    }
    console.error("Company import failed", error);
    return NextResponse.json({ error: "Unable to import company financials." }, { status: 500 });
  }
}
