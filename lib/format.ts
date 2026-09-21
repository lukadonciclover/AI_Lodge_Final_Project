export const currencySymbols: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", CAD: "C$", AUD: "A$" };

export function formatMoney(value: number, currency = "USD", compact = true) {
  const symbol = currencySymbols[currency] ?? `${currency} `;
  const abs = Math.abs(value);
  if (compact) {
    if (abs >= 1000) return `${value < 0 ? "-" : ""}${symbol}${(abs / 1000).toFixed(1)}bn`;
    return `${value < 0 ? "-" : ""}${symbol}${abs.toFixed(0)}m`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export function formatPercent(value: number | null, digits = 1) {
  return value === null ? "—" : `${(value * 100).toFixed(digits)}%`;
}

export function formatMultiple(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}x`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
