import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/myos/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Choose a new password — MYOS Fertility" },
    { name: "description", content: "Set a new password for your MYOS account." },
    { property: "og:title", content: "New password — MYOS" },
    { property: "og:description", content: "Set a new MYOS password." },
  ] }),
  component: () => {
    const nav = useNavigate();
    const [pw, setPw] = useState("");
    const submit = async (e: React.FormEvent) => {
      e.preventDefault();
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) { toast.error(error.message); return; }
      toast.success("Password updated");
      nav({ to: "/dashboard" });
    };
    return (
      <AuthCard title="Choose a new password">
        <form onSubmit={submit} className="space-y-4"><Input type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /><Button className="w-full rounded-full">Save password</Button></form>
      </AuthCard>
    );
  },
});
