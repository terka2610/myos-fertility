import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Quote, Camera, Mic, FileText, Eye } from "lucide-react";
import tessa from "@/assets/dr-tessa-coat.jpg.asset.json";
import elena from "@/assets/dr-elena-coat.jpg.asset.json";
import priya from "@/assets/dr-aisha-coat.jpg.asset.json";
import samuel from "@/assets/dr-marcus-coat.jpg.asset.json";

export const Route = createFileRoute("/_authenticated/twin/provider")({
  head: () => ({ meta: [{ title: "My digital twin — MYOS" }, { name: "description", content: "Manage your digital twin, files, review status and patient requests." }, { property: "og:title", content: "MYOS provider workspace" }, { property: "og:description", content: "Create and manage your doctor digital twin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Provider,
});

const STATUS_LABEL: Record<string, string> = { draft: "Draft", review: "Awaiting review", published: "Published" };

function Provider() {
  const { user } = useAuth(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ["twin", "provider", user?.id], enabled: !!user, queryFn: async () => {
    const { data: twins } = await supabase.from("twin_doctors").select("*, twin_documents(id,name,status,storage_path)").eq("owner_id", user!.id).order("created_at", { ascending: false });
    const { data: files } = await supabase.storage.from("twin-media").list(user!.id, { limit: 100 });
    const media: Record<string, { name: string; url: string }[]> = {};
    for (const folder of files ?? []) {
      const { data: inner } = await supabase.storage.from("twin-media").list(`${user!.id}/${folder.name}`);
      const paths = (inner ?? []).map((f) => `${user!.id}/${folder.name}/${f.name}`);
      if (!paths.length) continue;
      const { data: signed } = await supabase.storage.from("twin-media").createSignedUrls(paths, 3600);
      for (const s of signed ?? []) (media[s.path!.split("/")[1]!] ??= []).push({ name: s.path!.split("/").pop()!, url: s.signedUrl ?? "" });
    }
    const { data: bookings } = await supabase.from("twin_booking_requests").select("*").order("created_at", { ascending: false });
    return { twins: twins ?? [], media, bookings: (bookings ?? []).filter((b) => twins?.some((t) => t.id === b.doctor_id)) };
  } });
  const submit = async (id: string) => {
    const { error } = await supabase.from("twin_doctors").update({ status: "review" }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Sent for review."); qc.invalidateQueries({ queryKey: ["twin"] }); }
  };
  const mediaFor = (docPaths: (string | null)[]) => {
    const folder = docPaths.find(Boolean)?.split("/")[1];
    return folder ? q.data?.media[folder] ?? [] : [];
  };
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-5xl">My <span className="serif-accent">digital twin</span></h1>
        <Button asChild className="rounded-full"><Link to="/twin/doctor">Create a new twin</Link></Button>
      </div>
      {q.data && !q.data.twins.length && <EmptyState />}
      {q.data?.twins.map((t) => {
        const files = mediaFor(t.twin_documents.map((d) => d.storage_path));
        return (
          <section key={t.id} className="rounded-[1.75rem] bg-card p-6 md:p-8">
            <div className="flex flex-wrap items-start gap-6">
              <img src={t.photos[0]} alt="" className="h-36 w-32 rounded-2xl object-cover" />
              <div className="flex-1">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${t.status === "published" ? "bg-pink" : "bg-gold-soft"}`}>{STATUS_LABEL[t.status]}</span>
                <h2 className="mt-2 text-3xl">Dr {t.name}</h2>
                <p className="text-sm text-muted-foreground">{t.specialty} · {t.clinic}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild variant="secondary" className="rounded-full"><Link to="/twin/chat/$doctorId" params={{ doctorId: t.id }} search={{ patient: undefined }}>Preview your twin</Link></Button>
                  {t.status === "draft" && <Button className="rounded-full" onClick={() => submit(t.id)}>Submit for review</Button>}
                </div>
              </div>
            </div>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-xl">Knowledge library</h3>
                <ul className="mt-2 divide-y divide-border text-sm">{t.twin_documents.map((d) => <li key={d.id} className="flex justify-between py-2"><span>{d.name}</span><span className="text-muted-foreground">{d.status === "approved" ? "Approved" : "Awaiting approval"} · {t.clinic}</span></li>)}</ul>
              </div>
              <div>
                <h3 className="text-xl">Saved files</h3>
                <ul className="mt-2 space-y-2 text-sm">
                  {files.map((f) => <li key={f.name}>{/\.(webm|mp3|wav|m4a|ogg|mp4)$/i.test(f.name) ? <><p>{f.name}</p><audio controls src={f.url} className="w-full" /></> : /\.(jpe?g|png|webp|heic)$/i.test(f.name) ? <a href={f.url} target="_blank" rel="noreferrer" className="underline">{f.name}</a> : <a href={f.url} target="_blank" rel="noreferrer" className="underline">{f.name}</a>}</li>)}
                  {!files.length && <li className="text-muted-foreground">No original files saved for this twin.</li>}
                </ul>
              </div>
            </div>
          </section>
        );
      })}
      {!!q.data?.bookings.length && <section>
        <h2 className="text-3xl">Consultation requests</h2>
        <ul className="mt-3 divide-y divide-border rounded-3xl bg-card">{q.data.bookings.map((b) => <li key={b.id} className="p-5 text-sm"><b>{b.patient_name}</b> · {b.contact} · {b.preferred_time}<p className="text-muted-foreground">{b.note}</p></li>)}</ul>
      </section>}
    </div>
  );
}

const SETUP = [
  { icon: Camera, t: "Add your face", d: "Upload a headshot or two." },
  { icon: Mic, t: "Record your voice", d: "A short sample, from home." },
  { icon: FileText, t: "Teach your protocols", d: "Upload your clinic's documents." },
  { icon: Eye, t: "Preview and submit", d: "Nothing goes live until it's reviewed." },
];

const QUOTES = [
  { img: elena.url, name: "Dr Elena Marsh", role: "Fertility preservation", text: "My patients used to wait until Monday to ask about their egg-freezing injections. Now they get my answer at 11pm, in Spanish, from my own protocol." },
  { img: priya.url, name: "Dr Aisha Khan", role: "PCOS & IVF", text: "It answers the questions I repeat ten times a day, so my consults are about decisions, not logistics. Anything about doses still comes straight to my nurses." },
  { img: samuel.url, name: "Dr Marcus Ellison", role: "IVF & endometriosis", text: "Set-up took me an evening. Seeing my twin explain retrieval day in French to a nervous patient convinced me." },
];

function EmptyState() {
  return (
    <div className="space-y-10">
      <section className="grid items-center gap-8 overflow-hidden rounded-[2rem] bg-pink p-6 md:grid-cols-[280px_1fr] md:p-10">
        <div className="relative">
          <img src={tessa.url} alt="Example twin: Dr Tessa Juras" className="aspect-[4/5] w-full rounded-[1.5rem] object-cover shadow-lg" />
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium">Example demo twin</span>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.12em]">YOU HAVEN'T CREATED A TWIN YET</p>
          <h2 className="mt-3 text-4xl md:text-5xl">Be there for your patients, <span className="italic">24/7, in their language</span></h2>
          <p className="mt-4 max-w-lg text-foreground/80">Your twin answers from your own protocols, in your face and voice, and hands anything clinical to your care team.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="rounded-full"><Link to="/twin/doctor">Create my twin</Link></Button>
            <Button asChild variant="secondary" className="rounded-full"><Link to="/twin/chat/$doctorId" params={{ doctorId: "d0c70000-0000-4000-8000-000000000004" }} search={{ patient: undefined }}>See an example</Link></Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SETUP.map(({ icon: Icon, t, d }, i) => (
          <div key={t} className="rounded-3xl bg-card p-6">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-soft"><Icon className="h-5 w-5" /></span>
            <p className="mt-4 text-xs text-muted-foreground">Step {i + 1}</p>
            <h3 className="text-xl">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-4xl">What doctors <span className="serif-accent">are saying</span></h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {QUOTES.map((q) => (
            <figure key={q.name} className="flex flex-col rounded-[1.75rem] bg-card p-7">
              <Quote className="h-6 w-6 text-primary" />
              <blockquote className="mt-4 flex-1 font-display text-xl leading-snug">"{q.text}"</blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <img src={q.img} alt="" loading="lazy" className="h-12 w-12 rounded-full object-cover" />
                <div><p className="text-sm font-medium">{q.name}</p><p className="text-xs text-muted-foreground">{q.role}</p></div>
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Illustrative quotes from fictional demo doctors.</p>
      </section>
    </div>
  );
}
