import { forwardRef } from "react";
import { ArrowRight, FileText, Info, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Party, View } from "@/components/scene3d";
import {
  FERTILITY_CENTRE_NAME,
  SAMPLE_DOCUMENT_FORMS,
  SAMPLE_TRANSFER_GATES,
  type DemoFormDefinition,
  type DemoRecordStatus,
  type SampleTransferState,
} from "@/lib/demo/sample-transfer";

export const PLACE_OWNER: Record<Party, string | null> = {
  centre: FERTILITY_CENTRE_NAME,
  transport: "Cryo Transport",
  storage: "Cryogenic Storage",
  patient: null,
};

export const PLACE_LABEL: Record<View, string> = {
  network: "Overview",
  centre: "Fertility clinic",
  transport: "Cryo transport",
  storage: "Cryogenic storage",
  patient: "Patient",
};

/** Scene feature id to the existing form it opens. Null means not connected in this demo. */
export const FEATURE_FORM: Record<string, string | null> = {
  documents: "CLI-001",
  consent: "CON-004",
  calendar: "SHP-001",
  gps: "SHP-012",
  freezer: "SHP-012",
  handover: "SHP-011",
  acceptance: "SHP-016",
  placement: "INV-005",
  readings: null,
  updates: null,
  whereis: null,
};

export const NOT_CONNECTED: Record<string, string> = {
  readings:
    "Tank telemetry and alerts are not connected. No sensor data is read; anything shown in the scene is illustrative.",
  updates:
    "Patient WhatsApp delivery is not connected. No messages are sent. Scene chat bubbles are a scripted illustration.",
  whereis:
    "Patients cannot query status on WhatsApp in this demo. The stage below is derived from saved demo records only.",
};

export function statusText(status: DemoRecordStatus | undefined) {
  if (status === "complete") return "Done";
  if (status === "draft") return "Draft saved";
  return "Not started";
}

const formsFor = (owner: string) => SAMPLE_DOCUMENT_FORMS.filter((f) => f.owner === owner);

export function journeyStage(state: SampleTransferState) {
  const done = (id: string) => state.records[id]?.status === "complete";
  if (state.closedAt) return { progress: 1, text: "Transfer closed" };
  if (done("INV-005") || done("SHP-016")) return { progress: 1, text: "Received at storage" };
  if (done("SHP-012") || done("SHP-014")) return { progress: 0.7, text: "In transport" };
  if (done("SHP-011")) return { progress: 0.35, text: "Handed to courier" };
  if (done("SHP-001")) return { progress: 0.03, text: "Pickup booked" };
  return { progress: 0, text: "At the fertility clinic" };
}

export function placeCounts(state: SampleTransferState, owner: string) {
  const list = formsFor(owner);
  return { done: list.filter((f) => state.records[f.id]?.status === "complete").length, total: list.length };
}

export function buildFeatureStatus(state: SampleTransferState): Record<string, string> {
  const s = (id: string) => `${id.split(":")[0]} ${statusText(state.records[id]?.status)}`;
  const centre = placeCounts(state, FERTILITY_CENTRE_NAME);
  return {
    documents: `${centre.done} of ${centre.total} centre documents done`,
    consent: `${s("CON-004")} · voice fill is draft entry only`,
    calendar: s("SHP-001"),
    gps: "Open GPS monitor · separate demo feed",
    freezer: "Timer not connected · demo",
    handover: s("SHP-011"),
    acceptance: s("SHP-016"),
    placement: s("INV-005"),
    readings: "Not connected · illustrative",
    updates: "Open Cryo demo chat · no WhatsApp delivery",
    whereis: journeyStage(state).text,
  };
}

const chip: Record<DemoRecordStatus, string> = {
  "not-started": "bg-muted text-muted-foreground",
  draft: "bg-gold-soft text-warning-foreground",
  complete: "bg-emerald-100 text-emerald-800",
};

interface Props {
  place: View;
  state: SampleTransferState;
  hydrated: boolean;
  notice: string | null;
  canClose: boolean;
  onOpenForm: (form: DemoFormDefinition) => void;
  onCloseTransfer: () => void;
  onPlace: (view: View) => void;
}

export const JourneyWorkArea = forwardRef<HTMLDivElement, Props>(function JourneyWorkArea(
  { place, state, hydrated, notice, canClose, onOpenForm, onCloseTransfer, onPlace },
  ref,
) {
  const stage = journeyStage(state);
  const owner = place === "network" ? null : PLACE_OWNER[place];
  const forms = owner ? formsFor(owner) : [];
  const counts = owner ? placeCounts(state, owner) : null;
  const nextForm = forms.find((form) => state.records[form.id]?.status !== "complete");
  const nextPlace: Partial<Record<View, View>> = { centre: "transport", transport: "storage" };
  const stepNumber = place === "centre" ? 1 : place === "transport" ? 2 : place === "storage" ? 3 : null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      aria-labelledby="work-area-title"
      data-testid="work-area"
      className="scroll-mt-24 rounded-[1.75rem] bg-card p-6 shadow-soft outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Work area</p>
          <h3 id="work-area-title" className="mt-1 text-4xl">
            {PLACE_LABEL[place]}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline" className="rounded-full border-transparent bg-pink-soft">
            Stage: {stage.text}
          </Badge>
          {counts && (
            <Badge variant="outline" className="rounded-full" data-testid="text-place-count">
              {counts.done} of {counts.total} done
            </Badge>
          )}
        </div>
      </div>

      {notice && (
        <p role="status" className="mt-5 flex gap-3 rounded-2xl bg-gold-soft p-4 text-sm leading-6 text-warning-foreground">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-medium">Not connected · demo. </span>
            {notice}
          </span>
        </p>
      )}

      {stepNumber && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-hero p-4 md:p-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">
              Step {stepNumber} of 3 · {PLACE_LABEL[place]}
            </p>
            <p className="mt-1 font-medium">
              {nextForm
                ? `Next: ${nextForm.reference} · ${nextForm.title}`
                : place === "storage" && canClose
                  ? "All required records are complete."
                  : place === "storage"
                    ? "Review the storage records below."
                    : "This stop is complete. Continue to the next location."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {nextForm ? "Open the next form to continue." : "Use the journey steps above to move between locations."}
            </p>
          </div>
          {nextForm ? (
            <Button
              type="button"
              className="shrink-0 rounded-full"
              disabled={!hydrated}
              data-testid="button-next-action"
              onClick={() => onOpenForm(nextForm)}
            >
              Open {nextForm.reference}
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : place === "storage" && canClose && !state.closedAt ? (
            <Button
              type="button"
              className="shrink-0 rounded-full"
              disabled={!hydrated}
              data-testid="button-next-action"
              onClick={onCloseTransfer}
            >
              Close transfer
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : nextPlace[place] ? (
            <Button
              type="button"
              variant="outline"
              className="shrink-0 rounded-full"
              data-testid="button-next-action"
              onClick={() => onPlace(nextPlace[place]!)}
            >
              Continue to {PLACE_LABEL[nextPlace[place]!]}
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      )}

      {(place === "transport" || place === "patient" || place === "storage" || place === "centre") && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {place === "transport" && (
            <Button asChild variant="outline" className="rounded-full">
              <a href={`${import.meta.env.BASE_URL}gps`}>Open GPS monitor</a>
            </Button>
          )}
          <Button asChild variant="outline" className="rounded-full">
            <a href={`${import.meta.env.BASE_URL}chat`}>Open Cryo demo chat</a>
          </Button>
          <p className="text-xs text-muted-foreground">
            GPS and chat are separate demo tools, not live patient records or WhatsApp delivery.
          </p>
        </div>
      )}

      {place === "network" && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["centre", "transport", "storage", "patient"] as Party[]).map((p) => {
            const o = PLACE_OWNER[p];
            const c = o ? placeCounts(state, o) : null;
            return (
              <button
                key={p}
                type="button"
                data-testid={`button-overview-${p}`}
                onClick={() => onPlace(p)}
                className="rounded-2xl border border-border p-4 text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="block font-display text-2xl">{PLACE_LABEL[p]}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {c ? `${c.done} of ${c.total} documents done` : "Updates and status"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {forms.length > 0 && (
        <ul className="mt-6 divide-y divide-border rounded-2xl border border-border">
          {forms.map((form) => {
            const rec = state.records[form.id]!;
            return (
              <li key={form.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{form.reference}</span> · {form.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{rec.handoff}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${chip[rec.status]}`}>
                    {statusText(rec.status)}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={!hydrated}
                    data-testid={`button-open-${form.id}`}
                    aria-label={`Open ${form.reference} ${form.title} Document Form`}
                    onClick={() => onOpenForm(form)}
                  >
                    <FileText aria-hidden />
                    Open
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {place === "storage" && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary/60 p-4 text-sm">
          <span>
            {state.closedAt
              ? "Transfer closed."
              : canClose
                ? "Both closure gates are complete."
                : `Closure needs ${SAMPLE_TRANSFER_GATES.map((g) => `${g.acceptanceId.replace(":return", " return")} and ${g.reconciliationId.replace(":return", " return")}`).join("; ")} marked done.`}
          </span>
          <Button
            type="button"
            className="rounded-full"
            disabled={!hydrated || !canClose || Boolean(state.closedAt)}
            onClick={onCloseTransfer}
            data-testid="button-close-transfer-area"
          >
            {state.closedAt ? "Transfer Closed" : "Close Transfer"}
          </Button>
        </div>
      )}

      {place === "patient" && (
        <div className="mt-6 space-y-3 text-sm leading-6">
          <p>
            Synthetic patient: <span className="font-medium">{state.records["CLI-001"]?.fields["patientAlias"] || "Patient 01"}</span>.
            Not linked to any real patient record.
          </p>
          <p className="flex gap-2 text-muted-foreground">
            <Info aria-hidden className="mt-1 size-4 shrink-0" />
            Patient WhatsApp updates are not connected in this demo. Registration is held by the fertility centre.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={!hydrated}
            onClick={() => onOpenForm(SAMPLE_DOCUMENT_FORMS.find((f) => f.id === "CLI-001")!)}
            data-testid="button-open-patient-registration"
          >
            <FileText aria-hidden />
            Open CLI-001 Patient registration
          </Button>
        </div>
      )}

      {state.activity.length > 0 && (
        <p className="mt-5 text-xs text-muted-foreground" aria-live="polite">
          Latest activity: {state.activity[0]!.message}
        </p>
      )}
    </div>
  );
});
