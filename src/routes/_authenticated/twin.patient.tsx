import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PatientIntake } from "@/components/twin/PatientIntake";

export const Route = createFileRoute("/_authenticated/twin/patient")({
  head: () => ({ meta: [{ title: "Patient intake — MYOS twin" }, { name: "description", content: "A short intake so the doctor's twin can adapt its answers." }, { property: "og:title", content: "MYOS patient intake" }, { property: "og:description", content: "Tell the twin how to talk to you." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: PatientPage,
});

function PatientPage() {
  const nav = useNavigate();
  return <PatientIntake onSaved={(id) => nav({ to: "/twin", search: { patient: id } })} />;
}
