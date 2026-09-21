"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AnalysisTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const tabs = [{ href: `/analysis/${id}`, label: "Financial analysis" }, { href: `/analysis/${id}/thesis`, label: "Investment thesis" }];
  return <div className="mb-6 flex gap-1 border-b">{tabs.map((tab) => { const active = pathname === tab.href; return <Link key={tab.href} href={tab.href} className={cn("relative px-4 py-3 text-sm font-semibold", active ? "text-accent" : "text-slate-500 hover:text-ink")}>{tab.label}{active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />}</Link>; })}</div>;
}
