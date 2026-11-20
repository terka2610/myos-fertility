import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const TESSA_ID = "d0c70000-0000-4000-8000-000000000004";
const ACCOUNTS = { patient: "demo-patient@myos-demo.app", provider: "demo-provider@myos-demo.app" } as const;

/** Public: returns a one-time sign-in token for a shared demo account (email pre-confirmed). */
export const demoSignIn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ role: z.enum(["patient", "provider"]) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = ACCOUNTS[data.role];
    const created = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { display_name: data.role === "patient" ? "Maya (demo)" : "Demo provider" } });
    if (created.error && !/already|registered|exists/i.test(created.error.message)) throw new Error(created.error.message);
    const link = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error || !link.data.properties?.hashed_token) throw new Error(link.error?.message ?? "Demo sign-in failed");
    const userId = link.data.user.id;
    let patientId: string | null = null;
    if (data.role === "patient") {
      const { data: existing } = await supabaseAdmin.from("twin_patients").select("id").eq("owner_id", userId).eq("display_name", "Maya").limit(1).maybeSingle();
      patientId = existing?.id ?? null;
      if (!patientId) {
        const { data: row, error } = await supabaseAdmin.from("twin_patients").insert({
          owner_id: userId, display_name: "Maya", reason: "egg_freezing", diagnosis: "PCOS", medication: "", knowledge_level: "new",
          preferences: ["text"], preferred_language: "English", language: "English",
          values_note: "Queer, single, feels anxious about medical settings. Wants a clinic that is inclusive and explains things gently.",
        }).select("id").single();
        if (error) throw new Error(error.message);
        patientId = row.id;
      }
    }
    return { tokenHash: link.data.properties.hashed_token, patientId };
  });
