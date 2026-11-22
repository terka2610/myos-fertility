import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatSampleTimestamp } from "@/components/clinic/SampleRegistryTable";
import type { Feature, Party, View } from "@/components/scene3d";
import { SceneStage } from "@/components/clinic/journey/SceneStage";
import {
  FEATURE_FORM,
  JourneyWorkArea,
  NOT_CONNECTED,
  PLACE_LABEL,
  PLACE_OWNER,
  buildFeatureStatus,
  journeyStage,
  placeCounts,
} from "@/components/clinic/journey/JourneyWorkArea";
import { VoiceFormFill } from "@/components/clinic/VoiceFormFill";
import { AIFormValidation } from "@/components/clinic/AIFormValidation";
import {
  createInitialSampleTransferState,
  parseSampleTransferState,
  SAMPLE_DOCUMENT_FORMS,
  SAMPLE_TRANSFER_ENTITIES,
  SAMPLE_TRANSFER_FLOW,
  SAMPLE_TRANSFER_GATES,
  SAMPLE_TRANSFER_HANDOFFS,
  SAMPLE_TRANSFER_STORAGE_KEY,
  type DemoFormDefinition,
  type DemoRecordStatus,
  type SampleTransferState,
} from "@/lib/demo/sample-transfer";

const statusClassNames: Record<DemoRecordStatus, string> = {
  "not-started": "border-transparent bg-muted text-muted-foreground",
  draft: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  complete:
    "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
};

function statusLabel(status: DemoRecordStatus) {
  if (status === "complete") return "Done";
  if (status === "draft") return "Draft Saved";
  return "Not Started";
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "Not updated";
  return formatSampleTimestamp(value).text;
}

type ActivityStatus = "completed" | "draft" | "pending" | "error" | "information";

const activityStatusStyles: Record<
  ActivityStatus,
  { label: string; badge: string; marker: string }
> = {
  completed: {
    label: "Completed",
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
    marker: "bg-emerald-500",
  },
  draft: {
    label: "Draft saved",
    badge:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
    marker: "bg-amber-500",
  },
  pending: {
    label: "Pending action",
    badge:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
    marker: "bg-amber-500",
  },
  error: {
    label: "Validation error",
    badge:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-900/30 dark:text-red-200",
    marker: "bg-red-500",
  },
  information: {
    label: "Information",
    badge: "border-border bg-muted text-muted-foreground",
    marker: "bg-muted-foreground",
  },
};

function getActivityStatus(message: string): ActivityStatus {
  if (/\b(error|failed|failure|exception|invalid|blocked)\b/i.test(message)) return "error";
  if (/\b(draft saved)\b/i.test(message)) return "draft";
  if (/\b(pending(?: action)?|action required)\b/i.test(message)) return "pending";
  if (
    /\b(marked as completed|document completed|transfer (?:closed|finalized|completed))\b/i.test(
      message,
    )
  ) {
    return "completed";
  }
  return "information";
}

export function SampleTransferDemo({ initialPlace = "centre" }: { initialPlace?: View }) {
  const [state, setState] = useState<SampleTransferState>(createInitialSampleTransferState);
  const [hydrated, setHydrated] = useState(false);
  const [canPersist, setCanPersist] = useState(true);
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(null);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  const [formDraft, setFormDraft] = useState<{
    fields: Record<string, string>;
    handoff: string;
    label: string;
    notes: string;
  }>({ fields: {}, handoff: "", label: "", notes: "" });
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [place, setPlace] = useState<View>(initialPlace);
  const [notice, setNotice] = useState<string | null>(null);
  const workAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SAMPLE_TRANSFER_STORAGE_KEY);
      if (saved) setState(parseSampleTransferState(saved));
    } catch (error) {
      console.error("Could not load local synthetic transfer demo state", error);
      setCanPersist(false);
      setPersistenceMessage(
        "Saved information could not be loaded. You can continue in this tab, but changes may not persist.",
      );
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !canPersist) return;
    try {
      window.localStorage.setItem(
        SAMPLE_TRANSFER_STORAGE_KEY,
        JSON.stringify({ version: 2, ...state }),
      );
    } catch (error) {
      console.error("Could not save local synthetic transfer demo state", error);
      setCanPersist(false);
      setPersistenceMessage(
        "Browser storage is unavailable. Changes will remain only for this tab.",
      );
    }
  }, [canPersist, hydrated, state]);

  const forms = SAMPLE_DOCUMENT_FORMS;
  const activeForm = forms.find((form) => form.id === activeFormId) ?? null;
  const activeRecord = activeForm ? state.records[activeForm.id] : null;
  const canCloseTransfer = SAMPLE_TRANSFER_GATES.every(
    (gate) =>
      state.records[gate.acceptanceId]?.status === "complete" &&
      state.records[gate.reconciliationId]?.status === "complete",
  );
  const outstandingRequirements = SAMPLE_TRANSFER_GATES.flatMap((gate) => [
    gate.acceptanceId,
    gate.reconciliationId,
  ])
    .map((id) => forms.find((form) => form.id === id)!)
    .filter((form) => state.records[form.id]?.status !== "complete");

  function openForm(form: DemoFormDefinition) {
    const record = state.records[form.id];
    if (!record) {
      throw new Error(`Sample transfer record ${form.id} is missing.`);
    }
    setFormDraft({
      fields: { ...record.fields },
      handoff: record.handoff,
      label: record.label,
      notes: record.notes,
    });
    setFormMessage(null);
    setActiveFormId(form.id);
  }

  function saveForm(status: "draft" | "complete") {
    if (!activeForm) return;
    const missingFields = activeForm.fields
      .filter((field) => field.required && !formDraft.fields[field.key]?.trim())
      .map((field) => field.label);
    if (status === "complete" && missingFields.length > 0) {
      setFormMessage(`Complete the required fields: ${missingFields.join(", ")}.`);
      return;
    }
    if (status === "complete" && formDraft.fields["reconciliationResult"] === "Pending") {
      setFormMessage("A pending reconciliation cannot be marked complete.");
      return;
    }

    const timestamp = new Date().toISOString();
    const statusText = status === "draft" ? "Draft saved" : "Marked as Completed";
    const direction = activeForm.direction ? ` (${activeForm.direction})` : "";
    setState((previous) => ({
      ...previous,
      records: {
        ...previous.records,
        [activeForm.id]: {
          ...previous.records[activeForm.id]!,
          label: formDraft.label.trim(),
          notes: formDraft.notes.trim(),
          fields: { ...formDraft.fields },
          handoff: formDraft.handoff,
          status,
          updatedAt: timestamp,
        },
      },
      activity: [
        {
          id: `${timestamp}-${activeForm.id}-${previous.activity.length}`,
          at: timestamp,
          message: `${activeForm.reference} ${activeForm.title}${direction}: ${statusText}`,
        },
        ...previous.activity,
      ].slice(0, 100),
      closedAt: activeForm.direction && status !== "complete" ? null : previous.closedAt,
    }));
    setActiveFormId(null);
  }

  function closeTransfer() {
    if (!canCloseTransfer || state.closedAt) return;
    const timestamp = new Date().toISOString();
    setState((previous) => ({
      ...previous,
      closedAt: timestamp,
      activity: [
        {
          id: `${timestamp}-transfer-closed`,
          at: timestamp,
          message: "Transfer closed",
        },
        ...previous.activity,
      ].slice(0, 100),
    }));
  }

  const documentForms = forms;

  const featureStatus = useMemo(() => buildFeatureStatus(state), [state]);
  const stage = journeyStage(state);
  const placeStatus = useMemo(() => {
    const out: Partial<Record<Party, string>> = {};
    for (const p of ["centre", "transport", "storage"] as Party[]) {
      const c = placeCounts(state, PLACE_OWNER[p]!);
      out[p] = `${c.done} of ${c.total} documents done`;
    }
    out.patient = "Updates not connected · demo";
    return out;
  }, [state]);

  function choosePlace(view: View) {
    setNotice(null);
    setPlace(view);
  }

  function focusWorkArea() {
    workAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    workAreaRef.current?.focus({ preventScroll: true });
  }

  function openFeature(feature: Feature) {
    setPlace(feature.party);
    if (feature.id === "gps" || feature.id === "updates") {
      window.location.assign(`${import.meta.env.BASE_URL}${feature.id === "gps" ? "gps" : "chat"}`);
      return;
    }
    const formId = FEATURE_FORM[feature.id];
    const form = formId ? forms.find((f) => f.id === formId) : undefined;
    if (form && hydrated) {
      setNotice(null);
      openForm(form);
      return;
    }
    setNotice(NOT_CONNECTED[feature.id] ?? "This feature is not connected in the demo.");
    focusWorkArea();
  }

  return (
    <section className="space-y-7" aria-labelledby="transfer-demo-title">
      <header className="max-w-3xl">
        <h2 id="transfer-demo-title" className="sr-only">
          <span className="sr-only">Interactive sample journey</span>
        </h2>
        {persistenceMessage && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {persistenceMessage}
          </p>
        )}
        {!hydrated && (
          <p role="status" aria-live="polite" className="mt-3 text-sm text-muted-foreground">
            Loading saved records…
          </p>
        )}
      </header>

      <div className="grid gap-7">
        <div className="order-1 rounded-2xl border border-border bg-card p-3 shadow-soft md:p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">Journey steps</p>
            <p className="text-xs text-muted-foreground">Start at the clinic, then follow transport to storage.</p>
          </div>
          <nav aria-label="Choose a journey step" className="flex flex-wrap gap-2">
            {(["centre", "transport", "storage", "network", "patient"] as View[]).map((v) => (
              <Button
                key={v}
                type="button"
                size="sm"
                variant={place === v ? "default" : "outline"}
                aria-pressed={place === v}
                aria-label={v === "centre" ? "Step 1: Fertility clinic" : v === "transport" ? "Step 2: Cryo transport" : v === "storage" ? "Step 3: Cryogenic storage" : PLACE_LABEL[v]}
                className={`rounded-full ${v === "centre" || v === "transport" || v === "storage" ? "min-h-10 px-4" : "min-h-9"}`}
                data-testid={`button-place-${v}`}
                onClick={() => choosePlace(v)}
              >
                {(v === "centre" || v === "transport" || v === "storage") && (
                  <span aria-hidden="true" className={`grid size-5 place-items-center rounded-full text-[11px] ${place === v ? "bg-primary-foreground/15" : "bg-muted"}`}>
                    {v === "centre" ? "1" : v === "transport" ? "2" : "3"}
                  </span>
                )}
                {PLACE_LABEL[v]}
              </Button>
            ))}
          </nav>
        </div>

        {place !== "network" && (
          <div className="order-2 md:order-3">
            <JourneyWorkArea
              ref={workAreaRef}
              place={place}
              state={state}
              hydrated={hydrated}
              notice={notice}
              canClose={canCloseTransfer}
              onOpenForm={openForm}
              onCloseTransfer={closeTransfer}
              onPlace={choosePlace}
            />
          </div>
        )}

        <div className="order-3 h-[min(36dvh,320px)] min-h-[280px] md:order-2 md:h-[min(48dvh,480px)] md:min-h-[360px]" data-testid="journey-scene">
          <SceneStage
            view={place}
            onViewChange={(v) => {
              setNotice(null);
              setPlace(v);
            }}
            onFeatureOpen={openFeature}
            onOpen={() => focusWorkArea()}
            status={placeStatus}
            featureStatus={featureStatus}
            progress={stage.progress}
            showNav={false}
            overlaysHidden={Boolean(activeFormId)}
            paused={Boolean(activeFormId)}
          />
        </div>
      </div>

      <details className="group rounded-[1.5rem] border border-border p-5 md:p-6" data-testid="details-full-register">
        <summary className="cursor-pointer list-none font-display text-2xl">
          Full lifecycle, document register and activity
          <span className="ml-3 align-middle text-sm font-sans text-muted-foreground group-open:hidden">Show</span>
          <span className="ml-3 hidden align-middle text-sm font-sans text-muted-foreground group-open:inline">Hide</span>
        </summary>
        <div className="mt-8 space-y-12">
      <section aria-label="Operational entities" className="grid gap-4 md:grid-cols-3">
        {SAMPLE_TRANSFER_ENTITIES.map((entity) => (
          <Card key={entity.name} className="rounded-2xl border-0 bg-card shadow-soft">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-xl">{entity.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-1 text-sm text-muted-foreground">
              Location: {entity.site}
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="rounded-[1.5rem] border-0 bg-card shadow-soft">
        <CardHeader className="p-6 pb-3 md:p-8 md:pb-4">
          <CardTitle className="text-2xl">Transfer Lifecycle</CardTitle>
          <p className="text-sm text-muted-foreground">
            Clinic-to-storage transfer and later return journey.
          </p>
        </CardHeader>
        <CardContent className="space-y-8 p-6 pt-2 md:p-8 md:pt-3">
          <div className="-mx-2 overflow-x-auto px-2 pb-2 md:mx-0 md:px-0 xl:overflow-visible">
            <ol
              className="flex w-max min-w-full flex-nowrap items-center justify-between gap-1"
              aria-label="Fertility Centre to storage and return journey"
            >
              {SAMPLE_TRANSFER_FLOW.map((step, index) => (
                <li
                  key={`${step.type}-${step.label}-${index}`}
                  className="flex shrink-0 items-center gap-1"
                >
                  <span
                    className={
                      step.type === "milestone"
                        ? "whitespace-nowrap rounded-xl border border-border bg-secondary/60 px-2 py-2 text-xs font-medium sm:text-sm md:text-xs"
                        : "whitespace-nowrap rounded-full bg-pink-soft px-2 py-2 text-xs font-medium sm:px-4 sm:text-sm md:px-2 md:text-xs"
                    }
                  >
                    {step.label}
                  </span>
                  {index < SAMPLE_TRANSFER_FLOW.length - 1 && (
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  )}
                </li>
              ))}
            </ol>
          </div>
          <div
            className={`rounded-2xl border p-6 ${
              canCloseTransfer
                ? "border-border bg-background"
                : "border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">
                  {state.closedAt
                    ? "Transfer Closed"
                    : canCloseTransfer
                      ? "Ready to Close Transfer"
                      : "Action Required to Complete Transfer"}
                </p>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {canCloseTransfer
                    ? "All required documents and handover steps are complete."
                    : "Some required documents or handover steps are still pending. Complete the outstanding items to finalize this transfer."}
                </p>
              </div>
              <Button
                type="button"
                onClick={closeTransfer}
                disabled={!hydrated || !canCloseTransfer || Boolean(state.closedAt)}
                className="rounded-full"
              >
                {state.closedAt ? "Transfer Closed" : "Close Transfer"}
              </Button>
            </div>
            {!canCloseTransfer && (
              <ul
                aria-label="Outstanding transfer requirements"
                className="mt-5 grid gap-3 border-t border-amber-300/70 pt-4 sm:grid-cols-2 dark:border-amber-800"
              >
                {outstandingRequirements.map((form) => (
                  <li
                    key={form.id}
                    className="flex items-start justify-between gap-3 rounded-xl bg-background/80 p-3 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{form.reference}</span>
                      {" · "}
                      {form.title}
                      {form.direction && ` (${form.direction})`}
                    </span>
                    <RecordStatus status={state.records[form.id]!.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {SAMPLE_TRANSFER_GATES.map((gate) => {
              const acceptanceForm = forms.find((form) => form.id === gate.acceptanceId)!;
              const reconciliationForm = forms.find((form) => form.id === gate.reconciliationId)!;
              const complete =
                state.records[gate.acceptanceId]?.status === "complete" &&
                state.records[gate.reconciliationId]?.status === "complete";
              return (
                <Card key={gate.id} className="rounded-2xl border border-border shadow-none">
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-xl">{gate.title}</CardTitle>
                      <Badge
                        variant="outline"
                        className={
                          complete
                            ? statusClassNames.complete
                            : "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
                        }
                      >
                        {complete ? "Done" : "Pending"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 p-5 pt-1">
                    <GateRecordButton
                      form={acceptanceForm}
                      record={state.records[acceptanceForm.id]!}
                      disabled={!hydrated}
                      onOpen={() => openForm(acceptanceForm)}
                    />
                    <GateRecordButton
                      form={reconciliationForm}
                      record={state.records[reconciliationForm.id]!}
                      disabled={!hydrated}
                      onOpen={() => openForm(reconciliationForm)}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="documentation-list-title">
        <div className="mb-5">
          <h3 id="documentation-list-title" className="text-3xl">
            Document Register
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            References and names follow the supplied draft register. Transfer routes are configured
            for this example and should be confirmed before operational use.
          </p>
        </div>
        <div className="space-y-6">
          {SAMPLE_TRANSFER_ENTITIES.map((entity) => {
            const entityForms = documentForms.filter((form) => form.owner === entity.name);
            return (
              <Card
                key={entity.name}
                className="overflow-hidden rounded-[1.5rem] border-0 bg-card shadow-soft"
              >
                <CardHeader className="p-6 pb-3 md:p-7 md:pb-4">
                  <CardTitle className="text-2xl">{entity.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">Location: {entity.site}</p>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table className="min-w-[900px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Document</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead>Handoff</TableHead>
                            <TableHead>Document Status</TableHead>
                            <TableHead>Last Updated</TableHead>
                            <TableHead>
                              <span className="sr-only">Form action</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entityForms.map((form) => {
                            const record = state.records[form.id]!;
                            return (
                              <TableRow key={form.id}>
                                <TableCell className="min-w-60">
                                  <span className="font-medium">{form.reference}</span>
                                  <span className="mt-1 block text-sm">{form.title}</span>
                                  {form.direction && (
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                      {form.direction === "outbound"
                                        ? "Outbound transfer"
                                        : "Return transfer"}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>{form.owner}</TableCell>
                                <TableCell className="min-w-48">{record.handoff}</TableCell>
                                <TableCell>
                                  <RecordStatus status={record.status} />
                                </TableCell>
                                <TableCell className="min-w-48 text-xs">
                                  {formatUpdatedAt(record.updatedAt)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={!hydrated}
                                    aria-label={`Open ${form.reference} ${form.title} Document Form`}
                                    onClick={() => openForm(form)}
                                  >
                                    <FileText aria-hidden="true" />
                                    Open Document Form
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Card className="rounded-[1.5rem] border-0 bg-card shadow-soft">
        <CardHeader className="p-6 pb-3 md:p-8 md:pb-4">
          <CardTitle className="text-2xl">Activity History</CardTitle>
          <p className="text-sm text-muted-foreground">
            Saved form changes and transfer closure events appear here.
          </p>
        </CardHeader>
        <CardContent className="p-6 pt-2 md:p-8 md:pt-3">
          {state.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ol aria-label="Activity History events" className="space-y-0">
              {state.activity.map((event, index) => {
                const timestamp = formatSampleTimestamp(event.at);
                const status = activityStatusStyles[getActivityStatus(event.message)];
                return (
                  <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                    <span className="relative flex w-3 shrink-0 justify-center">
                      {index < state.activity.length - 1 && (
                        <span
                          aria-hidden="true"
                          className="absolute top-3 bottom-0 w-px bg-border"
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className={`relative mt-1.5 size-2.5 rounded-full ring-4 ring-card ${status.marker}`}
                      />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{event.message}</span>
                        <Badge variant="outline" className={status.badge}>
                          {status.label}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {timestamp.dateTime ? (
                          <time dateTime={timestamp.dateTime}>{timestamp.text}</time>
                        ) : (
                          timestamp.text
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
        </div>
      </details>

      <Dialog
        open={Boolean(activeFormId)}
        onOpenChange={(open) => {
          if (!open) setActiveFormId(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {activeForm && activeRecord && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">Document Form</DialogTitle>
                <DialogDescription>
                  {activeForm.reference}
                  {activeForm.direction && ` · ${activeForm.direction} transfer`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 rounded-xl bg-secondary/60 p-4 text-sm">
                <p>
                  <span className="font-medium">Record Title:</span> {activeForm.title}
                </p>
                <p>
                  <span className="font-medium">Document Owner:</span> {activeForm.owner}
                </p>
                <p>
                  <span className="font-medium">Transfer Route:</span> {formDraft.handoff}
                </p>
                <p className="text-xs text-muted-foreground">
                  This route is configured for the example and should be confirmed before
                  operational use.
                </p>
              </div>
              <VoiceFormFill
                formId={activeForm.id}
                fields={activeForm.fields}
                notesLabel={activeForm.id === "SHP-001" ? "Transport Notes" : "Additional Notes"}
                formTitle={activeForm.title}
                currentValues={formDraft.fields}
                currentLabel={formDraft.label}
                currentNotes={formDraft.notes}
                onApply={(updates) =>
                  setFormDraft((previous) => ({
                    ...previous,
                    fields: { ...previous.fields, ...updates.fields },
                    label: updates.label ?? previous.label,
                    notes: updates.notes ?? previous.notes,
                  }))
                }
              />
              <div className="space-y-4">
                <div className="block space-y-2">
                  <Label htmlFor="demo-record-title">Record Title</Label>
                  <Input
                    id="demo-record-title"
                    maxLength={120}
                    value={formDraft.label}
                    onChange={(event) =>
                      setFormDraft((previous) => ({ ...previous, label: event.target.value }))
                    }
                  />
                </div>
                <div className="block space-y-2">
                  <Label htmlFor="demo-additional-notes">
                    {activeForm.id === "SHP-001" ? "Transport Notes" : "Additional Notes"}
                  </Label>
                  <Textarea
                    id="demo-additional-notes"
                    maxLength={1000}
                    rows={3}
                    value={formDraft.notes}
                    onChange={(event) =>
                      setFormDraft((previous) => ({ ...previous, notes: event.target.value }))
                    }
                  />
                </div>
                {activeForm.fields.map((field) => {
                  const id = `demo-field-${field.key}`;
                  const value = formDraft.fields[field.key] ?? "";
                  const updateValue = (nextValue: string) => {
                    setFormDraft((previous) => ({
                      ...previous,
                      fields: { ...previous.fields, [field.key]: nextValue },
                    }));
                  };

                  return (
                    <div key={field.key} className="block space-y-2">
                      <Label htmlFor={id}>
                        {field.label}
                        {field.required ? " *" : ""}
                      </Label>
                      {field.type === "select" ? (
                        <select
                          id={id}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          value={value}
                          onChange={(event) => updateValue(event.target.value)}
                        >
                          <option value="">Select an option</option>
                          {field.options?.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "textarea" ? (
                        <Textarea
                          id={id}
                          maxLength={1000}
                          rows={3}
                          placeholder={field.placeholder}
                          value={value}
                          onChange={(event) => updateValue(event.target.value)}
                        />
                      ) : (
                        <Input
                          id={id}
                          type={field.type}
                          maxLength={200}
                          placeholder={field.placeholder}
                          value={value}
                          onChange={(event) => updateValue(event.target.value)}
                        />
                      )}
                    </div>
                  );
                })}
                <div className="block space-y-2">
                  <Label htmlFor="demo-record-handoff">Transfer Route</Label>
                  <select
                    id="demo-record-handoff"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={formDraft.handoff}
                    onChange={(event) =>
                      setFormDraft((previous) => ({ ...previous, handoff: event.target.value }))
                    }
                  >
                    {SAMPLE_TRANSFER_HANDOFFS.map((handoff) => (
                      <option key={handoff} value={handoff}>
                        {handoff}
                      </option>
                    ))}
                  </select>
                </div>
                <AIFormValidation
                  formId={activeForm.id}
                  fields={formDraft.fields}
                  onApply={(fieldKey, correction) => {
                    if (!activeForm.fields.some((field) => field.key === fieldKey)) return;
                    setFormDraft((previous) => ({
                      ...previous,
                      fields: { ...previous.fields, [fieldKey]: correction },
                    }));
                  }}
                />
                {formMessage && (
                  <p role="alert" className="text-sm text-destructive">
                    {formMessage}
                  </p>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => saveForm("draft")}>
                  Save Draft
                </Button>
                <Button type="button" onClick={() => saveForm("complete")}>
                  Mark as Completed
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function RecordStatus({ status }: { status: DemoRecordStatus }) {
  return (
    <Badge variant="outline" className={statusClassNames[status]}>
      {statusLabel(status)}
    </Badge>
  );
}

function GateRecordButton({
  form,
  record,
  disabled,
  onOpen,
}: {
  form: DemoFormDefinition;
  record: SampleTransferState["records"][string];
  disabled: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">
            {form.reference} · {form.title}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {form.owner} · {record.handoff}
          </p>
        </div>
        <RecordStatus status={record.status} />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        disabled={disabled}
        aria-label={`Open closure checkpoint ${form.reference} ${form.title} Document Form`}
        onClick={onOpen}
      >
        Open Document Form
      </Button>
    </div>
  );
}
