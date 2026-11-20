import { createFileRoute, Link } from "@tanstack/react-router";
import { DOCTOR } from "@/lib/fertility/doctor";
import { Button } from "@/components/ui/button";
import doctor from "@/assets/companion-coat.jpg.asset.json";

export const Route = createFileRoute("/_authenticated/doctor")({
  head: () => ({ meta: [{ title: "The Doctor — MYOS Fertility" }, { name: "description", content: "About MYOS General Fertility Doctor." }, { property: "og:title", content: "General Fertility Doctor" }, { property: "og:description", content: DOCTOR.tagline }] }),
  component: () => (
    <div className="grid gap-8 md:grid-cols-[300px_1fr]">
      <img src={doctor.url} alt="" className="w-full rounded-3xl object-cover shadow-soft" />
      <div>
        <p className="text-sm text-primary">{DOCTOR.category}</p>
        <h1 className="mt-1 text-4xl font-semibold">{DOCTOR.display_name}</h1>
        <p className="mt-1 text-muted-foreground">{DOCTOR.title}</p>
        <p className="mt-5">{DOCTOR.tagline}</p>
        <p className="mt-3 text-sm text-muted-foreground"><b className="text-foreground">Covers:</b> {DOCTOR.specialization}.</p>
        <p className="mt-5 rounded-2xl bg-primary-soft p-4 text-sm text-secondary-foreground">{DOCTOR.disclosure}</p>
        <Button asChild className="mt-6 rounded-full"><Link to="/consultation" search={{ mode: "text" }}>Start talking</Link></Button>
      </div>
    </div>
  ),
});
