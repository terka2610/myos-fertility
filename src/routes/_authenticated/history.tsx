import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fertilityStateQuery } from "@/lib/fertility/queries";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History — MYOS Fertility" }, { name: "description", content: "Your consultation history." }, { property: "og:title", content: "MYOS History" }, { property: "og:description", content: "Past conversations." }] }),
  component: () => {
    const { data } = useQuery(fertilityStateQuery());
    if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;
    const qs = data.messages.filter((m: any) => m.sender === "user");
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-semibold">History</h1>
        <p className="mt-1 text-muted-foreground">Every mode writes to the same conversation.</p>
        {qs.length === 0 ? <p className="mt-8 text-sm text-muted-foreground">No questions yet. <Link to="/consultation" search={{ mode: "text" }} className="text-primary">Start one</Link>.</p> : (
          <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
            {qs.slice().reverse().map((m: any) => (
              <li key={m.id} className="flex items-center justify-between gap-4 p-4 text-sm">
                <span>{m.content}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{m.mode} · {new Date(m.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
});
