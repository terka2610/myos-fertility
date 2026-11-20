import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthState { user: User | null; session: Session | null; loading: boolean; signOut: () => Promise<void> }
const Ctx = createContext<AuthState>({ user: null, session: null, loading: true, signOut: async () => {} });

function hasSupabaseConfiguration() {
  const url = import.meta.env["VITE_SUPABASE_URL"] ||
    (typeof process === "undefined" ? undefined : process.env["SUPABASE_URL"]);
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    (typeof process === "undefined" ? undefined : process.env["SUPABASE_PUBLISHABLE_KEY"]);
  return Boolean(url && key);
}

export function AuthProvider({
  children,
  enabled = true,
}: {
  children: ReactNode;
  enabled?: boolean;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const canUseAuth = enabled && hasSupabaseConfiguration();
  useEffect(() => {
    if (!canUseAuth) {
      setSession(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); setLoading(false); });
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    return () => sub.subscription.unsubscribe();
  }, [canUseAuth]);
  const signOut = async () => {
    if (!canUseAuth) throw new Error("Authentication is unavailable without Supabase configuration.");
    await supabase.auth.signOut();
  };
  return (
    <Ctx.Provider
      value={
        canUseAuth
          ? { session, user: session?.user ?? null, loading, signOut }
          : { session: null, user: null, loading: false, signOut }
      }
    >
      {children}
    </Ctx.Provider>
  );
}
export const useAuth = () => useContext(Ctx);
