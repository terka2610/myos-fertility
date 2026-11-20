import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Links an imported (pre-migration) account to the signed-in Lovable Cloud user.
// Only runs for a verified email and an exact, unambiguous server-side match.
export const linkLegacyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: u } = await context.supabase.auth.getUser();
    const user = u.user;
    if (!user?.email || !user.email_confirmed_at) return { linked: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await (supabaseAdmin as any).from("legacy_user_map").select("*").ilike("email", user.email).is("auth_user_id", null);
    if (!rows || rows.length !== 1) return { linked: false };
    const row = rows[0];
    await (supabaseAdmin as any).from("legacy_user_map").update({ auth_user_id: user.id, linked_at: new Date().toISOString() }).eq("legacy_user_id", row.legacy_user_id);
    const p = row.imported_profile ?? {};
    await (supabaseAdmin as any).from("profiles").update({ legacy_user_id: row.legacy_user_id, first_name: p.first_name ?? null, last_name: p.last_name ?? null }).eq("id", user.id);
    return { linked: true };
  });
