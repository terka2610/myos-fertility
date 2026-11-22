import { useEffect, useId, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatSampleTimestamp } from "@/components/clinic/SampleRegistryTable";
import { readSupabaseJourney } from "@/lib/samples/supabase.functions";
import {
  DEMO_PATIENT,
  MYOS_WEBSITE,
  PATIENT_LEAFLETS,
  PATIENT_TREATMENTS,
  signedDocuments,
  currentStatus,
  patientAssistantReply,
  withLiveSteps,
  type PatientTreatment,
} from "@/lib/demo/patient-journeys";

const TONE_CLASSES = {
  done: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200",
  moving:
    "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200",
  waiting: "border-border bg-muted text-muted-foreground",
} as const;

const SUGGESTED_QUESTIONS = [
  "I want to use my eggs. What should I do?",
  "Where are my eggs now?",
  "How many eggs are stored?",
  "Who do I contact about storage fees?",
];

interface ChatMessage {
  from: "patient" | "assistant";
  text: string;
}

function formatDate(value: string | null) {
  return value ? formatSampleTimestamp(value).text : "Not yet";
}

export function PatientJourneyView() {
  const [treatments, setTreatments] = useState<PatientTreatment[]>(PATIENT_TREATMENTS);
  const [liveConnected, setLiveConnected] = useState(false);
  const [selectedId, setSelectedId] = useState(PATIENT_TREATMENTS[0]!.sampleId);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      from: "assistant",
      text: "Hi, I can tell you where your eggs are and who to contact. I can't give medical advice.",
    },
  ]);
  const questionId = useId();

  // Refresh the live cycle from the shared custody record.
  useEffect(() => {
    let cancelled = false;
    const liveIds = PATIENT_TREATMENTS.filter((treatment) => treatment.live).map(
      (treatment) => treatment.sampleId,
    );
    void Promise.all(
      liveIds.map((sampleId) =>
        readSupabaseJourney({ data: { sampleId } }).then((result) => ({ sampleId, result })),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        setTreatments((previous) =>
          previous.map((treatment) => {
            const match = results.find((entry) => entry.sampleId === treatment.sampleId);
            return match?.result.connected
              ? withLiveSteps(treatment, match.result.custodyEvents)
              : treatment;
          }),
        );
        setLiveConnected(results.some((entry) => entry.result.connected));
      })
      .catch(() => {
        if (import.meta.env.DEV) console.warn("Live patient journey unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(
    () => treatments.find((treatment) => treatment.sampleId === selectedId) ?? treatments[0]!,
    [selectedId, treatments],
  );

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((previous) => [
      ...previous,
      { from: "patient", text: trimmed },
      { from: "assistant", text: patientAssistantReply(trimmed, treatments) },
    ]);
    setQuestion("");
  }

  return (
    <div className="space-y-6" aria-label="Patient view">
      <Card className="rounded-[1.5rem] border-0 bg-card shadow-soft">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6 md:p-8">
          <div>
            <p className="text-sm text-muted-foreground">Your fertility preservation</p>
            <h2 className="mt-1 text-3xl">{DEMO_PATIENT.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              All your treatments are linked to your unique ID.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Unique ID</p>
            <p className="font-mono text-2xl font-semibold">{DEMO_PATIENT.id}</p>
            <Badge variant="secondary" className="mt-2">
              Simulated patient view
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[1.5rem] border-0 bg-card shadow-soft">
        <CardHeader className="p-6 pb-2 md:p-8 md:pb-3">
          <CardTitle className="text-2xl">Your treatments</CardTitle>
          <p className="text-sm text-muted-foreground">Select a treatment to see its journey.</p>
        </CardHeader>
        <CardContent className="p-6 pt-2 md:p-8 md:pt-3">
          <ul aria-label="Treatments" className="grid gap-3">
            {treatments.map((treatment) => {
              const status = currentStatus(treatment);
              const active = treatment.sampleId === selected.sampleId;
              return (
                <li key={treatment.sampleId}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedId(treatment.sampleId)}
                    className={`grid w-full gap-2 rounded-xl border p-4 text-left transition-colors sm:grid-cols-[1.4fr_1fr_0.6fr_1.4fr_auto] sm:items-center ${
                      active
                        ? "border-primary bg-secondary/60"
                        : "border-border hover:bg-secondary/40"
                    }`}
                  >
                    <span>
                      <span className="block font-medium">{treatment.title}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {treatment.sampleId}
                        {treatment.example ? " · example" : ""}
                      </span>
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Retrieved {formatDate(treatment.retrievedAt)}
                    </span>
                    <span className="text-sm">
                      <b>{treatment.eggCount}</b> eggs
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {treatment.clinic.name} → {treatment.storage.name}
                    </span>
                    <Badge variant="outline" className={TONE_CLASSES[status.tone]}>
                      {status.label}
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[1.5rem] border-0 bg-card shadow-soft">
          <CardHeader className="p-6 pb-2 md:p-8 md:pb-3">
            <CardTitle className="text-2xl">{selected.title}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {selected.eggCount} {selected.specimen.toLowerCase()} · {selected.sampleId}
              {selected.live
                ? liveConnected
                  ? " · updated from the shared sample record"
                  : " · simulated"
                : " · example"}
            </p>
          </CardHeader>
          <CardContent className="p-6 pt-2 md:p-8 md:pt-3">
            <ol aria-label="Treatment journey" className="space-y-3">
              {selected.steps.map((step) => (
                <li key={step.step} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 size-3 shrink-0 rounded-full ${
                      step.at ? "bg-emerald-500" : "bg-muted-foreground/30"
                    }`}
                  />
                  <span className="min-w-0">
                    <span className={`block font-medium ${step.at ? "" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                    <span className="text-sm text-muted-foreground">{formatDate(step.at)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem] border-0 bg-card shadow-soft">
          <CardHeader className="p-6 pb-2 md:p-8 md:pb-3">
            <CardTitle className="text-2xl">Who to contact</CardTitle>
            <p className="text-sm text-muted-foreground">
              The right team for each question about your eggs.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 pt-2 md:p-8 md:pt-3">
            {[selected.clinic, selected.storage].map((facility) => (
              <div key={facility.role} className="rounded-xl border border-border p-4">
                <p className="font-medium">{facility.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{facility.helpsWith}</p>
              </div>
            ))}
            <p className="text-sm text-muted-foreground">
              Reach both through MYOS at{" "}
              <a
                href={MYOS_WEBSITE.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {MYOS_WEBSITE.label}
              </a>
              , or ask MYOS below.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-[1.5rem] border-0 bg-card shadow-soft">
          <CardHeader className="p-6 pb-2 md:p-8 md:pb-3">
            <CardTitle className="text-2xl">Your signed documents</CardTitle>
            <p className="text-sm text-muted-foreground">
              Transport and storage consents for {selected.title.toLowerCase()}, signed during your
              counselling at the clinic. View only.
            </p>
          </CardHeader>
          <CardContent className="p-6 pt-2 md:p-8 md:pt-3">
            <ul aria-label="Signed documents" className="grid gap-2">
              {signedDocuments(selected).map((document) => (
                <li
                  key={document.title}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{document.title}</span>
                    <span className="text-sm text-muted-foreground">
                      Signed {formatDate(document.signedAt)} · {document.signedWith}
                    </span>
                  </span>
                  <Badge variant="outline" className={TONE_CLASSES.done}>
                    Signed
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem] border-0 bg-card shadow-soft">
          <CardHeader className="p-6 pb-2 md:p-8 md:pb-3">
            <CardTitle className="text-2xl">Patient information leaflets</CardTitle>
            <p className="text-sm text-muted-foreground">
              Everything you need to know about how your eggs are cared for, from collection to
              long-term storage.
            </p>
          </CardHeader>
          <CardContent className="p-6 pt-2 md:p-8 md:pt-3">
            <ul aria-label="Patient information leaflets" className="grid gap-2">
              {PATIENT_LEAFLETS.map((leaflet) => (
                <li key={leaflet.href}>
                  <a
                    href={leaflet.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <FileText aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block font-medium">{leaflet.title}</span>
                      <span className="text-sm text-muted-foreground">{leaflet.summary}</span>
                    </span>
                    <span className="ml-auto shrink-0 text-xs font-medium text-muted-foreground">
                      PDF
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[1.5rem] border-0 bg-card shadow-soft">
        <CardHeader className="p-6 pb-2 md:p-8 md:pb-3">
          <CardTitle className="text-2xl">Ask MYOS</CardTitle>
          <p className="text-sm text-muted-foreground">
            Questions about your eggs and who to contact. No medical advice.
          </p>
        </CardHeader>
        <CardContent className="space-y-4 p-6 pt-2 md:p-8 md:pt-3">
          <div aria-live="polite" aria-label="Conversation" className="grid gap-2">
            {messages.map((message, index) => (
              <p
                key={index}
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                  message.from === "patient"
                    ? "justify-self-end bg-primary text-primary-foreground"
                    : "justify-self-start bg-secondary"
                }`}
              >
                {message.text}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => ask(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              ask(question);
            }}
          >
            <label htmlFor={questionId} className="sr-only">
              Your question
            </label>
            <Input
              id={questionId}
              value={question}
              maxLength={300}
              placeholder="Type your question"
              onChange={(event) => setQuestion(event.target.value)}
            />
            <Button type="submit" className="rounded-full" disabled={!question.trim()}>
              Ask
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
