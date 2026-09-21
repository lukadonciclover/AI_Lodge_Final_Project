export const currencySymbols: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", CAD: "C$", AUD: "A$" };

export function formatMoney(value: number | null | undefined, currency = "USD", compact = true) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
  const symbol = currencySymbols[currency] ?? `${currency} `;
  const abs = Math.abs(value);
  if (compact) {
    if (abs >= 1000) return `${value < 0 ? "-" : ""}${symbol}${(abs / 1000).toFixed(1)}bn`;
    return `${value < 0 ? "-" : ""}${symbol}${abs.toFixed(0)}m`;
  }
  if (!/^[A-Z]{3}$/.test(currency)) return `${symbol}${value.toFixed(2)}`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export function formatPercent(value: number | null, digits = 1) {
  return value === null || !Number.isFinite(value) ? "N/A" : `${(value * 100).toFixed(digits)}%`;
}

export function formatMultiple(value: number | null | "nm") {
  return value === "nm" ? "N/M" : value === null || !Number.isFinite(value) ? "N/A" : `${value.toFixed(1)}x`;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}
