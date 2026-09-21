# Investment Pitch Copilot

Investment Pitch Copilot is a responsive financial-analysis workspace for students and beginner investors preparing a stock pitch. It turns company fundamentals and up to five years of historical results into a consistent dashboard, valuation snapshot, and structured investment recommendation.

The MVP ships with a fictional sample company, Nova Systems, so the full workflow is available immediately.

## Features

- Dashboard for creating, opening, and deleting saved company analyses
- Guided company and historical-financial-data entry
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
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
| `/new` | Two-step company and historical-data form |
| `/analysis/[id]` | Financial dashboard and valuation overview |
| `/analysis/[id]/thesis` | Investment thesis and recommendation editor |

## Financial Conventions

Shares outstanding and company financial figures are entered in millions. Share prices are entered per share. This keeps market capitalisation and enterprise value in the same million-unit basis as revenue, EBITDA, and net income.

The application calculates:

- Market capitalisation = share price x shares outstanding
- Enterprise value = market capitalisation + debt - cash
- Revenue growth = latest revenue / prior-year revenue - 1
- EBITDA, net profit, and free-cash-flow margins = metric / revenue
- EV/Revenue = enterprise value / latest revenue
- EV/EBITDA = enterprise value / latest EBITDA
- Price/Earnings = market capitalisation / latest net income

## Data Storage

Analyses are stored in the browser under the local-storage key `investment-pitch-copilot-analyses`. Data is specific to the browser and device, and clearing browser storage removes saved analyses. When no saved data exists, the sample Nova Systems analysis is added automatically.

This MVP intentionally does not include authentication, live market data, PDF extraction, or AI-generated content.
