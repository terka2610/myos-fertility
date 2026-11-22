import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_DOCUMENT_FORMS } from "./sample-transfer.ts";
import {
  isProtectedField,
  runDeterministicValidation,
  validateAIResponse,
} from "./ai-form-validation.ts";

test("local validation catches missing and malformed fields", () => {
  const form = SAMPLE_DOCUMENT_FORMS.find((candidate) => candidate.id === "CLI-001");
  assert.ok(form);

  const missing = runDeterministicValidation(form, {});
  assert.ok(missing.some((issue) => issue.detectedIssue.includes("required")));

  const values = Object.fromEntries(form.fields.map((field) => [field.key, "demo"]));
  const datetime = form.fields.find((field) => field.type === "datetime-local");
  assert.ok(datetime);
  values[datetime.key] = "2026-02-30T25:91";

  const invalid = runDeterministicValidation(form, values);
  assert.ok(invalid.some((issue) => issue.fieldName === datetime.key && issue.detectedIssue.includes("valid date")));
});

test("patient, consent, custody, and seal fields are protected", () => {
  const form = SAMPLE_DOCUMENT_FORMS.find((candidate) => candidate.id === "SHP-011");
  assert.ok(form);

  assert.equal(isProtectedField("sampleId", form), true);
  assert.equal(isProtectedField("handoverLocation", form), true);
  assert.equal(isProtectedField("staffMember", form), false);
});

test("AI output cannot apply protected values or modify unknown fields", () => {
  const form = SAMPLE_DOCUMENT_FORMS.find((candidate) => candidate.id === "CLI-001");
  assert.ok(form);
  const result = validateAIResponse(JSON.stringify({
    issues: [
      {
        fieldName: "destination",
        detectedIssue: "Destination may be inconsistent.",
        suggestedCorrection: "Cryogenic Storage",
        explanation: "Synthetic demo context.",
        confidence: 0.82,
      },
      {
        fieldName: "sampleId",
        detectedIssue: "Identifier is uncertain.",
        suggestedCorrection: "SMP-9999",
        explanation: "Protected identifier.",
        confidence: 0.95,
      },
      {
        fieldName: "unknownField",
        detectedIssue: "Unknown field.",
        suggestedCorrection: "Ignore",
        explanation: "Not in this form.",
        confidence: 1,
      },
    ],
  }), form);

  assert.equal(result.length, 2);
  assert.equal(result.find((issue) => issue.fieldName === "sampleId")?.suggestedCorrection, null);
  assert.equal(result.find((issue) => issue.fieldName === "sampleId")?.manualReviewRequired, true);
  assert.equal(result.find((issue) => issue.fieldName === "destination")?.manualReviewRequired, false);
});
