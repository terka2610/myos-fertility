import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { savePatient } from "@/lib/twin/twin.functions";
import { PREFERENCES } from "@/lib/twin/rules";
import { LANGUAGES } from "@/lib/twin/languages";

const REASONS = [["egg_freezing", "Egg freezing"], ["ivf", "IVF"], ["diagnosis", "A diagnosis"], ["exploring", "Just exploring"]] as const;
const LEVELS = [["new", "New to this"], ["some", "Some experience"], ["cycle", "Done a cycle"]] as const;

function Choice({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-full border px-4 py-2 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary"}`}>{children}</button>;
}

export function PatientIntake({ onSaved, compact = false }: { onSaved: (id: string) => void; compact?: boolean }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ display_name: "", reason: "exploring" as (typeof REASONS)[number][0], diagnosis: "", medication: "", knowledge_level: "new" as (typeof LEVELS)[number][0], preferences: [] as string[], preferred_language: "", values_note: "", language: "English" });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const submit = async () => {
    if (!f.display_name.trim()) { toast.error("Give this made-up patient a name."); return; }
    setBusy(true);
    try { const { id } = await savePatient({ data: f }); await qc.invalidateQueries({ queryKey: ["twin"] }); onSaved(id); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className={compact ? "space-y-6" : "mx-auto max-w-2xl space-y-7"}>
      {!compact && <div><h1 className="text-5xl">Patient intake</h1><p className="mt-1 text-sm text-muted-foreground">Use a made-up patient. Answers are only sent to the AI when this patient asks a question.</p></div>}
      <label className="block space-y-2"><span className="font-medium">Patient name (made-up)</span><Input value={f.display_name} onChange={(e) => set("display_name", e.target.value)} placeholder="e.g. Maya" /></label>
      <label className="block space-y-2"><span className="font-medium">Language the twin should answer in</span>
        <select value={f.language} onChange={(e) => set("language", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3">{LANGUAGES.map((l) => <option key={l.name} value={l.name}>{l.native} — {l.name}</option>)}</select>
      </label>
      <div className="space-y-2"><p className="font-medium">What brings you here?</p><div className="flex flex-wrap gap-2">{REASONS.map(([v, l]) => <Choice key={v} on={f.reason === v} onClick={() => set("reason", v)}>{l}</Choice>)}</div></div>
      <label className="block space-y-2"><span className="font-medium">Any diagnosis you already have <span className="text-xs font-normal text-muted-foreground">(optional)</span></span><Input value={f.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} placeholder="e.g. PCOS" /></label>
      <label className="block space-y-2"><span className="font-medium">Prescription medication you take <span className="text-xs font-normal text-muted-foreground">(optional)</span></span><Input value={f.medication} onChange={(e) => set("medication", e.target.value)} placeholder="e.g. metformin" /></label>
      <div className="space-y-2"><p className="font-medium">How much do you already know?</p><div className="flex flex-wrap gap-2">{LEVELS.map(([v, l]) => <Choice key={v} on={f.knowledge_level === v} onClick={() => set("knowledge_level", v)}>{l}</Choice>)}</div></div>
      <div className="space-y-2"><p className="font-medium">What matters to you in a doctor? <span className="text-xs font-normal text-muted-foreground">(optional)</span></p>
        <div className="flex flex-wrap gap-2">{PREFERENCES.map((p) => <Choice key={p.id} on={f.preferences.includes(p.id)} onClick={() => set("preferences", f.preferences.includes(p.id) ? f.preferences.filter((x) => x !== p.id) : [...f.preferences, p.id])}>{p.label}</Choice>)}</div>
        {f.preferences.includes("language") && <Input value={f.preferred_language} onChange={(e) => set("preferred_language", e.target.value)} placeholder="Which language?" />}
      </div>
      <label className="block space-y-2"><span className="font-medium">Anything about your values or beliefs the doctor should respect <span className="text-xs font-normal text-muted-foreground">(optional — affects tone only)</span></span><Textarea value={f.values_note} onChange={(e) => set("values_note", e.target.value)} /></label>
      <Button onClick={submit} disabled={busy} className="rounded-full">{busy ? "Saving…" : "Save and find a doctor"}</Button>
    </div>
  );
}
