import { describe, expect, it } from "vitest";
import {
  PATIENT_TREATMENTS,
  currentStatus,
  patientAssistantReply,
  withLiveSteps,
} from "./patient-journeys";

describe("patient journeys", () => {
  it("links every treatment cycle to the patient and reports status per cycle", () => {
    expect(PATIENT_TREATMENTS.map((t) => [t.sampleId, t.eggCount])).toEqual([
      ["SMP-0001", 8],
      ["SMP-0007", 10],
    ]);
    expect(currentStatus(PATIENT_TREATMENTS[0]!).label).toBe("On the way to storage");
    expect(currentStatus(PATIENT_TREATMENTS[1]!).label).toBe("Safely stored");
  });

  it("updates a cycle from live custody events", () => {
    const updated = withLiveSteps(PATIENT_TREATMENTS[0]!, [
      { step: "collected", recorded_at: "2026-11-19T06:00:00Z" },
      { step: "released", recorded_at: "2026-11-19T07:10:00Z" },
      { step: "in_transit", recorded_at: "2026-11-19T08:00:00Z" },
      { step: "arrived_storage", recorded_at: "2026-11-19T09:30:00Z" },
      { step: "stored", recorded_at: "2026-11-19T10:00:00Z" },
    ]);
    expect(currentStatus(updated).label).toBe("Safely stored");
    expect(updated.steps.find((s) => s.step === "consent_recorded")?.at).toBeNull();
  });

  it("routes a request to use stored eggs to the fertility clinic", () => {
    const reply = patientAssistantReply("I want to use my eggs now", PATIENT_TREATMENTS);
    expect(reply).toContain("contact your Fertility Centre");
    expect(reply).toContain("release request");
  });

  it("answers where and how many, and sends fees to storage", () => {
    expect(patientAssistantReply("Where are my eggs?", PATIENT_TREATMENTS)).toContain(
      "On the way to storage",
    );
    expect(patientAssistantReply("How many eggs do I have?", PATIENT_TREATMENTS)).toContain(
      "10 eggs",
    );
    expect(patientAssistantReply("Who handles storage fees?", PATIENT_TREATMENTS)).toContain(
      "Cryogenic Storage",
    );
  });

  it("never gives medical advice", () => {
    expect(
      patientAssistantReply("What are my chances of pregnancy?", PATIENT_TREATMENTS),
    ).toContain("can't give medical advice");
  });
});
