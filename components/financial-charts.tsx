"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FinancialYear } from "@/lib/types";
import { formatMoney } from "@/lib/format";

type Props = { financials: FinancialYear[]; currency: string };

const tooltipStyle = { border: "1px solid #dce3ec", borderRadius: 8, boxShadow: "0 8px 24px rgba(7,17,31,.08)", fontSize: 12 };

export function RevenueChart({ financials, currency }: Props) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={financials} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#e9eef4" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={8} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value} />
          <Tooltip cursor={{ fill: "#f4f7fa" }} contentStyle={tooltipStyle} formatter={(value: number) => [formatMoney(value, currency), "Revenue"]} />
          <Bar dataKey="revenue" fill="#2474d2" radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProfitabilityChart({ financials, currency }: Props) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={financials} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#e9eef4" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={8} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [formatMoney(value, currency), name === "ebitda" ? "EBITDA" : "Free cash flow"]} />
          <Line dataKey="ebitda" stroke="#2474d2" strokeWidth={2.5} dot={{ r: 3, fill: "#2474d2", strokeWidth: 0 }} activeDot={{ r: 5 }} />
          <Line dataKey="freeCashFlow" stroke="#72a8df" strokeWidth={2.5} dot={{ r: 3, fill: "#72a8df", strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
