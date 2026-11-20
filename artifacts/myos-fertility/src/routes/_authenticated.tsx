import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, Stethoscope, BookOpen, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Brand, Disclosure } from "@/components/myos/Brand";
import { linkLegacyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated")({ component: AppShell });

const NAV = [
  { to: "/twin", label: "Twins & specialists", icon: LayoutDashboard },
  { to: "/twin/provider", label: "My twin", icon: Stethoscope },
  { to: "/resources", label: "Resources", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AppShell() {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  useEffect(() => { if (!loading && !user && location.pathname !== "/login") nav({ to: "/login", search: { redirect: location.href }, replace: true }); }, [loading, user, nav, location.href, location.pathname]);
  useEffect(() => { if (user) linkLegacyAccount().catch(() => {}); }, [user?.id]);
  if (loading || !user) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Opening your space…</div>;
  return (
    <div className="min-h-screen bg-background">
      <Disclosure />
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex shrink-0 items-center gap-2">
            <Brand to="/" />
            {(location.pathname === "/twin/provider" || location.pathname === "/twin/doctor") && (
              <span className="text-sm font-medium text-muted-foreground">Provider</span>
            )}
          </div>
          <nav className="hidden items-center gap-1 text-sm md:flex">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link key={to} to={to} activeOptions={{ exact: to === "/twin" }} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" activeProps={{ className: "bg-secondary !text-foreground" }}>
                <Icon className="h-4 w-4" />{label}
              </Link>
            ))}
          </nav>
          <button onClick={async () => { await signOut(); nav({ to: "/" }); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span></button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 text-sm md:hidden">
          {NAV.map(({ to, label }) => <Link key={to} to={to} activeOptions={{ exact: to === "/twin" }} className="whitespace-nowrap rounded-full px-3 py-1 text-muted-foreground" activeProps={{ className: "bg-secondary !text-foreground" }}>{label}</Link>)}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8"><Outlet /></main>
    </div>
  );
}
