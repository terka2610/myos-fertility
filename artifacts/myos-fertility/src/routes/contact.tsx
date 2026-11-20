import { createFileRoute } from "@tanstack/react-router";
import { PublicHeader, PublicFooter } from "@/components/myos/PublicHeader";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [
    { title: "Contact — MYOS Fertility" },
    { name: "description", content: "Get in touch with the MYOS team." },
    { property: "og:title", content: "Contact MYOS" },
    { property: "og:description", content: "Questions, partnerships and clinic onboarding." },
  ] }),
  component: () => (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <h1 className="text-4xl font-semibold">Contact</h1>
        <p className="mt-4 text-muted-foreground">For clinic partnerships and questions, email the MYOS team. If you have a medical emergency, call your local emergency number.</p>
      </main>
      <PublicFooter />
    </div>
  ),
});
