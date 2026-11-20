import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TREATMENT_STAGES } from "@/lib/fertility/doctor";
import { joinProgram } from "@/lib/fertility/consultation.functions";

export function RolePicker({ initialRole, initialStage, onDone, cta = "Join IVF Care" }: { initialRole?: string; initialStage?: string | null; onDone?: () => void; cta?: string }) {
  const qc = useQueryClient();
  const [role, setRole] = useState<"patient" | "partner">(initialRole === "partner" ? "partner" : "patient");
  const [stage, setStage] = useState<string | null>(initialStage ?? null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await joinProgram({ data: { program: "ivf-care", care_role: role, treatment_stage: stage } }); await qc.invalidateQueries({ queryKey: ["fertility"] }); onDone?.(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium">I am…</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {([["patient", "Going through treatment", "IVF or egg freezing myself"], ["partner", "Supporting someone", "A partner or caregiver"]] as const).map(([id, t, d]) => (
            <button key={id} type="button" onClick={() => setRole(id)} className={`rounded-2xl border p-4 text-left transition ${role === id ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-primary/40"}`}>
              <div className="font-medium">{t}</div><div className="text-sm text-muted-foreground">{d}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Where are you now? <span className="font-normal text-muted-foreground">(optional)</span></p>
        <div className="flex flex-wrap gap-2">
          {TREATMENT_STAGES.map((s) => (
            <button key={s.id} type="button" onClick={() => setStage(stage === s.id ? null : s.id)} className={`rounded-full border px-3 py-1.5 text-sm ${stage === s.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}>{s.label}</button>
          ))}
        </div>
      </div>
      <Button onClick={save} disabled={busy} className="rounded-full">{busy ? "Saving…" : cta}</Button>
    </div>
  );
}
