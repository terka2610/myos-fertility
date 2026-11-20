import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, HeartHandshake, ShieldCheck, BadgeCheck } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/myos/PublicHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [
    { title: "About MYOS — Your fertility doctor’s digital twin" },
    { name: "description", content: "Your fertility doctor’s digital twin, there for you 24/7, in your language. Learn why we built MYOS and how it stays safe by design." },
    { property: "og:title", content: "About MYOS — Your fertility doctor’s digital twin" },
    { property: "og:description", content: "Your doctor’s knowledge, in your doctor’s words. Meet the safety-first digital twin supporting patients and care teams between visits." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: About,
});

const SAFETY = [
  { icon: BookOpen, title: "Only your doctor’s knowledge.", text: "The twin answers only from documents the doctor approved, and shows where each answer came from." },
  { icon: HeartHandshake, title: "Clinical questions go to humans.", text: "Doses, missed medication, test results and worrying symptoms are never answered by the twin. They go to the care team’s nurse review list." },
  { icon: BadgeCheck, title: "Reviewed before it’s live.", text: "Every twin and every document is approved before patients can see it." },
  { icon: ShieldCheck, title: "Always honest.", text: "Every conversation is clearly labeled as an AI twin, not a live consultation. In an emergency, call 911." },
];

function About() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-5 pb-16 pt-10 md:px-10 md:pt-16">
        <header className="max-w-3xl pb-14 md:pb-20">
          <h1 className="text-5xl md:text-7xl">About <span className="serif-accent">MYOS</span></h1>
          <p className="mt-6 text-xl leading-8 text-muted-foreground">Your fertility doctor’s digital twin, there for you 24/7, in your language.</p>
        </header>
        <div className="max-w-3xl space-y-14">
          <section>
            <h2 className="text-4xl">What is a <span className="serif-accent">digital twin?</span></h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">A digital twin is an AI version of your own doctor. It has their face and their voice, and it only knows what they’ve taught it: their clinic’s protocols and guidance. It isn’t a generic chatbot pulling answers from the internet. When you ask a question at 11pm, before your first appointment, or in Spanish, you get your doctor’s answer, in your doctor’s words.</p>
          </section>
          <section>
            <h2 className="text-4xl">Who are the twins, and <span className="serif-accent">why are they helpful?</span></h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">MYOS digital twins represent individual fertility specialists—not a doctor available on a live call. Each twin introduces its specialist and explains fertility evaluation, IVF and egg freezing using the knowledge available in that doctor’s guides. Our demo twins let you experience this before choosing a specialist; they are examples, not a substitute for a licensed clinician.</p>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">For providers, a twin helps answer recurring educational questions so the care team can focus on personal care. For patients, it offers a welcoming place to ask questions before an appointment or between visits, 24/7, in their language. You can revisit an explanation, see its sources and prepare for a more informed conversation with your doctor. The twin never diagnoses, changes medication doses or interprets your results—those questions belong with your care team.</p>
          </section>
          <section>
            <h2 className="text-4xl">Why we <span className="serif-accent">built it</span></h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">Fertility treatment is full of questions, and they rarely come up during office hours. Patients wait days for a call back about an injection or a scan. Doctors and nurses answer the same questions again and again. A digital twin lets patients ask any time, without an appointment, and frees the care team for the conversations that need a human.</p>
          </section>
        </div>
        <div className="my-16 grid gap-6 md:grid-cols-2">
          <section className="rounded-[1.75rem] bg-gold p-7 md:p-9">
            <h2 className="text-4xl">For providers</h2>
            <p className="mt-5 leading-8 text-foreground/80">Set up your twin in about 15 minutes, from home: a headshot, a short voice sample and your clinic’s documents. It handles the repeat questions between visits, and anything clinical comes straight back to your team. Nothing goes live until it’s reviewed.</p>
          </section>
          <section className="rounded-[1.75rem] bg-pink p-7 md:p-9">
            <h2 className="text-4xl">For patients</h2>
            <p className="mt-5 leading-8 text-foreground/80">Meet your specialist’s twin before you book. Ask anything about evaluation, IVF or egg freezing, any time, in your language, by chat, voice or text message. Every answer shows the source it came from. When you’re ready, book a real consultation in one tap.</p>
          </section>
        </div>
        <section>
          <h2 className="text-4xl">Safe <span className="serif-accent">by design</span></h2>
          <div className="mt-8 grid gap-x-12 gap-y-9 md:grid-cols-2">
            {SAFETY.map(({ icon: Icon, title, text }) => <div key={title} className="flex items-start gap-4"><Icon aria-hidden="true" className="mt-1 size-6 shrink-0 text-accent" /><div><h3 className="font-sans text-base font-semibold">{title}</h3><p className="mt-2 leading-7 text-muted-foreground">{text}</p></div></div>)}
          </div>
        </section>
        <section className="my-16 max-w-3xl">
          <h2 className="text-4xl">What’s <span className="serif-accent">next</span></h2>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">Today, the twin answers questions. Next, it will support patients through treatment itself, helping them track symptoms, remember each step and schedule visits, always in their doctor’s voice.</p>
        </section>
        <section className="bg-pink px-6 py-12 text-center md:py-16">
          <h2 className="text-4xl md:text-5xl">Meet a doctor’s <span className="serif-accent">twin</span></h2>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button asChild className="h-auto rounded-full px-7 py-3.5 text-base"><Link to="/twin/doctor">I’m a provider</Link></Button>
            <Button asChild variant="outline" className="h-auto rounded-full border-primary px-7 py-3.5 text-base text-primary"><Link to="/twin">I’m a patient</Link></Button>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
