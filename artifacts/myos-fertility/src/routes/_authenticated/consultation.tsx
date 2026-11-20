import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { MessagesSquare, Mic, MicOff, Send, Video, Volume2, Snowflake, HeartPulse, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { fertilityStateQuery } from "@/lib/fertility/queries";
import { joinProgram, sendMessage, simulateEscalation } from "@/lib/fertility/consultation.functions";
import { speak } from "@/lib/fertility/tts.functions";
import { MessageBubble, type Msg } from "@/components/myos/MessageBubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import doctor from "@/assets/companion-coat.jpg.asset.json";

type Mode = "text" | "voice" | "avatar";
type Program = "ivf-care" | "egg-freezing";
const PROGRAMS: { id: Program; label: string; blurb: string; icon: typeof Snowflake; placeholder: string }[] = [
  { id: "egg-freezing", label: "Social egg freezing", blurb: "Planning ahead: tests, timing, costs and the process.", icon: Snowflake, placeholder: "Ask about egg freezing, tests, costs…" },
  { id: "ivf-care", label: "IVF", blurb: "Going through treatment: injections, retrieval, transfer.", icon: HeartPulse, placeholder: "Ask about IVF, injections, retrieval…" },
];
export const Route = createFileRoute("/_authenticated/consultation")({
  validateSearch: (s: Record<string, unknown>): { mode: Mode | undefined; program?: Program; q?: string } => ({
    ...(s["program"] === "egg-freezing" || s["program"] === "ivf-care" ? { program: s["program"] } : {}),
    mode: s["mode"] === "voice" || s["mode"] === "avatar" || s["mode"] === "text" ? s["mode"] : undefined,
    ...(typeof s["q"] === "string" ? { q: s["q"] } : {}),
  }),
  head: () => ({ meta: [{ title: "Consultation — MYOS Fertility" }, { name: "description", content: "Talk with MYOS General Fertility Doctor." }, { property: "og:title", content: "MYOS Consultation" }, { property: "og:description", content: "Text, voice or video avatar." }] }),
  component: Consultation,
});

function useDictation(onFinal: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const ref = useRef<any>(null);
  const supported = typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const start = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Voice input is not supported in this browser."); return; }
    const r = new SR(); r.lang = "en-US"; r.interimResults = false;
    r.onresult = (e: any) => onFinal(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    ref.current = r; r.start(); setListening(true);
  };
  const stop = () => { ref.current?.stop(); setListening(false); };
  return { listening, start, stop, supported };
}

function Consultation() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const navigate = Route.useNavigate();
  const program: Program = search.program ?? "ivf-care";
  const prog = PROGRAMS.find((p) => p.id === program)!;
  const { data } = useQuery(fertilityStateQuery(program));
  const [joining, setJoining] = useState(false);
  const [mode, setMode] = useState<Mode>(search.mode ?? "text");
  const [input, setInput] = useState(search.q ?? "");
  const [pending, setPending] = useState<Msg | null>(null);
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [data?.messages.length, pending]);
  useEffect(() => () => { audioRef.current?.pause(); window.speechSynthesis?.cancel(); }, []);
  useEffect(() => { audioRef.current?.pause(); window.speechSynthesis?.cancel(); setSpeaking(false); }, [mode]);

  const say = async (text: string) => {
    setSpeaking(true);
    try {
      const { audio } = await speak({ data: { text: text.slice(0, 2500) } });
      if (audio) {
        const a = new Audio(`data:audio/mpeg;base64,${audio}`); audioRef.current = a;
        a.onended = () => setSpeaking(false); await a.play(); return;
      }
    } catch { /* fall through to browser voice */ }
    const u = new SpeechSynthesisUtterance(text.replace(/\[\d+\]/g, ""));
    u.onend = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };

  const send = async (text: string) => {
    const t = text.trim(); if (!t || busy) return;
    setInput(""); setBusy(true); setPending({ sender: "user", content: t });
    try {
      const r = await sendMessage({ data: { program, content: t, mode } });
      await qc.invalidateQueries({ queryKey: ["fertility"] });
      if (mode !== "text") say(r.reply);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); setInput(t); }
    finally { setPending(null); setBusy(false); }
  };
  const dict = useDictation((t) => send(t));

  const escalate = async (m: Msg) => {
    try {
      await simulateEscalation({ data: { program, category: m.safety?.category ?? "unspecified", summary: m.content.slice(0, 500) } });
      await qc.invalidateQueries({ queryKey: ["fertility"] });
      toast.success("Simulated: added to the demo care-team queue.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  const join = async (care_role: "patient" | "partner") => {
    setJoining(true);
    try { await joinProgram({ data: { program, care_role } }); await qc.invalidateQueries({ queryKey: ["fertility"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't start"); } finally { setJoining(false); }
  };

  const tabs = (
    <div className="grid gap-3 sm:grid-cols-2">
      {PROGRAMS.map((p) => (
        <button key={p.id} onClick={() => navigate({ search: (s) => ({ ...s, program: p.id }) })}
          className={`flex items-start gap-3 rounded-3xl p-4 text-left transition ${p.id === program ? "bg-primary text-primary-foreground shadow-soft" : "bg-card hover:bg-secondary"}`}>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${p.id === program ? "bg-primary-foreground/15" : "bg-pink"}`}><p.icon className="h-5 w-5" /></span>
          <span><span className="block font-medium">{p.label}</span><span className={`text-sm ${p.id === program ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{p.blurb}</span></span>
        </button>
      ))}
    </div>
  );
  const header = (
    <div className="space-y-5">
      <div>
        <h1 className="text-4xl md:text-5xl">Ask your <span className="serif-accent">fertility companion</span></h1>
        <p className="mt-2 text-muted-foreground">Pick what you're going through. Answers are for learning; your clinic makes the medical decisions.</p>
      </div>
      {tabs}
    </div>
  );

  if (!data) return <div className="space-y-6">{header}<p className="text-sm text-muted-foreground">Loading…</p></div>;
  if (!data.membership) return (
    <div className="space-y-6">{header}
      <div className="rounded-[2rem] bg-pink p-8 text-center">
        <h2 className="text-3xl">Start your {prog.label.toLowerCase()} conversation</h2>
        <p className="mt-2 text-foreground/80">Who are you here as?</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button className="rounded-full" disabled={joining} onClick={() => join("patient")}>I'm the patient</Button>
          <Button variant="secondary" className="rounded-full" disabled={joining} onClick={() => join("partner")}>I'm supporting someone</Button>
        </div>
      </div>
    </div>
  );
  const msgs: Msg[] = [{ sender: "assistant", content: data.opening }, ...data.messages, ...(pending ? [pending] : [])];

  return (
    <div className="space-y-6">{header}
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="space-y-4">
        <div className="overflow-hidden rounded-3xl bg-card shadow-soft">
          <div className="relative">
            <img src={doctor.url} alt="General Fertility Doctor avatar" className={`aspect-[4/5] w-full object-cover transition ${mode === "avatar" && speaking ? "scale-[1.02]" : ""}`} />
            <span className="absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-medium">AI — not a real doctor</span>
            {speaking && <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] text-primary-foreground"><Volume2 className="h-3 w-3" />Speaking</span>}
          </div>
          <div className="p-4">
            <p className="font-display text-lg font-semibold">MYOS fertility companion</p>
            <p className="text-xs text-muted-foreground">AI Fertility Companion</p>
          </div>
        </div>
        <div className="flex rounded-full bg-secondary p-1 text-sm">
          {([["text", MessagesSquare, "Type"], ["voice", Mic, "Talk"], ["avatar", Video, "Video"]] as const).map(([id, Icon, l]) => (
            <button key={id} onClick={() => setMode(id)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 ${mode === id ? "bg-card shadow-soft" : "text-muted-foreground"}`}><Icon className="h-4 w-4" />{l}</button>
          ))}
        </div>
        <p className="flex items-start gap-2 rounded-2xl bg-gold-soft p-3 text-xs"><ShieldCheck className="h-4 w-4 shrink-0" />Questions about your own doses, results or worrying symptoms go to your care team.</p>
        {mode === "avatar" && <p className="text-xs text-muted-foreground">The live video avatar connects once its service key is added. Until then the doctor speaks aloud here, in the same conversation.</p>}
      </aside>

      <section className="flex min-h-[70vh] flex-col rounded-3xl border border-border bg-muted/40">
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {msgs.map((m, i) => <MessageBubble key={m.id ?? i} m={m} onEscalate={escalate} />)}
          {busy && <p className="text-xs text-muted-foreground">The doctor is thinking…</p>}
          <div ref={endRef} />
        </div>
        {data.messages.length === 0 && (
          <div className="px-5 pb-4">
            <p className="mb-2 text-sm font-medium">Not sure where to start? Tap a question:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.suggestions.slice(0, 4).map((q) => <button key={q} onClick={() => send(q)} className="rounded-2xl border border-border bg-card px-4 py-3 text-left text-sm transition hover:border-primary hover:bg-secondary">{q}</button>)}
            </div>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2 border-t border-border p-3">
          {mode !== "text" && (
            <Button type="button" size="icon" variant={dict.listening ? "destructive" : "secondary"} className="shrink-0 rounded-full" onClick={dict.listening ? dict.stop : dict.start} aria-label="Speak">
              {dict.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1} placeholder={dict.listening ? "Listening…" : prog.placeholder} className="min-h-12 resize-none rounded-2xl bg-card text-base"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} />
          <Button type="submit" size="icon" className="shrink-0 rounded-full" disabled={busy || !input.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
        </form>
      </section>
    </div>
    </div>
  );
}
