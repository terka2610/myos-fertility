import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/twin/admin")({
  head: () => ({ meta: [{ title: "Admin review — MYOS" }, { name: "description", content: "Approve documents and publish doctor digital twins." }, { property: "og:title", content: "MYOS admin review" }, { property: "og:description", content: "Review and publish digital twins." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Admin,
});

function Admin() {
  const { user } = useAuth(); const qc = useQueryClient();
  const isAdmin = useQuery({ queryKey: ["twin", "isAdmin", user?.id], enabled: !!user, queryFn: async () => (await supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" })).data === true });
  const twins = useQuery({ queryKey: ["twin", "admin"], enabled: isAdmin.data === true, queryFn: async () => (await supabase.from("twin_doctors").select("id,name,clinic,status,photos,is_demo,twin_documents(id,name,status)").eq("is_demo", false).order("created_at", { ascending: false })).data ?? [] });
  if (isAdmin.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!isAdmin.data) return <p>Only administrators can open this page.</p>;
  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => { const { error } = await p; if (error) toast.error(error.message); else { toast.success(ok); qc.invalidateQueries({ queryKey: ["twin"] }); } };
  return (
    <div className="space-y-8">
      <h1 className="text-5xl">Admin <span className="serif-accent">review</span></h1>
      {twins.data?.map((t) => {
        const allApproved = t.twin_documents.every((d) => d.status === "approved");
        return (
          <section key={t.id} className="rounded-[1.75rem] bg-card p-6">
            <div className="flex items-center gap-4">
              <img src={t.photos[0]} alt="" className="h-16 w-16 rounded-full object-cover" />
              <div className="flex-1"><h2 className="text-2xl">Dr {t.name}</h2><p className="text-sm text-muted-foreground">{t.clinic} · {t.status}</p></div>
              {t.status !== "published"
                ? <Button className="rounded-full" disabled={!allApproved} onClick={() => run(supabase.from("twin_doctors").update({ status: "published" }).eq("id", t.id), "Published.")}>{allApproved ? "Publish" : "Approve documents first"}</Button>
                : <Button variant="outline" className="rounded-full" onClick={() => run(supabase.from("twin_doctors").update({ status: "review" }).eq("id", t.id), "Unpublished.")}>Unpublish</Button>}
            </div>
            <ul className="mt-4 divide-y divide-border text-sm">{t.twin_documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2"><span>{d.name}</span>
                {d.status === "approved" ? <span className="text-muted-foreground">Approved</span> : <Button size="sm" variant="secondary" className="rounded-full" onClick={() => run(supabase.from("twin_documents").update({ status: "approved" }).eq("id", d.id), "Document approved.")}>Approve</Button>}
              </li>))}</ul>
          </section>
        );
      })}
      {!twins.data?.length && <p className="text-muted-foreground">No twins to review.</p>}
    </div>
  );
}
