export const FERTILITY_CENTRE_NAME = "Fertility Centre";

export const SAMPLE_TRANSFER_HANDOFFS = [
  `${FERTILITY_CENTRE_NAME} → Cryo Transport`,
  "Cryo Transport → Cryogenic Storage",
  "Cryogenic Storage → Cryo Transport",
  `Cryo Transport → ${FERTILITY_CENTRE_NAME}`,
] as const;

export type DemoRecordStatus = "not-started" | "draft" | "complete";
export type DemoFormFieldType = "text" | "date" | "datetime-local" | "select" | "textarea";

export interface DemoFormField {
  key: string;
  label: string;
  type: DemoFormFieldType;
  placeholder?: string;
  required: boolean;
  initialValue?: string;
  options?: readonly string[];
}

export interface DemoFormDefinition {
  id: string;
  reference: string;
  title: string;
  owner: string;
  handoff: string;
  fields: readonly DemoFormField[];
  direction: "outbound" | "return" | null;
}

const text = (
  key: string,
  label: string,
  placeholder: string,
  initialValue = "",
): DemoFormField => ({ key, label, type: "text", placeholder, required: true, initialValue });

const textarea = (key: string, label: string, placeholder: string): DemoFormField => ({
  key,
  label,
  type: "textarea",
  placeholder,
  required: true,
});

const dateTime = (key: string, label: string): DemoFormField => ({
  key,
  label,
  type: "datetime-local",
  required: true,
});

const date = (key: string, label: string): DemoFormField => ({
  key,
  label,
  type: "date",
  required: true,
});

const select = (key: string, label: string, options: readonly string[]): DemoFormField => ({
  key,
  label,
  type: "select",
  required: true,
  options,
});

const sampleId = () => text("sampleId", "Sample ID", "SMP-0001", "SMP-0001");
const shipmentId = () => text("shipmentId", "Shipment ID", "DEMO-SHIP-0001", "DEMO-SHIP-0001");
const staffMember = () => text("staffMember", "Staff Member", "Staff 01", "Staff 01");

export const SAMPLE_DOCUMENT_FORMS: readonly DemoFormDefinition[] = [
  {
    id: "CLI-001",
    reference: "CLI-001",
    title: "Patient registration",
    owner: FERTILITY_CENTRE_NAME,
    handoff: SAMPLE_TRANSFER_HANDOFFS[0],
    direction: null,
    fields: [
      sampleId(),
      text("patientAlias", "Patient", "Patient 01", "Patient 01"),
      text("sourceFacility", "Source Facility", FERTILITY_CENTRE_NAME, FERTILITY_CENTRE_NAME),
      text("destination", "Destination", "Cryo Transport", "Cryo Transport"),
      dateTime("registeredAt", "Registration date and time"),
      staffMember(),
    ],
  },
  {
    id: "CON-004",
    reference: "CON-004",
    title: "Storage consent",
    owner: FERTILITY_CENTRE_NAME,
    handoff: SAMPLE_TRANSFER_HANDOFFS[0],
    direction: null,
    fields: [
      sampleId(),
      text("consentVersion", "Consent Version", "Version reference"),
      text("sourceFacility", "Source Facility", FERTILITY_CENTRE_NAME, FERTILITY_CENTRE_NAME),
      text("destination", "Storage Destination", "Cryogenic Storage", "Cryogenic Storage"),
      date("recordedAt", "Record Date"),
      staffMember(),
    ],
  },
  {
    id: "CON-007",
    reference: "CON-007",
    title: "Transfer consent",
    owner: FERTILITY_CENTRE_NAME,
    handoff: SAMPLE_TRANSFER_HANDOFFS[0],
    direction: null,
    fields: [
      sampleId(),
      text("consentVersion", "Consent Version", "Version reference"),
      text("sourceFacility", "Source Facility", FERTILITY_CENTRE_NAME, FERTILITY_CENTRE_NAME),
      text("destination", "Transfer Destination", "Cryo Transport", "Cryo Transport"),
      date("recordedAt", "Record Date"),
      staffMember(),
    ],
  },
  {
    id: "LAB-013",
    reference: "LAB-013",
    title: "Sample release authorisation",
    owner: FERTILITY_CENTRE_NAME,
    handoff: SAMPLE_TRANSFER_HANDOFFS[0],
    direction: null,
    fields: [
      sampleId(),
      text("sourceFacility", "Source Facility", FERTILITY_CENTRE_NAME, FERTILITY_CENTRE_NAME),
      text("destination", "Release Destination", "Cryo Transport", "Cryo Transport"),
      dateTime("releasedAt", "Release record date and time"),
      staffMember(),
    ],
  },
  {
    id: "SHP-001",
    reference: "SHP-001",
    title: "Shipment booking",
    owner: "Cryo Transport",
    handoff: SAMPLE_TRANSFER_HANDOFFS[0],
    direction: null,
    fields: [
      shipmentId(),
      sampleId(),
      text("sourceFacility", "Source Facility", FERTILITY_CENTRE_NAME, FERTILITY_CENTRE_NAME),
      text("destination", "Destination", "Cryo Transport", "Cryo Transport"),
      dateTime("bookedAt", "Booking date and time"),
      staffMember(),
    ],
  },
  {
    id: "SHP-011",
    reference: "SHP-011",
    title: "Chain-of-custody",
    owner: "Cryo Transport",
    handoff: SAMPLE_TRANSFER_HANDOFFS[0],
    direction: null,
    fields: [
      shipmentId(),
      sampleId(),
      text("handoverLocation", "Handover Location", "Handover location"),
      dateTime("handoverAt", "Handover date and time"),
      staffMember(),
      text("sealId", "Seal ID", "DEMO-SEAL-0001", "DEMO-SEAL-0001"),
    ],
  },
  {
    id: "SHP-012",
    reference: "SHP-012",
    title: "Condition monitoring",
    owner: "Cryo Transport",
    handoff: SAMPLE_TRANSFER_HANDOFFS[1],
    direction: null,
    fields: [
      shipmentId(),
      sampleId(),
      dateTime("monitoredAt", "Monitoring date and time"),
      textarea("conditionNote", "Condition Notes", "Enter transfer condition notes"),
      staffMember(),
    ],
  },
  {
    id: "SHP-014",
    reference: "SHP-014",
    title: "Handover/collection confirmation",
    owner: "Cryo Transport",
    handoff: SAMPLE_TRANSFER_HANDOFFS[2],
    direction: null,
    fields: [
      shipmentId(),
      sampleId(),
      text("handoverLocation", "Handover Location", "Storage handover location"),
      dateTime("handoverAt", "Handover/collection date and time"),
      staffMember(),
      text("sealId", "Seal ID", "DEMO-SEAL-0001", "DEMO-SEAL-0001"),
    ],
  },
  {
    id: "INV-003",
    reference: "INV-003",
    title: "Sample receipt",
    owner: "Cryogenic Storage",
    handoff: SAMPLE_TRANSFER_HANDOFFS[1],
    direction: null,
    fields: [
      shipmentId(),
      sampleId(),
      text("sourceFacility", "Source Facility", "Cryo Transport", "Cryo Transport"),
      text("receivingFacility", "Receiving Facility", "Cryogenic Storage", "Cryogenic Storage"),
      dateTime("receivedAt", "Receipt date and time"),
      staffMember(),
      text("sealId", "Seal ID", "DEMO-SEAL-0001", "DEMO-SEAL-0001"),
    ],
  },
  {
    id: "INV-005",
    reference: "INV-005",
    title: "Tank/location register",
    owner: "Cryogenic Storage",
    handoff: SAMPLE_TRANSFER_HANDOFFS[1],
    direction: null,
    fields: [
      sampleId(),
      text("storageSite", "Storage Site", "Cryogenic Storage", "Cryogenic Storage"),
      text("tankLocation", "Tank / Location", "DEMO-TANK-01", "DEMO-TANK-01"),
      dateTime("storedAt", "Storage record date and time"),
      staffMember(),
    ],
  },
  {
    id: "SHP-016",
    reference: "SHP-016",
    title: "Receiving facility acceptance",
    owner: "Cryogenic Storage",
    handoff: SAMPLE_TRANSFER_HANDOFFS[1],
    direction: "outbound",
    fields: [
      shipmentId(),
      sampleId(),
      text("sourceFacility", "Source Facility", "Cryo Transport", "Cryo Transport"),
      text("receivingFacility", "Receiving Facility", "Cryogenic Storage", "Cryogenic Storage"),
      dateTime("acceptedAt", "Acceptance record date and time"),
      staffMember(),
      text("sealId", "Seal ID", "DEMO-SEAL-0001", "DEMO-SEAL-0001"),
    ],
  },
  {
    id: "SHP-017",
    reference: "SHP-017",
    title: "Sample and seal reconciliation",
    owner: "Cryogenic Storage",
    handoff: SAMPLE_TRANSFER_HANDOFFS[1],
    direction: "outbound",
    fields: [
      shipmentId(),
      sampleId(),
      text("expectedSealId", "Expected Seal ID", "DEMO-SEAL-0001", "DEMO-SEAL-0001"),
      text("observedSealId", "Observed Seal ID", "DEMO-SEAL-0001", "DEMO-SEAL-0001"),
      select("reconciliationResult", "Reconciliation Result", [
        "Matched",
        "Discrepancy recorded",
        "Pending",
      ]),
      dateTime("reconciledAt", "Reconciliation date and time"),
      staffMember(),
    ],
  },
  {
    id: "SHP-016:return",
    reference: "SHP-016",
    title: "Receiving facility acceptance — return transfer",
    owner: "Cryogenic Storage",
    handoff: SAMPLE_TRANSFER_HANDOFFS[3],
    direction: "return",
    fields: [
      shipmentId(),
      sampleId(),
      text("sourceFacility", "Source Facility", "Cryo Transport", "Cryo Transport"),
      text("receivingFacility", "Receiving Facility", FERTILITY_CENTRE_NAME, FERTILITY_CENTRE_NAME),
      dateTime("acceptedAt", "Acceptance record date and time"),
      staffMember(),
      text("sealId", "Seal ID", "DEMO-SEAL-0001", "DEMO-SEAL-0001"),
    ],
  },
  {
    id: "SHP-017:return",
    reference: "SHP-017",
    title: "Sample and seal reconciliation — return transfer",
    owner: "Cryogenic Storage",
    handoff: SAMPLE_TRANSFER_HANDOFFS[3],
    direction: "return",
    fields: [
      shipmentId(),
      sampleId(),
      text("expectedSealId", "Expected Seal ID", "DEMO-SEAL-0001", "DEMO-SEAL-0001"),
      text("observedSealId", "Observed Seal ID", "DEMO-SEAL-0001", "DEMO-SEAL-0001"),
      select("reconciliationResult", "Reconciliation Result", [
        "Matched",
        "Discrepancy recorded",
        "Pending",
      ]),
      dateTime("reconciledAt", "Reconciliation date and time"),
      staffMember(),
    ],
  },
];

export const SAMPLE_TRANSFER_ENTITIES = [
  { name: FERTILITY_CENTRE_NAME, site: FERTILITY_CENTRE_NAME },
  { name: "Cryo Transport", site: "Cryo Transport" },
  { name: "Cryogenic Storage", site: "Cryogenic Storage" },
] as const;

export const SAMPLE_TRANSFER_FLOW = [
  { type: "location", label: FERTILITY_CENTRE_NAME },
  { type: "location", label: "Cryo Transport" },
  { type: "location", label: "Cryogenic Storage" },
  { type: "milestone", label: "Patient requests return after several years" },
  { type: "location", label: "Cryo Transport" },
  { type: "location", label: FERTILITY_CENTRE_NAME },
] as const;

export const SAMPLE_TRANSFER_GATES = [
  {
    id: "outbound",
    title: "Outbound transfer closure",
    acceptanceId: "SHP-016",
    reconciliationId: "SHP-017",
  },
  {
    id: "return",
    title: "Return transfer closure",
    acceptanceId: "SHP-016:return",
    reconciliationId: "SHP-017:return",
  },
] as const;

export interface DemoFormRecord {
  label: string;
  notes: string;
  handoff: string;
  fields: Record<string, string>;
  status: DemoRecordStatus;
  updatedAt: string | null;
}

export interface SampleTransferActivity {
  id: string;
  message: string;
  at: string;
}

export interface SampleTransferState {
  records: Record<string, DemoFormRecord>;
  activity: SampleTransferActivity[];
  closedAt: string | null;
}

export const SAMPLE_TRANSFER_STORAGE_KEY = "myos.synthetic-sample-transfer.v1";

export function createInitialSampleTransferState(): SampleTransferState {
  const records: Record<string, DemoFormRecord> = {};
  for (const form of SAMPLE_DOCUMENT_FORMS) {
    records[form.id] = {
      label: "",
      notes: "",
      handoff: form.handoff,
      fields: Object.fromEntries(form.fields.map((field) => [field.key, field.initialValue ?? ""])),
      status: "not-started",
      updatedAt: null,
    };
  }
  return { records, activity: [], closedAt: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStatus(value: unknown): value is DemoRecordStatus {
  return value === "not-started" || value === "draft" || value === "complete";
}

const LEGACY_HANDOFFS: Record<string, string> = {
  "Clinic A -> Cryoport": SAMPLE_TRANSFER_HANDOFFS[0],
  "Cryoport -> Storage": SAMPLE_TRANSFER_HANDOFFS[1],
  "Storage -> Cryoport": SAMPLE_TRANSFER_HANDOFFS[2],
  "Cryoport -> Clinic A": SAMPLE_TRANSFER_HANDOFFS[3],
};

const LEGACY_DEFAULT_HANDOFFS: Record<string, string> = {
  "CLI-001": "Clinic A -> Cryoport",
  "CON-004": "Clinic A -> Cryoport",
  "CON-007": "Clinic A -> Cryoport",
  "LAB-013": "Cryoport -> Clinic A",
  "SHP-001": "Clinic A -> Cryoport",
  "SHP-011": "Cryoport -> Storage",
  "SHP-012": "Storage -> Cryoport",
  "SHP-014": "Cryoport -> Clinic A",
  "INV-003": "Cryoport -> Storage",
  "INV-005": "Cryoport -> Storage",
  "SHP-016": "Storage -> Cryoport",
  "SHP-017": "Storage -> Cryoport",
};

function migrateLegacyText(value: string): string {
  const handoff = LEGACY_HANDOFFS[value];
  if (handoff) return handoff;
  return value
    .replace(/\bClinic A\b/g, FERTILITY_CENTRE_NAME)
    .replace(/Al Noor Fertility Centre — Abu Dhabi/g, FERTILITY_CENTRE_NAME)
    .replace(/\bFertility Clinic\b/g, FERTILITY_CENTRE_NAME)
    .replace(/\bCryoport(?: Transport)?\b/g, "Cryo Transport")
    .replace("Synthetic transfer closure completed", "Transfer closed");
}

function migrateLegacyFieldValue(value: string): string {
  const updated = migrateLegacyText(value);
  const aliases: Record<string, string> = {
    [`${FERTILITY_CENTRE_NAME} (demo)`]: FERTILITY_CENTRE_NAME,
    "Cryogenic Storage (demo)": "Cryogenic Storage",
    "Cryo Transport (demo)": "Cryo Transport",
    "Fictional demo patient": "Patient 01",
    "Demo staff": "Staff 01",
  };
  return aliases[updated] ?? updated;
}

function parseSavedRecord(value: unknown, form: DemoFormDefinition | undefined): DemoFormRecord {
  if (
    !isRecord(value) ||
    typeof value["label"] !== "string" ||
    typeof value["notes"] !== "string" ||
    typeof value["handoff"] !== "string" ||
    !isStatus(value["status"]) ||
    !(value["updatedAt"] === null || typeof value["updatedAt"] === "string")
  ) {
    throw new Error("A saved synthetic demo form is invalid.");
  }

  const fields: Record<string, string> = {};
  if (form) {
    for (const field of form.fields) fields[field.key] = field.initialValue ?? "";
  }
  const savedFields = value["fields"];
  if (savedFields !== undefined) {
    if (!isRecord(savedFields)) throw new Error("Saved document-specific fields are invalid.");
    for (const [key, savedValue] of Object.entries(savedFields)) {
      if (typeof savedValue !== "string") {
        throw new Error(`Saved demo field ${key} is invalid.`);
      }
      fields[key] = migrateLegacyFieldValue(savedValue);
    }
  }

  const hasSpecificFields =
    form?.fields.every((field) => Boolean(fields[field.key]?.trim())) ?? false;
  const status =
    form && value["status"] === "complete" && !hasSpecificFields ? "draft" : value["status"];
  const legacyHandoff = LEGACY_DEFAULT_HANDOFFS[form?.id ?? ""];
  const handoff =
    form && legacyHandoff === value["handoff"] ? form.handoff : migrateLegacyText(value["handoff"]);

  return {
    label: migrateLegacyText(value["label"]),
    notes: migrateLegacyText(value["notes"]),
    handoff,
    fields,
    status,
    updatedAt: value["updatedAt"],
  };
}

export function parseSampleTransferState(serialized: string): SampleTransferState {
  const parsed: unknown = JSON.parse(serialized);
  if (
    !isRecord(parsed) ||
    (parsed["version"] !== 1 && parsed["version"] !== 2) ||
    !isRecord(parsed["records"]) ||
    !Array.isArray(parsed["activity"]) ||
    !(parsed["closedAt"] === null || typeof parsed["closedAt"] === "string")
  ) {
    throw new Error("Saved synthetic sample demo data has an unsupported format.");
  }

  const savedRecords = parsed["records"];
  const records = createInitialSampleTransferState().records;
  const formsById = new Map(SAMPLE_DOCUMENT_FORMS.map((form) => [form.id, form]));
  for (const [id, value] of Object.entries(savedRecords)) {
    records[id] = parseSavedRecord(value, formsById.get(id));
  }

  const legacyRecordMigrations: readonly [string, string][] = [
    ["checkpoint:receiving-acceptance", "SHP-016"],
    ["checkpoint:reconciliation", "SHP-017"],
  ];
  for (const [legacyId, currentId] of legacyRecordMigrations) {
    const legacy = records[legacyId];
    const current = records[currentId];
    if (legacy && current && current.status === "not-started" && legacy.status !== "not-started") {
      records[currentId] = {
        ...current,
        label: current.label || legacy.label,
        notes: current.notes || legacy.notes,
        status: "draft",
        updatedAt: current.updatedAt || legacy.updatedAt,
      };
    }
  }

  const activity: SampleTransferActivity[] = parsed["activity"].map((item) => {
    if (
      !isRecord(item) ||
      typeof item["id"] !== "string" ||
      typeof item["message"] !== "string" ||
      typeof item["at"] !== "string"
    ) {
      throw new Error("Saved synthetic sample demo timeline is invalid.");
    }
    return {
      id: item["id"],
      message: migrateLegacyText(item["message"]),
      at: item["at"],
    };
  });

  const checkpointsComplete = SAMPLE_TRANSFER_GATES.every(
    (gate) =>
      records[gate.acceptanceId]?.status === "complete" &&
      records[gate.reconciliationId]?.status === "complete",
  );
  return {
    records,
    activity: activity.slice(0, 100),
    closedAt: checkpointsComplete ? parsed["closedAt"] : null,
  };
}
