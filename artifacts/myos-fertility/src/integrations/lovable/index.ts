import { supabase, isSupabaseConfigured, BACKEND_SETUP_MESSAGE } from "../supabase/client";

// Keep the imported call contract while using the existing Supabase project's
// Google provider directly instead of Lovable's editor-only OAuth broker.
export const lovable = {
  auth: {
    async signInWithOAuth(provider: "google" | "lovable", opts?: { redirect_uri?: string }) {
      if (!isSupabaseConfigured()) return { error: new Error(BACKEND_SETUP_MESSAGE), redirected: false };
      if (provider === "lovable") {
        return { error: new Error("Lovable sign-in is only available in the original app. Use email or Google here."), redirected: false };
      }
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: opts?.redirect_uri },
        });
        return { error, redirected: !error };
      } catch (error) {
        return { error: error instanceof Error ? error : new Error("Sign-in failed"), redirected: false };
      }
    },
  },
};
