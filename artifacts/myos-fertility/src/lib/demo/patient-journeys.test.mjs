import assert from "node:assert/strict";
import test from "node:test";
import {
  PATIENT_TREATMENTS,
  currentStatus,
  isSafeLeafletPath,
  leafletUrl,
  patientAssistantReply,
  signedDocuments,
  withLiveSteps,
} from "./patient-journeys.ts";

test("treatments are synthetic and report status per cycle", () => {
  assert.deepEqual(PATIENT_TREATMENTS.map((t) => [t.sampleId, t.eggCount]), [["SMP-0001", 8], ["SMP-0007", 10]]);
  assert.ok(PATIENT_TREATMENTS.every((t) => t.live === false));
  assert.equal(currentStatus(PATIENT_TREATMENTS[0]).label, "On the way to storage");
  assert.equal(currentStatus(PATIENT_TREATMENTS[1]).label, "Safely stored");
});

test("status helper handles empty and step updates", () => {
  const empty = { ...PATIENT_TREATMENTS[0], steps: PATIENT_TREATMENTS[0].steps.map((s) => ({ ...s, at: null })) };
  assert.deepEqual(currentStatus(empty), { label: "Not started", tone: "waiting" });
  const updated = withLiveSteps(PATIENT_TREATMENTS[0], [
    { step: "collected", recorded_at: "2026-11-19T06:00:00Z" },
    { step: "stored", recorded_at: "2026-11-19T10:00:00Z" },
    { step: "bad", recorded_at: "nope" },
  ]);
  assert.equal(currentStatus(updated).label, "Safely stored");
});

test("assistant routes questions and never gives medical advice", () => {
  assert.match(patientAssistantReply("I want to use my eggs", PATIENT_TREATMENTS), /contact your Fertility Centre/);
  assert.match(patientAssistantReply("Who handles storage fees?", PATIENT_TREATMENTS), /Cryogenic Storage/);
  assert.match(patientAssistantReply("What are my chances of pregnancy?", PATIENT_TREATMENTS), /can't give medical advice/);
});

test("signed documents are labelled synthetic", () => {
  assert.ok(signedDocuments(PATIENT_TREATMENTS[0]).every((d) => d.signedWith.includes("synthetic")));
});

test("leaflet URLs use base URL and reject unsafe paths", () => {
  assert.equal(leafletUrl("/", "leaflets/renewing-your-storage.pdf"), "/leaflets/renewing-your-storage.pdf");
  assert.equal(leafletUrl("/app", "leaflets/a.pdf"), "/app/leaflets/a.pdf");
  assert.equal(isSafeLeafletPath("https://evil.example/x.pdf"), false);
  assert.equal(isSafeLeafletPath("leaflets/../x.pdf"), false);
  assert.throws(() => leafletUrl("/", "//evil/x.pdf"));
});
