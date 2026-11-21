import { createMiddleware } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// Read-only Supabase access for the synthetic cryogenic demo tables, so judges can see live demo
// data without signing in. It uses the publishable key only, so the database's own row-level
// security still decides what is readable. Writes keep using requireSupabaseAuth.

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function publishableKeyFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export function createPublicReadClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Supabase is not configured on the server.");
  return createClient(url, key, {
    global: { fetch: publishableKeyFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const publicSupabaseRead = createMiddleware({ type: "function" }).server(({ next }) =>
  next({ context: { supabase: createPublicReadClient() } }),
);
