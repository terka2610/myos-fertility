import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicHeader, PublicFooter } from "@/components/myos/PublicHeader";
import { TWIN_PHONE_DISPLAY, TWIN_PHONE_TEL } from "@/lib/twin/intents";

export const Route = createFileRoute("/book/tessa")({
  head: () => ({ meta: [
    { title: "Book with Dr Tessa Juras — MYOS" },
    { name: "description", content: "Request a consultation with Dr Tessa Juras's clinic team." },
    { property: "og:title", content: "Book with Dr Tessa Juras" },
    { property: "og:description", content: "Request a consultation with Dr Tessa Juras's clinic team." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: BookTessa,
});

function BookTessa() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="mx-auto max-w-xl px-5 py-16 text-center">
        <h1 className="text-5xl">Meet Dr Tessa <span className="serif-accent">in person</span></h1>
        <p className="mt-5 text-lg text-muted-foreground">Online booking is coming soon. For now, reply to our text with a few days and times that work, and the clinic team will confirm with you.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href={`sms:${TWIN_PHONE_TEL}`} className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground">Text {TWIN_PHONE_DISPLAY}</a>
          <a href={`tel:${TWIN_PHONE_TEL}`} className="rounded-full border border-primary px-6 py-3 font-medium text-primary">Call my agent</a>
        </div>
        <p className="mt-6 text-sm text-muted-foreground">Already have an account? <Link to="/login" className="underline">Sign in</Link> and use "Book a real consultation" on her twin page.</p>
      </main>
      <PublicFooter />
    </div>
  );
}
