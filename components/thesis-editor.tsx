"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Lightbulb, Plus, Save, ShieldAlert, Sparkles, Target, Trash2 } from "lucide-react";
import { useAnalyses } from "@/components/providers/analysis-provider";
import { AnalysisTabs } from "@/components/analysis-tabs";
import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, formatPercent } from "@/lib/format";
import { Thesis } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ThesisPageView() {
  const params = useParams<{ id: string }>();
  const { getAnalysis, hydrated } = useAnalyses();
  const analysis = getAnalysis(params.id);
  if (!hydrated && !analysis) return <div className="h-64 animate-pulse rounded-lg bg-slate-200" />;
  if (!analysis) return <Card className="p-10 text-center"><h1 className="font-bold">Analysis not found</h1><Button asChild className="mt-4"><Link href="/">Return to dashboard</Link></Button></Card>;
  return <ThesisForm key={`${analysis.id}-${analysis.updatedAt}`} analysis={analysis} />;
}

function ThesisForm({ analysis }: { analysis: NonNullable<ReturnType<ReturnType<typeof useAnalyses>["getAnalysis"]>> }) {
  const router = useRouter();
  const { saveAnalysis } = useAnalyses();
  const [thesis, setThesis] = useState<Thesis>(analysis.thesis);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const upside = analysis.currentSharePrice && thesis.targetPrice ? thesis.targetPrice / analysis.currentSharePrice - 1 : null;

  function setList(kind: "catalysts" | "risks", index: number, value: string) { setThesis((current) => ({ ...current, [kind]: current[kind].map((item, i) => i === index ? value : item) })); setSaved(false); }
  function addList(kind: "catalysts" | "risks") { if (thesis[kind].length < 6) setThesis((current) => ({ ...current, [kind]: [...current[kind], ""] })); }
  function removeList(kind: "catalysts" | "risks", index: number) { setThesis((current) => ({ ...current, [kind]: current[kind].filter((_, i) => i !== index) })); }
  function save() {
    if (!Number.isFinite(thesis.targetPrice) || thesis.targetPrice < 0) {
      setError("Enter a valid, non-negative target price.");
      return false;
    }
    saveAnalysis({ ...analysis, thesis: { ...thesis, catalysts: thesis.catalysts.filter(Boolean), risks: thesis.risks.filter(Boolean) }, updatedAt: new Date().toISOString() });
    setError("");
    setSaved(true);
    return true;
  }

  return (
    <>
      <PageHeading eyebrow={`${analysis.ticker} · Investment case`} title="Build the investment thesis" description="Turn your financial analysis into a concise, evidence-led recommendation." actions={<><Button asChild variant="outline"><Link href={`/analysis/${analysis.id}`}><ArrowLeft size={15} />Analysis</Link></Button><Button variant="accent" onClick={save}>{saved ? <Check size={16} /> : <Save size={16} />}{saved ? "Saved" : "Save thesis"}</Button></>} />
      <AnalysisTabs id={analysis.id} />
      {error && <div role="alert" className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card><CardHeader className="border-b"><CardTitle className="flex items-center gap-2"><Lightbulb size={17} className="text-amber-500" />Core investment thesis</CardTitle><p className="text-sm text-slate-500">Summarise why the market is mispricing this company in two to four sentences.</p></CardHeader><CardContent className="pt-5"><Label htmlFor="summary">Thesis summary</Label><Textarea id="summary" rows={6} maxLength={1000} placeholder="Explain the core opportunity, the variant view and why it matters now..." value={thesis.summary} onChange={(e) => { setThesis({ ...thesis, summary: e.target.value }); setSaved(false); }} /><p className="mt-2 text-right text-[11px] text-slate-400">{thesis.summary.length} / 1,000</p></CardContent></Card>
          <ThesisList title="Catalysts" description="What events could cause the market to recognise your thesis?" kind="catalysts" values={thesis.catalysts} icon={<Sparkles size={17} className="text-emerald-600" />} onChange={setList} onAdd={addList} onRemove={removeList} />
          <ThesisList title="Key risks" description="What could invalidate your thesis or impair the valuation?" kind="risks" values={thesis.risks} icon={<ShieldAlert size={17} className="text-red-500" />} onChange={setList} onAdd={addList} onRemove={removeList} />
        </div>
        <div className="space-y-5">
          <Card className="xl:sticky xl:top-24"><CardHeader className="border-b bg-navy-950 text-white"><CardTitle className="flex items-center gap-2 text-white"><Target size={17} className="text-blue-300" />Recommendation</CardTitle><p className="text-xs text-slate-400">Set your rating and valuation target.</p></CardHeader><CardContent className="space-y-5 pt-5">
            <div><Label>Rating</Label><div className="grid grid-cols-3 gap-2">{(["Buy", "Hold", "Sell"] as const).map((rating) => <button key={rating} type="button" onClick={() => { setThesis({ ...thesis, recommendation: rating }); setSaved(false); }} className={cn("rounded-md border px-3 py-2 text-xs font-bold transition-colors", thesis.recommendation === rating ? rating === "Buy" ? "border-emerald-500 bg-emerald-50 text-emerald-700" : rating === "Sell" ? "border-red-400 bg-red-50 text-red-700" : "border-amber-400 bg-amber-50 text-amber-700" : "text-slate-500 hover:bg-slate-50")}>{rating}</button>)}</div></div>
             <div><Label htmlFor="targetPrice">Target price ({analysis.currency})</Label><Input id="targetPrice" type="number" min="0" step="any" value={thesis.targetPrice} onChange={(e) => { setThesis({ ...thesis, targetPrice: Number(e.target.value) }); setError(""); setSaved(false); }} /></div>
            <div className="rounded-md bg-slate-50 p-4"><div className="flex justify-between text-xs text-slate-500"><span>Current price</span><span className="financial-number font-semibold text-ink">{formatMoney(analysis.currentSharePrice, analysis.currency, false)}</span></div><div className="mt-3 flex justify-between text-xs text-slate-500"><span>Price target</span><span className="financial-number font-semibold text-ink">{formatMoney(thesis.targetPrice, analysis.currency, false)}</span></div><div className="mt-3 border-t pt-3"><div className="flex justify-between text-sm font-semibold"><span>Implied upside</span><span className={upside !== null && upside >= 0 ? "text-emerald-600" : "text-red-600"}>{formatPercent(upside)}</span></div></div></div>
            <p className="text-[11px] leading-5 text-slate-400">Your target price should be supported by a consistent valuation methodology and explicit assumptions.</p>
             <Button className="w-full" variant="accent" onClick={() => { if (save()) router.push(`/analysis/${analysis.id}`); }}>Save & view analysis</Button>
          </CardContent></Card>
        </div>
      </div>
    </>
  );
}

function ThesisList({ title, description, kind, values, icon, onChange, onAdd, onRemove }: { title: string; description: string; kind: "catalysts" | "risks"; values: string[]; icon: React.ReactNode; onChange: (kind: "catalysts" | "risks", index: number, value: string) => void; onAdd: (kind: "catalysts" | "risks") => void; onRemove: (kind: "catalysts" | "risks", index: number) => void }) {
  return <Card><CardHeader className="border-b"><CardTitle className="flex items-center gap-2">{icon}{title}</CardTitle><p className="text-sm text-slate-500">{description}</p></CardHeader><CardContent className="space-y-3 pt-5">{values.map((value, index) => <div key={index} className="flex items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">{index + 1}</span><Input aria-label={`${title} item ${index + 1}`} placeholder={kind === "catalysts" ? "e.g. Margin expansion exceeds expectations" : "e.g. Competitive pricing pressure"} value={value} onChange={(e) => onChange(kind, index, e.target.value)} /><Button aria-label={`Remove ${title.toLowerCase()} item ${index + 1}`} variant="ghost" size="icon" onClick={() => onRemove(kind, index)}><Trash2 size={15} /></Button></div>)}<Button variant="outline" size="sm" disabled={values.length >= 6} onClick={() => onAdd(kind)}><Plus size={15} />Add {kind === "catalysts" ? "catalyst" : "risk"}</Button></CardContent></Card>;
}
