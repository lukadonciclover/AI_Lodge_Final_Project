# Investment Pitch Copilot

A responsive equity-research workspace for university students and beginner investors. The MVP turns company financial data into a structured dashboard and investment recommendation, with all analyses stored locally in the browser.

## Features

- Dashboard for creating, reviewing, and deleting multiple company analyses
- Guided company and historical-financial data entry for up to five years
- Validation for required fields, positive revenue, unique years, and numerical values
- Automatic market capitalisation, enterprise value, growth, margin, and trading-multiple calculations
- Revenue, EBITDA, and free-cash-flow charts built with Recharts
- Detailed historical financial table with year-over-year and margin analysis
- Editable investment thesis, recommendation, target price, catalysts, and risks
- Browser local-storage persistence with a preloaded Nova Systems sample analysis
- Responsive navigation and layouts for desktop and mobile

## Technology

- Next.js App Router and TypeScript
- Tailwind CSS
- shadcn/ui-style components built with Radix Slot and class-variance-authority
- Recharts
- Lucide icons
- Browser local storage

## Getting Started

### Prerequisites

- Node.js 20.9 or later
- npm

### Installation

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm start
```

## Data Conventions

- Shares outstanding and company financial statement values are entered in millions.
- Share price is entered in the selected per-share currency.
- Market capitalisation is share price multiplied by shares outstanding.
- Enterprise value is market capitalisation plus debt, less cash.
- Valuation multiples use the latest financial year entered.
- Revenue growth compares the latest year with the immediately preceding year.

## Project Structure

```text
app/                    Routes, global styles, and layout
components/             Feature components and reusable UI primitives
components/providers/   Local-storage analysis state
components/ui/          shadcn/ui-style form and layout primitives
lib/                    Types, sample data, calculations, and formatters
```

## Local Storage

Analyses are saved under the `investment-pitch-copilot-analyses` key. Data remains on the current browser and device. Clearing site data removes saved analyses; no information is sent to a server.

## MVP Scope

This release intentionally excludes authentication, live market data, document extraction, PDF export, and AI-generated recommendations. The financial inputs and thesis are user-supplied.
