import { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({ label, value, detail, icon, accent }: { label: string; value: string; detail?: string; icon?: ReactNode; accent?: boolean }) {
  return (
    <Card className={cn("relative overflow-hidden p-5", accent && "border-navy-800 bg-navy-900 text-white")}>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-[11px] font-bold uppercase tracking-[.13em] text-slate-500", accent && "text-slate-400")}>{label}</p>
        {icon && <span className={cn("text-slate-400", accent && "text-blue-300")}>{icon}</span>}
      </div>
      <p className={cn("financial-number mt-3 text-2xl font-bold tracking-tight text-navy-950", accent && "text-white")}>{value}</p>
      {detail && <p className={cn("mt-1.5 text-xs text-slate-500", accent && "text-slate-400")}>{detail}</p>}
      {accent && <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-blue-500/10" />}
    </Card>
  );
}
