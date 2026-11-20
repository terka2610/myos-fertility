import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { z } from "zod";
import { PatientIntake } from "@/components/twin/PatientIntake";
import { SpecialistsGrid } from "@/components/twin/SpecialistsGrid";

export const Route = createFileRoute("/_authenticated/twin/")({
  validateSearch: z.object({ patient: z.string().uuid().optional() }),
  head: () => ({ meta: [{ title: "Home — MYOS digital twins" }, { name: "description", content: "Meet a specialist's digital twin or create your own." }, { property: "og:title", content: "MYOS digital twins" }, { property: "og:description", content: "Your doctor, 24/7, in your language." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: TwinHub,
});

function TwinHub() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { patient } = Route.useSearch();
  const nav = Route.useNavigate();
  const pick = (id: string | undefined) => nav({ search: { patient: id } });
  const [intakeOpen, setIntakeOpen] = useState(false);
  const isAdmin = useQuery({ queryKey: ["twin", "isAdmin", user?.id], enabled: !!user, queryFn: async () => (await supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" })).data === true });
  const patients = useQuery({ queryKey: ["twin", "patients"], queryFn: async () => (await supabase.from("twin_patients").select("id,display_name,language").order("created_at", { ascending: false })).data ?? [] });
  const reviews = useQuery({ queryKey: ["twin", "reviews"], queryFn: async () => (await supabase.from("twin_nurse_reviews").select("id,question,reason,patient_name,created_at,twin_doctors(name)").order("created_at", { ascending: false }).limit(30)).data ?? [] });
  return (
    <div className="space-y-12">
      <h1 className="text-5xl">Welcome to <span className="serif-accent">MYOS</span></h1>
      <section className="space-y-5 rounded-[2rem] bg-pink p-6 md:p-8">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em]">STEP 1 · PATIENT INTAKE</p>
          <h2 className="mt-1 text-3xl">Who is asking?</h2>
          <p className="mt-1 text-sm text-foreground/80">Pick a made-up patient or fill in a short intake. It changes how the twin speaks and which doctors fit.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => pick(undefined)} className={`rounded-full px-4 py-2 text-sm ${!patient ? "bg-primary text-primary-foreground" : "bg-background/70"}`}>No profile</button>
          {patients.data?.map((p) => <button key={p.id} onClick={() => pick(p.id)} className={`rounded-full px-4 py-2 text-sm ${patient === p.id ? "bg-primary text-primary-foreground" : "bg-background/70"}`}>{p.display_name} · {p.language}</button>)}
          <Button variant="secondary" className="rounded-full" onClick={() => setIntakeOpen((o) => !o)}>{intakeOpen ? "Close intake" : "+ New intake"}</Button>
        </div>
        {intakeOpen && <div className="rounded-3xl bg-background p-6"><PatientIntake compact onSaved={(id) => { setIntakeOpen(false); pick(id); }} /></div>}
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">STEP 2 · CHOOSE A SPECIALIST</p>
          <h2 className="mt-1 text-4xl">Meet your <span className="serif-accent">fertility specialists</span></h2>
        </div>
        <SpecialistsGrid patient={patient} heading={false} />
      </section>

      <Link to="/twin/provider" className="group flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] bg-gold p-8">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em]">FOR PROVIDERS</p>
          <h2 className="mt-2 text-3xl">Create your digital twin</h2>
          <p className="mt-2 text-foreground/80">Headshot, voice and protocols. Reviewed before patients see it.</p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground"><ArrowRight className="h-5 w-5" /></span>
      </Link>
      {isAdmin.data && <Button asChild variant="outline" className="rounded-full"><Link to="/twin/admin">Admin review</Link></Button>}
      <section>
        <div className="flex items-center justify-between"><h2 className="text-3xl">Nurse review</h2><Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["twin", "reviews"] })}>Refresh</Button></div>
        <ul className="mt-4 divide-y divide-border rounded-3xl bg-card">
          {reviews.data?.map((r) => (
            <li key={r.id} className="p-5 text-sm">
              <p className="font-medium">"{r.question}"</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.reason} · {r.patient_name} → Dr {(r.twin_doctors as { name: string } | null)?.name} · {new Date(r.created_at).toLocaleString()}</p>
            </li>
          ))}
          {!reviews.data?.length && <li className="p-5 text-sm text-muted-foreground">Nothing waiting for the care team.</li>}
        </ul>
      </section>
    </div>
  );
}
