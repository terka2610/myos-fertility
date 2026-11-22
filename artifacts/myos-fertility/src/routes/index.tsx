import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowRight, LoaderCircle, Play, Square } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/myos/PublicHeader";
import { LANGUAGES } from "@/lib/twin/languages";
import mayaImg from "@/assets/demo-maya.jpg";
import introVideo from "@/assets/fertility-introduction-optimized.mp4.asset.json";
import introPoster from "@/assets/fertility-introduction.jpg.asset.json";
import { useDemoSignIn } from "@/components/myos/DemoButtons";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

const introAvailable = !introVideo.url.startsWith("/__l5e/");

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MYOS — Your doctor's digital twin, 24/7, in your language" },
      { name: "description", content: "Ask your fertility doctor's AI twin anything, any time, in your language. Answers come only from your clinic's own protocols." },
      { property: "og:title", content: "MYOS — Your doctor, 24/7, in your language" },
      { property: "og:description", content: "A fertility doctor's AI digital twin that answers from clinic-approved protocols, day and night, in any language." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const STEPS = {
  patients: [
    ["Choose your specialist", "Browse doctors by what matters to you: language, PCOS, LGBTQ+ experience."],
    ["Ask their digital twin", "Type or speak, any time, in your language. Answers come from the doctor's own protocols."],
    ["Reach the real team", "Dosing, results or worrying symptoms go straight to the care team."],
  ],
  providers: [
    ["Add your face and voice", "Upload a headshot and record a short voice sample from home."],
    ["Teach it your protocols", "Upload your clinic documents. Nothing goes live until it's reviewed."],
    ["Be there between visits", "Your twin answers patients 24/7 in their language, in your words."],
  ],
} as const;

function Landing() {
  const [tab, setTab] = useState<keyof typeof STEPS>("providers");
  const [playing, setPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const demo = useDemoSignIn();
  const videoRef = useRef<HTMLVideoElement>(null);
  const play = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused || videoLoading) {
      video.pause(); video.currentTime = 0; setVideoLoading(false); return;
    }
    if (video.error) video.load();
    setVideoError(false);
    setVideoLoading(true);
    video.muted = false;
    try { await video.play(); } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setVideoError(true);
      setPlaying(false); setVideoLoading(false);
    }
  };
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="blob-pink pointer-events-none absolute -right-40 top-24 h-[520px] w-[520px]" />
      <div className="blob-gold pointer-events-none absolute -left-40 top-[520px] h-[300px] w-[300px]" />
      <PublicHeader />

      <section className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-14 pt-6 md:grid-cols-[1.2fr_1fr] md:px-10">
        <div>
          <h1 className="text-5xl leading-[1.02] md:text-7xl">Your doctor, <span className="serif-accent">24/7, in your language</span></h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">Ask your fertility specialist's digital twin anything, any time. It answers from your clinic's own protocols and hands anything clinical to the real team.</p>
          <div className="mt-6 flex flex-wrap gap-2" aria-label="Languages the twin speaks">
            {LANGUAGES.slice(0, 10).map((l) => <span key={l.name} className="rounded-full bg-card px-3 py-1 text-sm shadow-sm">{l.native}</span>)}
            <span className="rounded-full px-3 py-1 text-sm text-muted-foreground">+ more</span>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="h-auto rounded-full px-6 py-3 text-base shadow-none">
              <Link to="/clinic/samples" search={{ place: "centre" }} data-testid="link-start-workflow">
                Start with the fertility clinic
                <ArrowRight aria-hidden="true" className="ml-2 size-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => demo.go("provider")}
              disabled={!isSupabaseConfigured() || !!demo.busy}
              className="h-auto rounded-full border-primary px-5 py-3 text-sm text-primary shadow-none disabled:opacity-60"
              data-testid="button-provider-demo"
            >
              {demo.busy === "provider" ? "Opening…" : "Provider demo"}
            </Button>
            <Button
              variant="outline"
              onClick={() => demo.go("patient")}
              disabled={!isSupabaseConfigured() || !!demo.busy}
              className="h-auto rounded-full border-primary px-5 py-3 text-sm text-primary shadow-none disabled:opacity-60"
              data-testid="button-patient-demo"
            >
              {demo.busy === "patient" ? "Opening…" : "Patient demo"}
            </Button>
          </div>
          <p role="note" className="mt-3 text-xs text-muted-foreground">
            {isSupabaseConfigured()
              ? "Provider and patient demos open shared accounts. The clinic-to-storage walkthrough uses synthetic records."
              : "Provider and patient demos are unavailable until the backend is connected. The clinic-to-storage walkthrough is ready and uses synthetic records."}
            {" "}
            <Link to="/clinics" className="font-medium text-primary underline underline-offset-4" data-testid="link-browse-demo-clinics">
              Browse fictional demo clinics
            </Link>
          </p>
        </div>
        <div className="relative mx-auto w-full max-w-[340px]">
          {introAvailable ? (
            <video ref={videoRef} src={introVideo.url} poster={introPoster.url} preload="metadata" playsInline aria-label="MYOS fertility guide introduction" className="aspect-[9/16] w-full rounded-2xl object-contain" onPlaying={() => { setPlaying(true); setVideoLoading(false); setVideoError(false); }} onWaiting={() => { if (videoRef.current && !videoRef.current.paused) setVideoLoading(true); }} onPause={() => { setPlaying(false); setVideoLoading(false); }} onEnded={() => { setPlaying(false); setVideoLoading(false); }} onError={() => { setVideoError(true); setPlaying(false); setVideoLoading(false); }} />
          ) : (
            <div className="flex aspect-[4/5] flex-col justify-between rounded-[1.75rem] border border-border bg-card p-6 shadow-soft md:p-7">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-accent">QUICK START</p>
                <h2 className="mt-3 font-display text-3xl leading-tight">
                  Follow one sample from clinic to storage
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Start with the clinic, then review transport and storage handoffs.
                </p>
              </div>
              <ol className="my-5 space-y-3">
                {[
                  ["01", "Fertility clinic", "Open the first sample document"],
                  ["02", "Cryo transport", "Review handover and GPS"],
                  ["03", "Cryogenic storage", "Confirm receipt and placement"],
                ].map(([number, title, detail]) => (
                  <li key={number} className="flex items-center gap-3 rounded-2xl bg-background p-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-pink-soft text-xs font-semibold text-accent">
                      {number}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{title}</span>
                      <span className="block text-xs text-muted-foreground">{detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted-foreground">
                Demo only · records stay in this browser and are not real patient records.
              </p>
            </div>
          )}
          {introAvailable && (
            <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium">AI-generated demo</span>
          )}
          {introAvailable && (
            <Button onClick={play} aria-label={videoLoading || playing ? "Stop introduction" : videoError ? "Try introduction again" : "Hear the introduction"} className="absolute -bottom-5 left-1/2 h-11 w-60 -translate-x-1/2 gap-2 rounded-full px-5 py-3 text-sm font-medium shadow-lg">
              {videoLoading ? <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" /> : playing ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}{videoLoading ? "Loading…" : playing ? "Stop" : videoError ? "Try again" : "Hear the introduction"}
            </Button>
          )}
          {videoError && <p role="alert" className="mt-8 text-center text-sm text-muted-foreground">The video couldn’t play. Please try again.</p>}
        </div>
      </section>

      <section className="relative mx-auto grid max-w-6xl gap-6 px-5 py-10 md:grid-cols-2 md:px-10">
        <button
          type="button"
          onClick={() => demo.go("provider")}
          disabled={!isSupabaseConfigured() || !!demo.busy}
          title={!isSupabaseConfigured() ? "Provider demo sign-in is unavailable until the backend is connected." : undefined}
          data-testid="card-provider-demo"
          className="group rounded-[1.75rem] bg-gold p-9 text-left text-foreground transition-opacity hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-70"
        >
          <p className="text-xs font-semibold tracking-[0.12em]">FOR PROVIDERS</p>
          <h2 className="mt-3 text-4xl">I'm a provider</h2>
          <p className="mt-3 max-w-sm text-foreground/80">Set up your digital twin from home and stay with your patients between visits, around the clock.</p>
          <span className="mt-8 flex h-13 w-13 items-center justify-center rounded-full bg-primary p-4 text-primary-foreground transition-transform group-hover:translate-x-1"><ArrowRight className="h-5 w-5" /></span>
        </button>
        <button
          type="button"
          onClick={() => demo.go("patient")}
          disabled={!isSupabaseConfigured() || !!demo.busy}
          title={!isSupabaseConfigured() ? "Patient demo sign-in is unavailable until the backend is connected." : undefined}
          data-testid="card-patient-demo"
          className="group rounded-[1.75rem] bg-pink p-9 text-left text-foreground transition-opacity hover:shadow-soft disabled:cursor-not-allowed disabled:opacity-70"
        >
          <p className="text-xs font-semibold tracking-[0.12em]">FOR PATIENTS</p>
          <h2 className="mt-3 text-4xl">I'm a patient</h2>
          <p className="mt-3 max-w-sm text-foreground/80">Ask your doctor's digital twin anything, any time, in your language. No appointment needed.</p>
          <span className="mt-8 flex h-13 w-13 items-center justify-center rounded-full bg-primary p-4 text-primary-foreground transition-transform group-hover:translate-x-1"><ArrowRight className="h-5 w-5" /></span>
        </button>
      </section>

      <section className="relative mx-auto max-w-6xl px-5 py-6 md:px-10">
        <Link to="/maya" className="group flex flex-col items-center gap-6 rounded-[1.75rem] bg-card p-6 md:flex-row md:p-8">
          <img src={mayaImg} alt="Maya, a fictional demo patient" width={768} height={960} loading="lazy" className="h-32 w-28 rounded-2xl object-cover" />
          <div className="flex-1">
            <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">A PATIENT STORY</p>
            <h2 className="mt-2 text-3xl">Meet Maya: is this clinic a good fit?</h2>
            <p className="mt-2 text-muted-foreground">See good-fit and red-flag clinic answers through the eyes of a queer patient with PCOS and medical anxiety.</p>
          </div>
          <span className="flex h-13 w-13 items-center justify-center rounded-full bg-primary p-4 text-primary-foreground transition-transform group-hover:translate-x-1"><ArrowRight className="h-5 w-5" /></span>
        </Link>
      </section>

      <section className="relative mt-10 rounded-t-[3rem] bg-card px-5 py-20 md:px-10">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-5xl">How it works</h2>
          <div className="mx-auto mt-8 inline-flex rounded-full bg-secondary p-1.5">
            {(["providers", "patients"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-full px-5 py-2 text-sm font-medium ${tab === t ? "bg-primary text-primary-foreground" : "text-secondary-foreground"}`}>For {t}</button>
            ))}
          </div>
          <div className="mt-12 grid gap-6 text-left md:grid-cols-3">
            {STEPS[tab].map(([t, d], i) => (
              <div key={t} className="rounded-3xl bg-background p-8">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pink font-display text-xl">{i + 1}</span>
                <h3 className="mt-6 text-2xl">{t}</h3>
                <p className="mt-3 text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-20 rounded-[2rem] bg-pink px-6 py-16">
            <h2 className="text-5xl">Ready to get <span className="italic">started?</span></h2>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <button type="button" onClick={() => demo.go("provider")} disabled={!isSupabaseConfigured() || !!demo.busy} className="rounded-full bg-primary px-7 py-3.5 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">I'm a provider</button>
              <button type="button" onClick={() => demo.go("patient")} disabled={!isSupabaseConfigured() || !!demo.busy} className="rounded-full bg-primary px-7 py-3.5 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">I'm a patient</button>
            </div>
          </div>
        </div>
      </section>
      <div className="bg-card"><PublicFooter /></div>
    </div>
  );
}
