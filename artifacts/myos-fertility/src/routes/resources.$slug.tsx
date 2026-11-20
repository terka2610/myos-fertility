import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Phone } from "lucide-react";
import resources from "@/lib/resources.json";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/resources/$slug")({
  loader: ({ params }) => {
    const resource = resources.find((r) => r.slug === params.slug);
    if (!resource) throw notFound();
    return resource;
  },
  head: ({ loaderData }) => ({ meta: [
    { title: `${loaderData?.title ?? "Guide not found"} — MYOS Resources` },
    { name: "description", content: loaderData?.tagline ?? "Explore MYOS fertility guides." },
    { property: "og:title", content: `${loaderData?.title ?? "Guide not found"} — MYOS` },
    { property: "og:description", content: loaderData?.tagline ?? "Explore MYOS fertility guides." },
    { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary" },
  ] }), component: Guide,
});
function Guide() {
  const r = Route.useLoaderData();
  return <article className="mx-auto max-w-3xl">
    <Link to="/resources" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4" />All resources</Link>
    <p className="mb-3 text-sm font-medium text-accent">{r.group}</p>
    <h1 className="text-5xl md:text-6xl">{r.title}</h1>
    <p className="mt-5 text-xl text-muted-foreground">{r.tagline}</p>
    <div className="mt-12 space-y-9">{r.sections.map((s) => <section key={s.heading}><h2 className="text-3xl">{s.heading}</h2><p className="mt-3 leading-8 text-foreground/80">{s.body}</p></section>)}</div>
    {r.call_if && <aside className="mt-10 rounded-lg border border-border bg-gold-soft p-6"><h2 className="flex items-center gap-3 text-2xl"><Phone className="size-5 shrink-0" />Call your care team if…</h2><ul className="mt-4 list-disc space-y-3 pl-5 leading-7">{r.call_if.map((item) => <li key={item}>{item}</li>)}</ul></aside>}
    <section className="mt-12 border-t border-border pt-8"><h2 className="text-3xl">Ask Dr Tessa’s twin</h2><div className="mt-5 flex flex-col items-start gap-3">{r.ask.map((question) => <Button key={question} asChild variant="outline" className="h-auto max-w-full whitespace-normal rounded-full px-5 py-3 text-left"><Link to="/twin/chat/$doctorId" params={{ doctorId: "d0c70000-0000-4000-8000-000000000004" }} search={{ q: question }}><span>{question}</span><ArrowUpRight className="size-4 shrink-0" /></Link></Button>)}</div></section>
    <section className="mt-12 border-t border-border pt-8"><h2 className="text-2xl">Sources</h2><ul className="mt-4 space-y-3 text-sm">{r.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="break-words text-accent underline underline-offset-4">{source.label}</a></li>)}</ul><p className="mt-6 text-sm leading-6 text-muted-foreground">Plain-language summary adapted from the sources above. Not medical advice; ask your care team about your own treatment.</p></section>
  </article>;
}