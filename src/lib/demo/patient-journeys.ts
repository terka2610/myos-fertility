// Synthetic patient view for the demo. Every treatment cycle is linked to one patient identifier.
// Cycle 2 is SMP-0001, whose live status comes from Supabase custody events when available.

export interface PatientFacility {
  role: "Fertility Centre" | "Cryogenic Storage" | "Cryo Transport";
  name: string;
  helpsWith: string;
}

export interface PatientJourneyStep {
  step: string;
  label: string;
  at: string | null;
}

export interface PatientTreatment {
  sampleId: string;
  title: string;
  retrievedAt: string;
  eggCount: number;
  specimen: string;
  clinic: PatientFacility;
  storage: PatientFacility;
  steps: PatientJourneyStep[];
  /** True when this cycle's steps can be refreshed from live custody data. */
  live: boolean;
  example: boolean;
}

export const DEMO_PATIENT = { id: "PT-0142", name: "Patient 01" } as const;

export const MYOS_WEBSITE = { label: "health.myos.sk", href: "https://health.myos.sk" } as const;

export const PATIENT_FACILITIES = {
  clinic: {
    role: "Fertility Centre",
    name: "Fertility Centre",
    helpsWith: "Treatment questions and any request to use your stored eggs",
  },
  storage: {
    role: "Cryogenic Storage",
    name: "Cryogenic Storage",
    helpsWith: "Storage renewal, fees and storage certificates",
  },
} satisfies Record<string, PatientFacility>;

// Patient-friendly wording for the custody steps used by the shared sample record.
export const PATIENT_STEP_LABELS: Record<string, string> = {
  collected: "Eggs retrieved at the clinic",
  consent_recorded: "Storage consent recorded",
  released: "Handed to the transport team",
  in_transit: "On the way to storage",
  arrived_storage: "Arrived at the storage facility",
  stored: "Frozen and safely stored",
  release_requested: "Release requested",
  in_transit_return: "On the way back to the clinic",
  received: "Received at the clinic",
  verified: "Checked and verified at the clinic",
};

const OUTBOUND_STEPS = [
  "collected",
  "consent_recorded",
  "released",
  "in_transit",
  "arrived_storage",
  "stored",
];

function stepsFrom(times: Partial<Record<string, string>>): PatientJourneyStep[] {
  return OUTBOUND_STEPS.map((step) => ({
    step,
    label: PATIENT_STEP_LABELS[step]!,
    at: times[step] ?? null,
  }));
}

export const PATIENT_TREATMENTS: PatientTreatment[] = [
  {
    sampleId: "SMP-0001",
    title: "Egg freezing · cycle 2",
    retrievedAt: "2026-11-19T06:00:00Z",
    eggCount: 8,
    specimen: "Oocytes",
    clinic: PATIENT_FACILITIES.clinic,
    storage: PATIENT_FACILITIES.storage,
    steps: stepsFrom({
      collected: "2026-11-19T06:00:00Z",
      consent_recorded: "2026-11-19T06:30:00Z",
      released: "2026-11-19T07:10:00Z",
      in_transit: "2026-11-19T08:00:00Z",
    }),
    live: true,
    example: false,
  },
  {
    sampleId: "SMP-0007",
    title: "Egg freezing · cycle 1",
    retrievedAt: "2026-03-01T06:00:00Z",
    eggCount: 10,
    specimen: "Oocytes",
    clinic: PATIENT_FACILITIES.clinic,
    storage: PATIENT_FACILITIES.storage,
    steps: stepsFrom({
      collected: "2026-03-01T06:00:00Z",
      consent_recorded: "2026-03-01T06:40:00Z",
      released: "2026-03-02T05:30:00Z",
      in_transit: "2026-03-02T05:45:00Z",
      arrived_storage: "2026-03-02T07:15:00Z",
      stored: "2026-03-02T08:00:00Z",
    }),
    live: false,
    example: true,
  },
];

/** Replace a treatment's steps with live custody events (first time each step was recorded). */
export function withLiveSteps(
  treatment: PatientTreatment,
  rows: readonly Record<string, unknown>[],
): PatientTreatment {
  const times: Record<string, string> = {};
  const events = rows
    .flatMap((row) =>
      typeof row["step"] === "string" &&
      typeof row["recorded_at"] === "string" &&
      Number.isFinite(Date.parse(row["recorded_at"]))
        ? [{ step: row["step"], at: row["recorded_at"] }]
        : [],
    )
    .sort((first, second) => Date.parse(first.at) - Date.parse(second.at));
  if (events.length === 0) return treatment;
  for (const event of events) times[event.step] ??= event.at;
  return { ...treatment, steps: stepsFrom(times) };
}

export function currentStatus(treatment: PatientTreatment): {
  label: string;
  tone: "done" | "moving" | "waiting";
} {
  const reached = treatment.steps.filter((step) => step.at);
  const last = reached.at(-1);
  if (!last) return { label: "Not started", tone: "waiting" };
  if (last.step === "stored") return { label: "Safely stored", tone: "done" };
  if (last.step === "in_transit" || last.step === "released") {
    return { label: "On the way to storage", tone: "moving" };
  }
  return { label: last.label, tone: "waiting" };
}

/** Rule-based helper for patient questions. It routes people to the right facility and never gives medical advice. */
export function patientAssistantReply(question: string, treatments: PatientTreatment[]): string {
  const text = question.toLowerCase();
  const clinic = PATIENT_FACILITIES.clinic;
  const storage = PATIENT_FACILITIES.storage;

  if (
    /\b(success rate|chance|pregnan|ivf result|safe for me|side effect|medicat|dose|pain|risk|symptom)/.test(
      text,
    )
  ) {
    return `I can't give medical advice. Please ask your doctor at the ${clinic.name}.`;
  }
  if (
    /\b(use|thaw|release|transfer|get|take|withdraw|need)\b.*\b(egg|eggs|sample|samples|embryo)/.test(
      text,
    ) ||
    /\buse my\b/.test(text)
  ) {
    return `To use your stored eggs, contact your ${clinic.name}. They check your consent and send the release request to the storage facility for you, so you don't need to contact storage yourself. The leaflet "Your Eggs, Safely Stored" explains the steps.`;
  }
  if (/\b(renew|fee|fees|pay|bill|invoice|extend|certificate|how long can)\b/.test(text)) {
    return `For storage renewal, fees or certificates, contact the ${storage.name}. The leaflet "Renewing the Storage of Your Eggs" explains how renewal works.`;
  }
  if (/\b(thaw|frozen|transport|mixed|other patients)\b/.test(text)) {
    return `Your eggs stay frozen during transport and are never mixed with anyone else's: each one is individually identified and tracked. The leaflet "Your Eggs, Safely Stored" explains the whole journey.`;
  }
  if (/\b(how many|number of|count)\b/.test(text)) {
    return treatments
      .map((treatment) => `${treatment.title}: ${treatment.eggCount} eggs`)
      .join(". ")
      .concat(".");
  }
  if (/\b(where|status|stored|safe|location|arrive|when)\b/.test(text)) {
    return treatments
      .map(
        (treatment) =>
          `${treatment.title} (${treatment.sampleId}): ${currentStatus(treatment).label}`,
      )
      .join(". ")
      .concat(". Open a treatment above to see every step with its date and time.");
  }
  if (/\b(contact|call|phone|number|whatsapp|talk)\b/.test(text)) {
    return `Your ${clinic.name} helps with treatment and using your eggs. The ${storage.name} helps with storage, renewal and fees. You can reach both through MYOS at ${MYOS_WEBSITE.label}.`;
  }
  return `I'm not sure about that one. Your ${clinic.name} can help, or visit ${MYOS_WEBSITE.label}. You can also ask me where your eggs are, how many are stored, or how to use them.`;
}

export interface SignedDocument {
  title: string;
  signedAt: string;
  signedWith: string;
}

/**
 * Consents relevant to transport and storage that the patient signed during counselling at the
 * clinic. Read-only: they come from scanned or automated clinic records and cannot be changed here.
 */
export function signedDocuments(treatment: PatientTreatment): SignedDocument[] {
  const signedAt =
    treatment.steps.find((step) => step.step === "consent_recorded")?.at ?? treatment.retrievedAt;
  return [
    "Consent to freeze and store eggs",
    "Consent to transfer eggs to the storage facility",
    "Storage agreement: duration and renewal",
    "Consent on what happens to eggs if storage ends",
  ].map((title) => ({ title, signedAt, signedWith: treatment.clinic.name }));
}

/** Patient information leaflets (draft PDFs served from public/leaflets). */
export const PATIENT_LEAFLETS = [
  {
    title: "Your Eggs, Safely Stored",
    summary:
      "The journey from egg retrieval to transport and storage, and how to use your eggs later.",
    href: "/leaflets/your-eggs-safely-stored.pdf",
  },
  {
    title: "Renewing the Storage of Your Eggs",
    summary: "What happens when your storage period is due for renewal, and how to track it.",
    href: "/leaflets/renewing-your-storage.pdf",
  },
] as const;
