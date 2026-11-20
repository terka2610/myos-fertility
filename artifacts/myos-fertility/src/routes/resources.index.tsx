import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import resources from "@/lib/resources.json";

export const Route = createFileRoute("/resources/")({
  head: () => ({ meta: [
    { title: "Fertility resources — MYOS" },
    { name: "description", content: "Plain-language guides to fertility evaluation, IVF, egg freezing and emotional support." },
    { property: "og:title", content: "Fertility resources — MYOS" },
    { property: "og:description", content: "Explore fertility care, step by step, with sources and questions for Dr Tessa's twin." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: Resources,
});
function Resources() {
  const groups = [...new Set(resources.map((r) => r.group))];
  return <div className="space-y-12">
    <div><h1 className="text-5xl md:text-6xl">Resources</h1><p className="mt-4 text-lg text-muted-foreground">Fertility care, one step at a time.</p></div>
    {groups.map((group) => <section key={group}>
      <h2 className="mb-5 text-3xl">{group}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resources.filter((r) => r.group === group).map((r) => <Link key={r.slug} to="/resources/$slug" params={{ slug: r.slug }} className="group flex min-h-44 flex-col rounded-lg border border-border bg-card p-6 transition-colors hover:bg-secondary">
          <div className="flex items-start justify-between gap-3"><h3 className="text-2xl">{r.title}</h3><ArrowUpRight className="mt-1 size-5 shrink-0 text-accent" /></div>
          <p className="mt-3 text-sm text-muted-foreground">{r.tagline}</p>
        </Link>)}
      </div>
    </section>)}
  </div>;
}