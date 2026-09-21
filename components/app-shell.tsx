"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BriefcaseBusiness, Building2, Menu, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/new", label: "New analysis", icon: Plus }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <>
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-white"><BriefcaseBusiness size={19} /></div>
        <div><p className="text-sm font-bold tracking-wide text-white">PITCH COPILOT</p><p className="text-[10px] uppercase tracking-[.18em] text-slate-400">Investment workspace</p></div>
      </div>
      <nav className="space-y-1 p-4">
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Workspace</p>
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white")}><item.icon size={17} />{item.label}</Link>;
        })}
      </nav>
      <div className="mt-auto border-t border-white/10 p-5">
        <div className="rounded-md bg-white/5 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300"><Building2 size={14} />Student workspace</div><p className="text-[11px] leading-4 text-slate-500">Build clear, evidence-led investment pitches.</p></div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f4f7fa]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-navy-950 lg:flex">{sidebar}</aside>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Close navigation" className="absolute inset-0 bg-navy-950/60" onClick={() => setOpen(false)} /><aside className="relative flex h-full w-72 flex-col bg-navy-950">{sidebar}</aside></div>}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}><Menu size={20} /></Button><div className="hidden h-2 w-2 rounded-full bg-emerald-500 sm:block" /><p className="text-xs font-medium text-slate-500">Market workspace <span className="mx-2 text-slate-300">/</span> <span className="text-ink">Equity research</span></p></div>
          <Button asChild size="sm" variant="accent"><Link href="/new"><Plus size={15} />New analysis</Link></Button>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
