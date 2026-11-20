import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { SpecialistsGrid } from "@/components/twin/SpecialistsGrid";

export const Route = createFileRoute("/_authenticated/twin/specialists")({
  validateSearch: z.object({ patient: z.string().uuid().optional() }),
  head: () => ({ meta: [{ title: "Meet your fertility specialists — MYOS" }, { name: "description", content: "Choose a fertility specialist and meet their digital twin." }, { property: "og:title", content: "Meet your fertility specialists" }, { property: "og:description", content: "Doctors' digital twins, 24/7, in your language." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SpecialistsPage,
});


function SpecialistsPage() {
  return <SpecialistsGrid patient={Route.useSearch().patient} />;
}
