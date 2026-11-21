import { z } from "zod";
import { SAMPLE_DOCUMENT_FORMS, type DemoFormDefinition } from "./sample-transfer";

export type AIValidationIssue = {
  fieldName: string;
  detectedIssue: string;
  suggestedCorrection: string | null;
  explanation: string;
  confidence: number;
  manualReviewRequired: boolean;
};

export type AIValidationResult = {
  enabled: boolean;
  issues: AIValidationIssue[];
  deterministicIssues: AIValidationIssue[];
  aiIssues: AIValidationIssue[];
  message?: string;
};

export const AI_VALIDATION_RESPONSE_SCHEMA = z.object({
  issues: z
    .array(
      z.object({
        fieldName: z.string().min(1).max(200),
        detectedIssue: z.string().min(1).max(500),
        suggestedCorrection: z.string().min(1).max(1000).nullable(),
        explanation: z.string().min(1).max(1000),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(20),
});

export type AIValidationResponse = z.infer<typeof AI_VALIDATION_RESPONSE_SCHEMA>;

export const PROTECTED_FIELD_KEYS = [
  "sampleId",
  "patientAlias",
  "shipmentId",
  "specimenCount",
  "consentVersion",
  "sealId",
  "reconciliationResult",
  "expectedSealId",
  "observedSealId",
] as const;

export const PROTECTED_FIELD_LABELS = [
  "patient",
  "consent",
  "authorisation",
  "authorization",
  "custody",
  "handover",
  "seal",
] as const;

export function isProtectedField(fieldName: string, form: DemoFormDefinition): boolean {
  const field = form.fields.find((candidate) => candidate.key === fieldName);
  const normalized = `${fieldName} ${field?.label ?? ""}`.toLowerCase();
  return (
    PROTECTED_FIELD_KEYS.some((key) => key === fieldName) ||
    PROTECTED_FIELD_LABELS.some((label) => normalized.includes(label))
  );
}

export function getFormDefinition(formId: string): DemoFormDefinition | undefined {
  return SAMPLE_DOCUMENT_FORMS.find((form) => form.id === formId);
}

function validDateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export function runDeterministicValidation(
  form: DemoFormDefinition,
  fields: Record<string, string>,
): AIValidationIssue[] {
  const issues: AIValidationIssue[] = [];

  for (const field of form.fields) {
    const value = (fields[field.key] ?? "").trim();
    if (field.required && !value) {
      issues.push({
        fieldName: field.key,
        detectedIssue: `${field.label} is required.`,
        suggestedCorrection: null,
        explanation: "This is a required field in the document definition.",
        confidence: 1,
        manualReviewRequired: true,
      });
      continue;
    }
    if (!value) continue;

    if (field.type === "datetime-local" && !validDateTime(value)) {
      issues.push({
        fieldName: field.key,
        detectedIssue: `${field.label} is not a valid date and time.`,
        suggestedCorrection: null,
        explanation: "Date and time values must use a valid ISO local datetime.",
        confidence: 1,
        manualReviewRequired: true,
      });
    }

    if (field.type === "select" && !field.options?.includes(value)) {
      issues.push({
        fieldName: field.key,
        detectedIssue: `${field.label} uses a value outside the permitted options.`,
        suggestedCorrection: null,
        explanation: "Only values defined by the form are allowed.",
        confidence: 1,
        manualReviewRequired: true,
      });
    }

    if (
      (field.key === "sampleId" && !/^SMP-\d{4}$/i.test(value)) ||
      (field.key === "shipmentId" && !/^DEMO-SHIP-\d{4}$/i.test(value)) ||
      (field.key === "sealId" && !/^DEMO-SEAL-\d{4}$/i.test(value))
    ) {
      issues.push({
        fieldName: field.key,
        detectedIssue: `${field.label} does not match the synthetic demo identifier format.`,
        suggestedCorrection: null,
        explanation: "Identifier formats are checked deterministically and require manual review.",
        confidence: 1,
        manualReviewRequired: true,
      });
    }
  }

  if (fields["reconciliationResult"] === "Pending") {
    issues.push({
      fieldName: "reconciliationResult",
      detectedIssue: "A pending reconciliation cannot be marked complete.",
      suggestedCorrection: null,
      explanation: "Pending reconciliation is not a completed permitted outcome.",
      confidence: 1,
      manualReviewRequired: true,
    });
  }

  return issues;
}

export function validateAIResponse(content: string, form: DemoFormDefinition): AIValidationIssue[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("The AI returned invalid JSON.");
  }

  const response = AI_VALIDATION_RESPONSE_SCHEMA.parse(parsed);
  const allowedFields = new Set([
    "label",
    "notes",
    "handoff",
    ...form.fields.map((field) => field.key),
  ]);

  return response.issues
    .filter((issue) => allowedFields.has(issue.fieldName))
    .map((issue) => ({
      ...issue,
      manualReviewRequired: isProtectedField(issue.fieldName, form),
    }));
}
