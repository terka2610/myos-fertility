import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { matchesDoctor } from "@/lib/twin/rules";
import { TESSA_ID } from "@/lib/demo/demo.functions";

const yn = (b: boolean) => (b ? "Yes" : "No");

export function SpecialistsGrid({ patient, heading = true }: { patient?: string | undefined; heading?: boolean }) {
  const q = useQuery({ queryKey: ["twin", "specialists", patient], queryFn: async () => {
    const [d, p] = await Promise.all([
      supabase.from("twin_doctors").select("*").eq("status", "published").eq("consent", true).order("is_demo"),
      patient ? supabase.from("twin_patients").select("*").eq("id", patient).single() : Promise.resolve({ data: null }),
    ]);
    return { doctors: d.data ?? [], patient: p.data };
  } });
  if (!q.data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const { doctors, patient: pat } = q.data;
  const picked = pat ? doctors.filter((d) => matchesDoctor(d, pat.preferences, pat.preferred_language)) : doctors;
  const list = [...picked].sort((a, b) => (b.id === TESSA_ID ? 1 : 0) - (a.id === TESSA_ID ? 1 : 0));
  return (
    <div className="space-y-8">
      <div>
        {heading && <h1 className="text-5xl">Meet your <span className="serif-accent">fertility specialists</span></h1>}
        <p className="mt-3 text-muted-foreground">{pat ? `${list.length} of ${doctors.length} doctors fit what ${pat.display_name} selected.` : "Pick a doctor to meet their digital twin."}</p>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {list.map((d) => (
          <article key={d.id} className="overflow-hidden rounded-[1.75rem] bg-card">
            <div className="relative aspect-[4/4] bg-secondary">
              <img src={d.photos[0]} alt={`Dr ${d.name}`} loading="lazy" className="h-full w-full object-cover" />
              {d.is_demo && <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium">Demo profile</span>}
            </div>
            <div className="p-6">
              <h2 className="text-3xl">Dr {d.name}</h2>
              <p className="text-sm text-muted-foreground">{d.specialty} · {d.clinic}</p>
              {d.bio && <p className="mt-3 text-sm">{d.bio}</p>}
              <p className="mt-3 text-xs text-muted-foreground">Speaks {d.languages}. Twin answers in any language.</p>
              <p className="mt-3 text-xs font-medium">Patient expertise:</p>
              <ul className="mt-1 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <li>PCOS: {yn(d.treats_pcos)}</li><li>Endometriosis: {yn(d.treats_endo)}</li>
                <li>Queer/trans: {yn(d.supports_queer_trans)}</li><li>Single women: {yn(d.supports_single_women)}</li>
              </ul>
              <Button asChild className="mt-5 w-full rounded-full"><Link to="/twin/chat/$doctorId" params={{ doctorId: d.id }} search={{ patient }}>Meet their digital twin</Link></Button>
            </div>
          </article>
        ))}
        {!list.length && <p className="text-sm text-muted-foreground">No doctor matches every preference yet.</p>}
      </div>
    </div>
  );
}
