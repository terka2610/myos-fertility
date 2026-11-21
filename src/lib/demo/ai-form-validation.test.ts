import { describe, expect, it } from "vitest";
import {
  runDeterministicValidation,
  validateAIResponse,
  isProtectedField,
  getFormDefinition,
} from "./ai-form-validation";

describe("AI form validation", () => {
  it("runs strict required, date, option and identifier checks", () => {
    const form = getFormDefinition("SHP-017")!;
    const issues = runDeterministicValidation(form, {
      shipmentId: "bad",
      sampleId: "bad",
      reconciliationResult: "Pending",
      reconciledAt: "not-a-date",
    });

    expect(issues.some((issue) => issue.fieldName === "shipmentId")).toBe(true);
    expect(issues.some((issue) => issue.fieldName === "reconciliationResult")).toBe(true);
    expect(issues.some((issue) => issue.fieldName === "reconciledAt")).toBe(true);
  });

  it("validates AI JSON and blocks protected-field corrections", () => {
    const form = getFormDefinition("SHP-001")!;
    const issues = validateAIResponse(
      JSON.stringify({
        issues: [
          {
            fieldName: "destination",
            detectedIssue: "Destination may need review.",
            suggestedCorrection: "Cryogenic Storage",
            explanation: "The text is consistent with storage.",
            confidence: 0.82,
          },
          {
            fieldName: "sampleId",
            detectedIssue: "The sample ID is uncertain.",
            suggestedCorrection: "SMP-9999",
            explanation: "A possible correction was inferred.",
            confidence: 0.91,
          },
          {
            fieldName: "unknownField",
            detectedIssue: "Unknown.",
            suggestedCorrection: "Change",
            explanation: "This field is not in the form.",
            confidence: 0.99,
          },
        ],
      }),
      form,
    );

    expect(issues).toHaveLength(2);
    expect(issues.find((issue) => issue.fieldName === "destination")?.manualReviewRequired).toBe(
      false,
    );
    expect(issues.find((issue) => issue.fieldName === "sampleId")?.manualReviewRequired).toBe(true);
  });

  it("rejects malformed AI responses", () => {
    const form = getFormDefinition("SHP-001")!;
    expect(() =>
      validateAIResponse(
        JSON.stringify({
          issues: [
            {
              fieldName: "destination",
              detectedIssue: "",
              suggestedCorrection: null,
              explanation: "missing issue text",
              confidence: 2,
            },
          ],
        }),
        form,
      ),
    ).toThrow();
  });

  it("protects identifiers, patient aliases and custody fields", () => {
    const form = getFormDefinition("SHP-011")!;
    expect(isProtectedField("sampleId", form)).toBe(true);
    expect(isProtectedField("sealId", form)).toBe(true);
    expect(isProtectedField("patientAlias", form)).toBe(true);
    expect(isProtectedField("handoverAt", form)).toBe(true);
  });
});
