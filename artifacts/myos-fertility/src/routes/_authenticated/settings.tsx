import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fertilityStateQuery } from "@/lib/fertility/queries";
import { clearHistory } from "@/lib/fertility/consultation.functions";
import { RolePicker } from "@/components/myos/RolePicker";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — MYOS Fertility" }, { name: "description", content: "Manage your MYOS settings." }, { property: "og:title", content: "MYOS Settings" }, { property: "og:description", content: "Role, stage and privacy." }] }),
  component: Settings,
});

function Settings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data } = useQuery(fertilityStateQuery());
  const wipe = async () => { await clearHistory({ data: { program: "ivf-care" } }); await qc.invalidateQueries({ queryKey: ["fertility"] }); toast.success("Consultation history deleted"); };
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-3xl font-semibold">Settings</h1>
      <section className="rounded-3xl bg-card p-6 shadow-soft"><h2 className="text-lg font-semibold">Account</h2><p className="mt-1 text-sm text-muted-foreground">{user?.email}</p></section>
      {data?.membership && (
        <section className="rounded-3xl bg-card p-6 shadow-soft">
          <h2 className="mb-4 text-lg font-semibold">Role & stage</h2>
          <RolePicker initialRole={data.membership.care_role} initialStage={data.membership.treatment_stage} cta="Save" onDone={() => toast.success("Saved")} />
        </section>
      )}
      <section className="rounded-3xl border border-destructive/30 bg-card p-6">
        <h2 className="text-lg font-semibold">Delete consultation history</h2>
        <p className="mt-1 text-sm text-muted-foreground">Removes every message in your consultation. This can't be undone.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive" className="mt-4 rounded-full">Delete history</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete all messages?</AlertDialogTitle><AlertDialogDescription>Your whole consultation history will be permanently removed.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={wipe}>Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
