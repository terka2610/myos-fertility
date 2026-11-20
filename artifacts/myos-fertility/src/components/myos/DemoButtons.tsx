import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured, BACKEND_SETUP_MESSAGE } from "@/integrations/supabase/client";
import { demoSignIn } from "@/lib/demo/demo.functions";

export function useDemoSignIn() {
  const nav = useNavigate();
  const [busy, setBusy] = useState<null | "patient" | "provider">(null);
  const go = async (role: "patient" | "provider") => {
    if (!isSupabaseConfigured()) {
      toast.error(BACKEND_SETUP_MESSAGE);
      return;
    }
    if (busy) return;
    setBusy(role);
    try {
      const r = await demoSignIn({ data: { role } });
      await supabase.auth.signOut();
      const { error } = await supabase.auth.verifyOtp({ token_hash: r.tokenHash, type: "magiclink" });
      if (error) throw error;
      if (role === "patient") await nav({ to: "/twin", search: { patient: r.patientId ?? undefined } });
      else await nav({ to: "/twin/provider" });
    } catch (e) { toast.error((e as Error).message || "Couldn't open the demo"); } finally { setBusy(null); }
  };
  return { go, busy };
}
