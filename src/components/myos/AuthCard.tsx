import type { ReactNode } from "react";
import { Brand } from "./Brand";
import { lovable } from "@/integrations/lovable/index";
import "@lovable.dev/cloud-auth-js/styles.css";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-hero px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-soft">
        <Brand />
        <h1 className="mt-6 text-3xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function SocialButtons({ returnTo }: { returnTo?: string | undefined } = {}) {
  const go = async (p: "google" | "lovable") => {
    const destination = returnTo ? `${window.location.origin}/login?redirect=${encodeURIComponent(returnTo)}` : window.location.origin;
    const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: destination });
    if (r.error) toast.error(r.error.message ?? "Sign-in failed");
    else if (!r.redirected) window.location.href = returnTo ? `/login?redirect=${encodeURIComponent(returnTo)}` : "/dashboard";
  };
  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="w-full rounded-full" onClick={() => go("google")}>Continue with Google</Button>
      <button type="button" className="lovable-auth-button w-full" onClick={() => go("lovable")}>Continue with Lovable</button>
      <div className="flex items-center gap-3 py-2 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
    </div>
  );
}
