# Investment Pitch Copilot

Investment Pitch Copilot is a responsive financial-analysis workspace for students and beginner investors preparing a stock pitch. It turns company fundamentals and up to five years of historical results into a consistent dashboard, valuation snapshot, and structured investment recommendation.

The MVP ships with a fictional sample company, Nova Systems, so the full workflow is available immediately.

## Features

- Dashboard for creating, opening, and deleting saved company analyses
- Guided company and historical-financial-data entry
- Financial Modeling Prep company search and five-year annual-statement import
- Editable import review, source warnings, filing links, and refresh comparison
- Input validation for required fields, years, monetary values, and share data
- Automatic market capitalisation, enterprise value, growth, margin, and trading-multiple calculations
- Responsive Recharts visualisations for revenue, EBITDA, and free cash flow
- Historical financial-performance table
- Investment thesis editor with recommendation, target price, catalysts, and risks
- Browser local-storage persistence with no account or backend required
- Responsive desktop and mobile navigation

## Technology

- Next.js 14 App Router and TypeScript
- Tailwind CSS
- shadcn/ui-style components built with Radix UI primitives
- Recharts
- Lucide icons

## Getting Started

Requirements:

- Node.js 20 or newer
- npm

Install dependencies and start the development server:

```bash
npm install
npm run test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Financial Modeling Prep Setup

Copy `.env.example` to `.env.local` and add a Financial Modeling Prep API key:

```bash
FMP_API_KEY=your_server_side_key
```

Restart the development server after changing environment variables. The key is read only by Next.js route handlers and is never sent to browser code. Do not commit `.env.local`.

To import a company:

1. Open **New analysis** and choose **Import company financials**.
2. Search by company name or ticker.
3. Select the exact listed security using its ticker and exchange.
4. Review all imported values, warnings, currencies, and period-end dates.
5. Edit values if necessary and confirm the import.

Imported analyses retain an **Edit data** action. **Refresh financials** retrieves a new provider snapshot and requires confirmation before replacing data; previously user-adjusted values are preserved.

For a production build:

```bash
npm run build
npm start
```

Run lint checks with:

```bash
npm run lint
```

## Application Routes

| Route | Purpose |
| --- | --- |
| `/` | Dashboard of saved analyses |
| `/new` | Company import or manual-entry workflow |
| `/analysis/[id]` | Financial dashboard and valuation overview |
| `/analysis/[id]/edit` | Manual editing of confirmed financial data |
| `/analysis/[id]/refresh` | Review and confirm refreshed provider data |
| `/analysis/[id]/thesis` | Investment thesis and recommendation editor |

## Financial Conventions

Shares outstanding and company financial figures are entered in millions. Share prices are entered per share. This keeps market capitalisation and enterprise value in the same million-unit basis as revenue, EBITDA, and net income.

The application calculates:

- Market capitalisation = share price x shares outstanding
- Enterprise value = market capitalisation + debt - cash
- Revenue growth = latest revenue / prior-year revenue - 1
- Revenue CAGR = (latest revenue / oldest revenue)^(1 / elapsed years) - 1
- Gross, EBITDA, operating, net-profit, and free-cash-flow margins = metric / revenue
- EV/Revenue = enterprise value / latest revenue
- EV/EBITDA = enterprise value / latest EBITDA
- Price/Earnings = share price / EPS when EPS is available, otherwise market capitalisation / net income
- Free-cash-flow yield = free cash flow / market capitalisation
- Return on equity = net income / shareholders' equity

Valuation multiples display `N/M` when their denominator is zero or negative. Missing source values display `N/A` and are not estimated. Short-term investments are shown separately and are not treated as excess cash in net debt or enterprise value.

## Data-Source Limitations

- Financial Modeling Prep coverage varies by exchange, security type, plan, and API entitlement.
- The importer requests annual statements only and keeps at most five fiscal years.
- Provider figures are normalized to millions, except share price and EPS. Values are not currency-converted.
- Restated records for the same fiscal year are deduplicated using the latest filing timestamp available from the provider.
- Missing statements, partial histories, period mismatches, and currency inconsistencies are surfaced during review.
- API responses may be delayed and should be checked against the linked filing before use in an investment presentation.
- Successful upstream requests use Next.js fetch caching to reduce duplicate provider calls.

## Data Storage

Analyses are stored in the browser under the local-storage key `investment-pitch-copilot-analyses`. Data is specific to the browser and device, and clearing browser storage removes saved analyses. When no saved data exists, the sample Nova Systems analysis is added automatically.

Run the mocked test suite with `npm test`. Tests never call the live Financial Modeling Prep API.

This MVP intentionally does not include authentication, PDF extraction, AI-generated recommendations, DCF valuation, or presentation export.
