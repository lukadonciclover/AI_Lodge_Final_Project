import { CompanyAnalysis } from "@/lib/types";

export const sampleAnalysis: CompanyAnalysis = {
  id: "nova-systems",
  companyName: "Nova Systems",
  ticker: "NOVA",
  industry: "Enterprise Software",
  currency: "USD",
  currentSharePrice: 84.2,
  sharesOutstanding: 185,
  cash: 1240,
  debt: 680,
  financials: [
    { year: 2020, revenue: 2580, ebitda: 568, ebit: 438, netIncome: 302, freeCashFlow: 350 },
    { year: 2021, revenue: 2940, ebitda: 676, ebit: 529, netIncome: 371, freeCashFlow: 426 },
    { year: 2022, revenue: 3380, ebitda: 811, ebit: 642, netIncome: 448, freeCashFlow: 503 },
    { year: 2023, revenue: 3890, ebitda: 972, ebit: 778, netIncome: 552, freeCashFlow: 630 },
    { year: 2024, revenue: 4510, ebitda: 1173, ebit: 947, netIncome: 682, freeCashFlow: 776 }
  ],
  thesis: {
    summary: "Nova is a high-quality compounder benefiting from durable cloud migration, rising net retention and operating leverage. Its expanding enterprise footprint supports above-market growth while disciplined investment is translating into stronger free cash flow.",
    recommendation: "Buy",
    targetPrice: 102,
    catalysts: [
      "Enterprise contract wins accelerate annual recurring revenue growth",
      "EBITDA margin expands as cloud infrastructure costs normalize",
      "New workflow product increases cross-sell across the installed base"
    ],
    risks: [
      "Longer enterprise sales cycles delay new bookings",
      "Competition pressures pricing and customer acquisition costs",
      "Premium valuation increases sensitivity to execution misses"
    ]
  },
  updatedAt: "2026-09-18T14:30:00.000Z"
};
