import { createFileRoute } from "@tanstack/react-router";
import { ProgramPage } from "@/components/myos/ProgramPage";

export const Route = createFileRoute("/programs/ivf-care")({
  head: () => ({ meta: [
    { title: "IVF Care — MYOS Fertility" },
    { name: "description", content: "Understand each stage of your IVF cycle with an AI fertility companion, for patients and partners." },
    { property: "og:title", content: "IVF Care — MYOS Fertility" },
    { property: "og:description", content: "Stage-by-stage IVF education with safety-first escalation." },
  ] }),
  component: () => (
    <ProgramPage slug="ivf-care" title="IVF Care" intro="One public program for anyone going through IVF and the partners who support them. Join directly — no access code needed."
      steps={[
        { t: "Evaluation & planning", d: "What AMH, AFC and FSH tell you — and what they can't predict." },
        { t: "Ovarian stimulation", d: "Injections, bloating, mood and monitoring scans." },
        { t: "Trigger & egg retrieval", d: "Timing, sedation, transport and recovery." },
        { t: "Fertilization & transfer", d: "Embryo development, luteal support and the two-week wait." },
        { t: "Results & next steps", d: "Making sense of outcomes, setbacks and emotional support." },
      ]} />
  ),
});
