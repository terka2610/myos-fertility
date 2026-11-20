import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard, SocialButtons } from "@/components/myos/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/register")({
  validateSearch: (s: Record<string, unknown>): { program: string | undefined } => ({ program: typeof s["program"] === "string" ? s["program"] : undefined }),
  head: () => ({ meta: [
    { title: "Create account — MYOS Fertility" },
    { name: "description", content: "Create your MYOS account to start an AI fertility consultation." },
    { property: "og:title", content: "Join MYOS Fertility" },
    { property: "og:description", content: "Start your AI fertility consultation." },
  ] }),
  component: Register,
});

function Register() {
  const [f, setF] = useState({ first: "", last: "", email: "", pw: "" });
  const [terms, setTerms] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terms) { toast.error("Please accept the terms to continue."); return; }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: f.email, password: f.pw,
      options: { emailRedirectTo: `${window.location.origin}/twin`, data: { first_name: f.first, last_name: f.last } },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  };
  if (sent) return (
    <AuthCard title="Check your email" subtitle={`We sent a confirmation link to ${f.email}. Open it to finish signing up.`}>
      <Link to="/login" className="text-sm text-primary">Back to sign in</Link>
    </AuthCard>
  );
  return (
    <AuthCard title="Create your account" subtitle="Your consultation stays private to you.">
      <SocialButtons />
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="fn">First name</Label><Input id="fn" value={f.first} onChange={(e) => setF({ ...f, first: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ln">Last name</Label><Input id="ln" value={f.last} onChange={(e) => setF({ ...f, last: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="em">Email</Label><Input id="em" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" minLength={8} required value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} /></div>
        <label className="flex items-start gap-2 text-sm text-muted-foreground"><Checkbox checked={terms} onCheckedChange={(v) => setTerms(v === true)} className="mt-0.5" />I accept the Terms and Privacy Policy and understand MYOS is an AI companion, not a doctor.</label>
        <Button className="w-full rounded-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
      </form>
      <p className="mt-5 text-sm text-muted-foreground">Already have an account? <Link to="/login" className="text-primary">Sign in</Link></p>
    </AuthCard>
  );
}
