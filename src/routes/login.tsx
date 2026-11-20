import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard, SocialButtons } from "@/components/myos/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { twinReturnTarget } from "@/lib/login-return";
import { z } from "zod";

export const Route = createFileRoute("/login")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({ meta: [
    { title: "Sign in — MYOS Fertility" },
    { name: "description", content: "Sign in to continue your fertility consultation." },
    { property: "og:title", content: "Sign in — MYOS" },
    { property: "og:description", content: "Continue your MYOS consultation." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const { redirect } = Route.useSearch();
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const target = twinReturnTarget(redirect);
    if (target) nav({ to: "/twin/chat/$doctorId", params: { doctorId: target.doctorId }, search: { q: target.q, patient: target.patient }, replace: true });
    else nav({ to: "/twin", replace: true });
  }, [user, redirect, nav]);
  const [email, setEmail] = useState("gabija@uni.minerva.edu");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
  };
  return (
    <AuthCard title="Welcome back" subtitle="Continue your consultation.">
      <SocialButtons returnTo={redirect} />
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Button className="w-full rounded-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
      <div className="mt-5 space-y-2 text-sm">
        <p><Link to="/forgot-password" className="text-primary underline-offset-4 hover:underline">Forgot password?</Link></p>
        <p className="rounded-xl bg-secondary p-3 text-secondary-foreground">Had a MYOS account before? <Link to="/register" search={{ program: undefined }} className="font-medium underline">Create your login with the same email</Link> — after you confirm it, your profile is reconnected.</p>
        <p className="text-muted-foreground">New here? <Link to="/register" search={{ program: undefined }} className="text-primary">Create an account</Link></p>
      </div>
    </AuthCard>
  );
}
