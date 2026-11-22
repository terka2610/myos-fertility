import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Mic, Send, Volume2, Play, CalendarPlus, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LANGUAGES, bcpFor } from "@/lib/twin/languages";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askTwin, speakAsTwin, sendToClinic } from "@/lib/twin/twin.functions";
import { TextTwinQr } from "@/components/twin/TextTwinQr";
import { LINQ_NUMBER } from "@/lib/linq/number";
import { TWIN_PHONE_TEL } from "@/lib/twin/intents";
import { TESSA_ID } from "@/lib/demo/demo.functions";
import { TalkingHead, playWithLevel, speakBrowser } from "@/components/twin/TalkingHead";
import tessaVideo from "@/assets/tessa-welcome-compatible.mp4.asset.json";

export const Route = createFileRoute("/_authenticated/twin/chat/$doctorId")({
  validateSearch: z.object({ patient: z.string().uuid().optional(), q: z.string().optional() }),
  head: () => ({ meta: [{ title: "Talk to the doctor twin — MYOS" }, { name: "description", content: "Ask a doctor's AI twin questions answered from their own protocols." }, { property: "og:title", content: "MYOS doctor twin conversation" }, { property: "og:description", content: "Answers from the doctor's own documents, with sources." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: TwinChat,
});

const SUGGESTIONS = ["How does IVF work?", "What happens on egg retrieval day?", "¿Cómo funciona la congelación de óvulos?", "I missed my dose, should I double it?"];

const TESSA_SUGGESTIONS = ["How long after the trigger shot is egg retrieval?", "What does my AMH level tell me?", "We're a queer couple. How much experience do you have with families like ours? And will my wife be treated as a co-parent, not just a visitor?", "¿Duele la extracción de óvulos?", "I missed my progesterone dose, should I double it?"];
const TESSA_VIDEO = { title: "Dr Tessa's welcome", url: tessaVideo.url };

type Msg = { role: "user" | "twin"; text: string; escalated?: boolean; uncovered?: boolean; kind?: string; question?: string; sent?: boolean; reason?: string | null; sources?: { doc_name: string; section: string; excerpt: string }[] };

function TwinChat() {
  const { doctorId } = Route.useParams(); const { patient, q: initialQuestion } = Route.useSearch();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["twin", "chat", doctorId, patient], queryFn: async () => {
    const [d, p] = await Promise.all([supabase.from("twin_doctors").select("*").eq("id", doctorId).single(), patient ? supabase.from("twin_patients").select("*").eq("id", patient).single() : Promise.resolve({ data: null })]);
    return { doctor: d.data, patient: p.data };
  } });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [listening, setListening] = useState(false);
  const level = useRef(0);
  const { user } = useAuth();
  const [lang, setLang] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [clip, setClip] = useState<{ title: string; url: string } | null>(doctorId === TESSA_ID ? TESSA_VIDEO : null);

  const doctor = q.data?.doctor, pat = q.data?.patient;
  const autoSent = useRef<string | null>(null);
  useEffect(() => {
    if (!doctor?.consent || !user || !initialQuestion?.trim() || busy) return;
    const key = `${doctorId}:${initialQuestion}`;
    if (autoSent.current === key) return;
    autoSent.current = key;
    void ask(initialQuestion);
  }, [doctor, user, initialQuestion, doctorId, busy]);
  if (!q.data) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!doctor) return <p>This twin isn't available.</p>;
  const language = lang ?? pat?.language ?? "English";
  const isOwner = doctor.owner_id === user?.id;
  if (!doctor.consent) return <p>This doctor has not consented to their twin being used.</p>;

  const say = async (t: string) => {
    try { const { audio } = await speakAsTwin({ data: { doctorId, text: t } }); if (audio) return await playWithLevel(audio, level); } catch { /* fall back */ }
    toast.info("Using your browser's voice. A consented ElevenLabs voice is not available.");
    await speakBrowser(t, level, doctor.is_female, bcpFor(language));
  };

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", text: question }]); setText(""); setBusy(true);
    try {
      const r = await askTwin({ data: { doctorId, patientId: patient ?? null, question, language } });
      setMsgs((m) => [...m, { role: "twin", text: r.answer, escalated: r.escalated, uncovered: r.uncovered, kind: r.kind, question, reason: r.reason, sources: r.sources }]);
      if (r.escalated) qc.invalidateQueries({ queryKey: ["twin", "reviews"] });
      say(r.answer);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const sendIt = async (i: number) => {
    const m = msgs[i]; if (!m?.question) return;
    try {
      await sendToClinic({ data: { doctorId, patientId: patient ?? null, patientName: pat?.display_name ?? "", question: m.question } });
      setMsgs((all) => all.map((x, j) => (j === i ? { ...x, sent: true } : x)));
      qc.invalidateQueries({ queryKey: ["twin", "reviews"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  const savedClips = (Array.isArray(doctor.videos) ? doctor.videos : []) as { title: string; url: string }[];
  const clips = doctor.id === TESSA_ID ? [TESSA_VIDEO, ...savedClips.filter((c) => c.url !== TESSA_VIDEO.url)] : savedClips;

  const dictate = () => {
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input isn't supported in this browser."); return; }
    const r = new SR(); r.lang = bcpFor(language); r.interimResults = false;
    r.onresult = (e) => { const t = e.results[0]?.[0]?.transcript; if (t) ask(t); }; r.onend = () => setListening(false);
    setListening(true); r.start();
  };

  return (
    <div className="grid gap-8 md:grid-cols-[320px_1fr]">
      <aside className="space-y-3">
        {clip ? <video key={clip.url} aria-label={clip.title} src={clip.url} poster={doctor.photos[0]} controls autoPlay muted playsInline className="aspect-[3/4] w-full rounded-[1.5rem] bg-card object-contain" onEnded={() => setClip(null)} />
          : <TalkingHead src={doctor.photos[0] ?? ""} mouthX={doctor.mouth_x} mouthY={doctor.mouth_y} levelRef={level} />}
        {clips.length > 0 && <div className="flex flex-wrap gap-2">{clips.map((c) => <Button key={c.url} size="sm" variant={clip?.url === c.url ? "default" : "secondary"} onClick={() => setClip(c)} className="rounded-full">{c.title}</Button>)}</div>}
        <p className="rounded-xl bg-primary-soft px-3 py-2 text-center text-xs font-medium text-secondary-foreground">AI twin of Dr {doctor.name}, not a live consultation</p>
        {doctor.status !== "published" && <p className="rounded-xl bg-gold-soft px-3 py-2 text-center text-xs">Preview — patients can't see this twin until it's approved.</p>}
        {doctor.id === TESSA_ID && <TextTwinQr number={LINQ_NUMBER} />}
        <div className="grid gap-2">
          <Button variant="secondary" className="rounded-full" onClick={() => clips[0] ? setClip(clips[0]) : say(`Hi, I'm the AI twin of Doctor ${doctor.name}${doctor.clinic ? ` at ${doctor.clinic}` : ""}. ${doctor.bio} Ask me anything about your treatment, any time. For anything about your own doses, results or symptoms, I'll pass you to the care team.`)}><Play className="h-4 w-4" />Watch introduction</Button>
          <BookDialog open={bookOpen} onOpenChange={setBookOpen} doctorId={doctor.id} doctorName={doctor.name} defaultName={pat?.display_name ?? ""} />
        </div>
        <label className="block text-sm"><span className="text-muted-foreground">Answer language</span>
          <select value={language} onChange={(e) => setLang(e.target.value)} className="mt-1 h-10 w-full rounded-full border border-input bg-card px-4">{LANGUAGES.map((l) => <option key={l.name} value={l.name}>{l.native}</option>)}</select>
        </label>
        <p className="text-sm text-muted-foreground">{pat ? <>Talking as <b className="text-foreground">{pat.display_name}</b> ({pat.knowledge_level === "new" ? "new to this" : pat.knowledge_level === "some" ? "some experience" : "done a cycle"}).</> : isOwner ? "Previewing your twin." : <>No patient profile. <Link to="/twin/patient" className="underline">Add one</Link> for personalised answers.</>}</p>
      </aside>
      <section className="flex min-h-[60vh] flex-col">
        <div className="sticky top-16 z-10 mb-4 rounded-xl border border-border bg-background px-4 py-2 text-sm font-medium md:hidden">AI twin of Dr {doctor.name}, not a live consultation</div>
        <div className="flex-1 space-y-4">
          {!msgs.length && <div>
            <p className="text-muted-foreground">Ask Dr {doctor.name}'s twin anything covered by the clinic's protocols. Try one of these:</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(doctor.id === TESSA_ID ? TESSA_SUGGESTIONS : SUGGESTIONS).map((s) => <Button key={s} variant="outline" onClick={() => ask(s)} disabled={busy} className="h-auto max-w-full whitespace-normal rounded-full px-4 py-2 text-left text-sm">{s}</Button>)}
            </div>
          </div>}
          {msgs.map((m, i) => m.role === "user"
            ? <div key={i} className="ml-auto max-w-[80%] rounded-2xl bg-primary px-4 py-2.5 text-primary-foreground">{m.text}</div>
            : <div key={i} className={`max-w-[90%] rounded-2xl border px-4 py-3 ${m.escalated ? "border-destructive/40 bg-destructive/10" : "border-border bg-card"}`}>
                <p className={m.escalated ? "font-semibold" : ""}>{m.text}</p>
                {m.escalated && <p className="mt-1 text-xs text-muted-foreground">Added to the nurse review list · {m.reason}</p>}
                {(m.kind === "booking" || m.kind === "not_covered") && <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" className="rounded-full" onClick={() => setBookOpen(true)}><CalendarPlus className="h-4 w-4" />Book a consultation</Button>
                  {m.kind === "booking" && doctor.id === TESSA_ID && <Button size="sm" variant="secondary" className="rounded-full" asChild><a href={`tel:${TWIN_PHONE_TEL}`}><Phone className="h-4 w-4" />Call my agent</a></Button>}
                </div>}
                {m.uncovered && m.question && (m.sent
                  ? <p className="mt-2 text-xs text-muted-foreground">Sent to the clinic. Someone from the team will get back to you.</p>
                  : <Button size="sm" variant="secondary" className="mt-3 rounded-full" onClick={() => sendIt(i)}>Send to the clinic</Button>)}
                {!!m.sources?.length && <ul className="mt-3 space-y-1 border-t border-border pt-2 text-xs text-muted-foreground">{m.sources.map((s, j) => <li key={j}><b className="text-foreground">{s.doc_name}</b> — {s.section}</li>)}</ul>}
                <button className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => say(m.text)}><Volume2 className="h-3 w-3" />Play again</button>
              </div>)}
          {busy && <p className="text-sm text-muted-foreground">Checking the protocols…</p>}
        </div>
        <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(text); }}>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Type your question" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(text); } }} />
          <div className="flex flex-col gap-2">
            <Button type="submit" size="icon" disabled={busy} aria-label="Send"><Send className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant={listening ? "destructive" : "outline"} onClick={dictate} aria-label="Speak your question"><Mic className="h-4 w-4" /></Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function BookDialog({ doctorId, doctorName, defaultName, open, onOpenChange: setOpen }: { doctorId: string; doctorName: string; defaultName: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const [f, setF] = useState({ patient_name: defaultName, contact: user?.email ?? "", preferred_time: "", note: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!f.patient_name.trim() || !f.contact.trim()) { toast.error("Please add your name and how to reach you."); return; }
    setBusy(true);
    const { error } = await supabase.from("twin_booking_requests").insert({ ...f, doctor_id: doctorId, owner_id: user!.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Request saved for Dr ${doctorName}'s clinic. They'll see it in their dashboard.`); setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="rounded-full"><CalendarPlus className="h-4 w-4" />Book a real consultation</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-display text-3xl">Book with Dr {doctorName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Your name" value={f.patient_name} onChange={(e) => setF({ ...f, patient_name: e.target.value })} />
          <Input placeholder="Email or phone" value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} />
          <Input placeholder="Preferred days or times" value={f.preferred_time} onChange={(e) => setF({ ...f, preferred_time: e.target.value })} />
          <Textarea placeholder="Anything the clinic should know (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          <Button onClick={submit} disabled={busy} className="w-full rounded-full">{busy ? "Sending…" : "Send request"}</Button>
          <p className="text-xs text-muted-foreground">This sends a request to the clinic's MYOS dashboard. It is not a confirmed appointment.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SpeechRecognitionLike { lang: string; interimResults: boolean; start(): void; onresult: (e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void; onend: () => void }
