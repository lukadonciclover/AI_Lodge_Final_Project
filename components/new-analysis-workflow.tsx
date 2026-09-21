"use client";

import { useState } from "react";
import { ArrowLeft, Building2, Download, Keyboard } from "lucide-react";
import { AnalysisForm } from "@/components/analysis-form";
import { CompanyImportFlow } from "@/components/company-import-flow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function NewAnalysisWorkflow() {
  const [mode, setMode] = useState<"import" | "manual" | null>(null);
  if (mode === "import") return <CompanyImportFlow onCancel={() => setMode(null)} />;
  if (mode === "manual") return <><Button variant="ghost" className="mb-5" onClick={() => setMode(null)}><ArrowLeft size={16} />Choose another method</Button><AnalysisForm /></>;

  return (
    <div className="grid max-w-4xl gap-5 md:grid-cols-2">
      <Card className="group p-6 transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-card">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-accent"><Download size={20} /></div>
        <h2 className="text-lg font-bold text-navy-950">Import company financials</h2>
        <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">Search listed companies and review five years of annual statements before saving.</p>
        <Button className="mt-6 w-full" variant="accent" onClick={() => setMode("import")}><Building2 size={16} />Search companies</Button>
      </Card>
      <Card className="group p-6 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-card">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-slate-600"><Keyboard size={20} /></div>
        <h2 className="text-lg font-bold text-navy-950">Enter financials manually</h2>
        <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">Use the existing guided workflow to enter company details and historical results.</p>
        <Button className="mt-6 w-full" variant="outline" onClick={() => setMode("manual")}>Start manual entry</Button>
      </Card>
    </div>
  );
}
