import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PublicHeader, PublicFooter } from "@/components/myos/PublicHeader";

export const Route = createFileRoute("/resources")({ component: ResourcesLayout });
function ResourcesLayout() {
  return <div className="min-h-screen bg-background"><PublicHeader /><main className="mx-auto max-w-6xl px-5 py-10 md:px-10"><Outlet /></main><PublicFooter /></div>;
}