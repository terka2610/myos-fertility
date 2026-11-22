import type { SampleRegistryRecord } from "./types";

// Fully synthetic demo data. Do not populate this fixture with real patient information.
export const SYNTHETIC_SAMPLE_RECORDS = [
  {
    displayId: "SMP-0001",
    patientDisplayName: "Fictional demo patient",
    sampleType: "Oocyte",
    currentState: "Returned to Clinic A",
    storageSite: "Synthetic cryogenic storage site",
    latestEventAt: "2026-11-20T08:30:00.000Z",
  },
] satisfies readonly SampleRegistryRecord[];
