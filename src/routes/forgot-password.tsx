import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/myos/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [
    { title: "Reset password — MYOS Fertility" },
    { name: "description", content: "Get a link to reset your MYOS password." },
    { property: "og:title", content: "Reset password — MYOS" },
    { property: "og:description", content: "Reset your MYOS password." },
  ] }),
  component: () => {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) { toast.error(error.message); return; }
      setSent(true);
    };
    return (
      <AuthCard title="Reset your password" subtitle={sent ? "If that email has an account, a reset link is on its way." : "We'll email you a reset link."}>
        {!sent && <form onSubmit={submit} className="space-y-4"><Input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /><Button className="w-full rounded-full">Send link</Button></form>}
        <Link to="/login" className="mt-4 inline-block text-sm text-primary">Back to sign in</Link>
      </AuthCard>
    );
  },
});
