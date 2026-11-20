import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowRight, Check, Play, Square, X } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/myos/PublicHeader";
import { speakBrowser } from "@/components/twin/TalkingHead";
import maya from "@/assets/demo-maya.jpg";
import { FLAGS, MAYA_FACTS, MAYA_HEALTH, MAYA_TOP5, MAYA_TOPICS } from "@/lib/demo/maya";

export const Route = createFileRoute("/maya")({
  head: () => ({
    meta: [
      { title: "Meet Maya — a MYOS demo patient story" },
      { name: "description", content: "Follow Maya, a queer patient with suspected PCOS and medical anxiety, as she checks whether a fertility clinic is a good fit." },
      { property: "og:title", content: "Meet Maya — MYOS demo patient" },
      { property: "og:description", content: "Good-fit versus red-flag clinic answers, side by side, through one patient's eyes." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MayaPage,
});

function MayaPage() {
  const [topic, setTopic] = useState(0);
  const [mode, setMode] = useState<"good" | "red">("good");
  const [playing, setPlaying] = useState(false);
  const level = useRef(0);
  const t = MAYA_TOPICS[topic] ?? MAYA_TOPICS[0]!;
  const answer = mode === "good" ? t.good : t.red;
  const play = async () => {
    if (playing) { speechSynthesis.cancel(); setPlaying(false); return; }
    setPlaying(true); await speakBrowser(answer, level, true); setPlaying(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="blob-pink pointer-events-none absolute -right-40 top-24 h-[520px] w-[520px]" />
      <PublicHeader />

      <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-12 pt-6 md:grid-cols-[1fr_1.2fr] md:px-10">
        <div className="relative mx-auto w-full max-w-sm">
          <img src={maya} alt="Maya, a fictional demo patient" width={768} height={960} className="aspect-[4/5] w-full rounded-[2rem] object-cover shadow-xl" />
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium">Fictional demo persona</span>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">DEMO PATIENT STORY</p>
          <h1 className="mt-3 text-5xl leading-[1.05] md:text-6xl">Meet <span className="serif-accent">Maya</span></h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">33, queer, starting to try with her wife Jess. Suspected PCOS, IBS, and a real fear of being dismissed by doctors.</p>
          <blockquote className="mt-6 max-w-xl border-l-2 border-primary pl-4 font-display text-2xl italic">"I don't want to be the difficult patient. I just need to understand what's happening to my body before someone does something to it."</blockquote>
          <dl className="mt-8 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {MAYA_FACTS.map(([k, v]) => (
              <div key={k}><dt className="text-xs font-semibold tracking-wide text-muted-foreground">{k}</dt><dd className="text-sm">{v}</dd></div>
            ))}
          </dl>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-5 py-8 md:px-10">
        <div className="rounded-[2rem] bg-pink p-8 md:p-10">
          <h2 className="text-4xl">What she carries in</h2>
          <ul className="mt-5 grid gap-3 md:grid-cols-3">
            {MAYA_HEALTH.map((h) => <li key={h} className="rounded-2xl bg-background/70 p-5 text-sm">{h}</li>)}
          </ul>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-5 py-12 md:px-10">
        <h2 className="text-center text-5xl">Is this clinic a <span className="serif-accent">good fit?</span></h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">Pick a topic Maya raises, then compare a good-fit answer with a red-flag one.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {MAYA_TOPICS.map((x, i) => (
            <button key={x.title} onClick={() => { setTopic(i); speechSynthesis.cancel(); setPlaying(false); }} className={`rounded-full px-5 py-2 text-sm font-medium ${i === topic ? "bg-primary text-primary-foreground" : "bg-card"}`}>{i + 1}. {x.title}</button>
          ))}
        </div>
        <div className="mx-auto mt-8 max-w-3xl space-y-4">
          <div className="ml-auto max-w-[85%] rounded-3xl rounded-br-md bg-secondary p-5">
            <p className="text-xs font-semibold text-muted-foreground">Maya</p>
            <p className="mt-1">{t.ask}</p>
          </div>
          <div className="flex justify-center">
            <div className="inline-flex rounded-full bg-card p-1.5">
              <button onClick={() => setMode("good")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium ${mode === "good" ? "bg-primary text-primary-foreground" : ""}`}><Check className="h-4 w-4" />Good-fit answer</button>
              <button onClick={() => setMode("red")} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium ${mode === "red" ? "bg-destructive text-destructive-foreground" : ""}`}><X className="h-4 w-4" />Red-flag answer</button>
            </div>
          </div>
          <div className={`max-w-[85%] rounded-3xl rounded-bl-md p-5 ${mode === "good" ? "bg-card" : "bg-destructive/10"}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-muted-foreground">Clinic</p>
              <button onClick={play} className="flex items-center gap-1 text-xs font-medium">{playing ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{playing ? "Stop" : "Listen"}</button>
            </div>
            <p className="mt-1">{answer}</p>
          </div>
          <p className="rounded-2xl bg-gold/40 p-4 text-sm"><b>What this shows:</b> {t.shows}</p>
        </div>
      </section>

      <section className="relative mx-auto grid max-w-6xl gap-6 px-5 py-8 md:grid-cols-2 md:px-10">
        <div className="rounded-[2rem] bg-card p-8">
          <h2 className="text-3xl">Her top five questions</h2>
          <ol className="mt-5 space-y-3">
            {MAYA_TOP5.map((q, i) => <li key={q} className="flex gap-3 text-sm"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink font-display">{i + 1}</span>{q}</li>)}
          </ol>
        </div>
        <div className="rounded-[2rem] bg-card p-8">
          <h2 className="text-3xl">Green flags, red flags</h2>
          <ul className="mt-5 space-y-3 text-sm">
            {FLAGS.map(([g, r]) => (
              <li key={g} className="grid grid-cols-2 gap-3">
                <span className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{g}</span>
                <span className="flex gap-2 text-muted-foreground"><X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-5 py-12 text-center md:px-10">
        <div className="rounded-[2rem] bg-pink px-6 py-14">
          <h2 className="text-4xl">Ask a doctor's twin <span className="italic">Maya's questions</span></h2>
          <p className="mx-auto mt-3 max-w-lg text-foreground/80">Any time, in her language. Anything about doses, results or symptoms goes to the real care team.</p>
          <Link to="/twin" className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-medium text-primary-foreground">Try it now <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Maya is a fictional demo persona. Clinic answers are made up for the demo and are not clinical guidance.</p>
      </section>
      <PublicFooter />
    </div>
  );
}
