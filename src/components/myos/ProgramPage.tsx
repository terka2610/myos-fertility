import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PublicHeader, PublicFooter } from "./PublicHeader";

export function ProgramPage({ title, intro, steps, slug }: { title: string; intro: string; steps: { t: string; d: string }[]; slug: string }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-hero">
        <PublicHeader />
        <section className="mx-auto max-w-4xl px-5 pb-14 pt-8">
          <h1 className="text-4xl font-semibold md:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{intro}</p>
          <Button asChild size="lg" className="mt-7 rounded-full"><Link to="/register" search={{ program: slug }}>Join {title}</Link></Button>
        </section>
      </div>
      <section className="mx-auto max-w-4xl px-5 py-14">
        <ol className="space-y-4">
          {steps.map((s, i) => (
            <li key={s.t} className="flex gap-5 rounded-2xl border border-border bg-card p-5">
              <span className="font-display text-3xl text-primary">{String(i + 1).padStart(2, "0")}</span>
              <div><h3 className="text-lg font-semibold">{s.t}</h3><p className="mt-1 text-sm text-muted-foreground">{s.d}</p></div>
            </li>
          ))}
        </ol>
      </section>
      <PublicFooter />
    </div>
  );
}
