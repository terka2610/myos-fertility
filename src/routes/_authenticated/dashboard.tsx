import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessagesSquare, Mic, Video } from "lucide-react";
import { fertilityStateQuery } from "@/lib/fertility/queries";
import { RolePicker } from "@/components/myos/RolePicker";
import { TREATMENT_STAGES } from "@/lib/fertility/doctor";
import { Button } from "@/components/ui/button";
import doctor from "@/assets/companion-coat.jpg.asset.json";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Home — MYOS Fertility" }, { name: "description", content: "Your MYOS fertility home." }, { property: "og:title", content: "MYOS Home" }, { property: "og:description", content: "Your fertility companion." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery(fertilityStateQuery());
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data.membership) return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-card p-8 shadow-soft">
      <h1 className="text-3xl font-semibold">Welcome to IVF Care</h1>
      <p className="mt-2 text-muted-foreground">Tell us a little about you so the doctor can tailor answers.</p>
      <div className="mt-6"><RolePicker /></div>
    </div>
  );
  const stage = TREATMENT_STAGES.find((s) => s.id === data.membership!.treatment_stage)?.label;
  const count = data.messages.length;
  return (
    <div className="space-y-8">
      <section className="grid items-center gap-6 rounded-3xl bg-hero bg-card p-7 shadow-soft md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm text-primary">{data.membership.care_role === "partner" ? "Supporting partner" : "Patient"}{stage ? ` · ${stage}` : ""}</p>
          <h1 className="mt-1 text-3xl font-semibold">{count ? "Pick up where you left off" : "Ask your first question"}</h1>
          <p className="mt-2 text-muted-foreground">{count ? `${count} messages in your consultation.` : "Your consultation is ready."}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild className="rounded-full"><Link to="/consultation" search={{ mode: "text" }}><MessagesSquare className="mr-1.5 h-4 w-4" />Text</Link></Button>
            <Button asChild variant="outline" className="rounded-full"><Link to="/consultation" search={{ mode: "voice" }}><Mic className="mr-1.5 h-4 w-4" />Voice</Link></Button>
            <Button asChild variant="outline" className="rounded-full"><Link to="/consultation" search={{ mode: "avatar" }}><Video className="mr-1.5 h-4 w-4" />Video avatar</Link></Button>
          </div>
        </div>
        <img src={doctor.url} alt="" className="hidden h-40 w-32 rounded-2xl object-cover md:block" />
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold">Suggested for you</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.suggestions.map((q) => (
            <Link key={q} to="/consultation" search={{ mode: "text", q }} className="rounded-2xl border border-border bg-card p-4 text-sm hover:border-primary/50">{q}</Link>
          ))}
        </div>
      </section>
    </div>
  );
}
