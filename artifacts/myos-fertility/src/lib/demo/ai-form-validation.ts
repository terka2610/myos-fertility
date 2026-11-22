import { z } from "zod";
import { SAMPLE_DOCUMENT_FORMS, type DemoFormDefinition } from "./sample-transfer.ts";

export interface AIValidationIssue {
  fieldName: string;
  detectedIssue: string;
  suggestedCorrection: string | null;
  explanation: string;
  confidence: number;
  manualReviewRequired: boolean;
}

export interface AIValidationResult {
  enabled: boolean;
  issues: AIValidationIssue[];
  deterministicIssues: AIValidationIssue[];
  aiIssues: AIValidationIssue[];
  message?: string;
}

export interface VoiceExtractionSuggestion {
  fieldId: string;
  value: string;
  confidence: number;
}

export interface VoiceExtractionResult {
  enabled: boolean;
  suggestions: VoiceExtractionSuggestion[];
  message?: string;
}

export const AI_VALIDATION_RESPONSE_SCHEMA = z.object({
  issues: z.array(z.object({
    fieldName: z.string().min(1).max(200),
    detectedIssue: z.string().min(1).max(500),
    suggestedCorrection: z.string().min(1).max(1000).nullable(),
    explanation: z.string().min(1).max(1000),
    confidence: z.number().min(0).max(1),
  })).max(20),
});

export const VOICE_EXTRACTION_RESPONSE_SCHEMA = z.object({
  suggestions: z.array(z.object({
    fieldId: z.string().min(1).max(200),
    value: z.string().max(1000),
    confidence: z.number().min(0).max(1),
  })).max(30),
});

const PROTECTED_KEYS = new Set([
  "sampleId",
  "patientAlias",
  "shipmentId",
  "specimenCount",
  "consentVersion",
  "sealId",
  "reconciliationResult",
  "expectedSealId",
  "observedSealId",
  "staffMember",
]);

const PROTECTED_LABELS = [
  "patient",
  "consent",
  "authorisation",
  "authorization",
  "custody",
  "handover",
  "seal",
];

export function getFormDefinition(formId: string) {
  return SAMPLE_DOCUMENT_FORMS.find((form) => form.id === formId);
}

export function isProtectedField(fieldName: string, form: DemoFormDefinition) {
  const field = form.fields.find((candidate) => candidate.key === fieldName);
  const searchable = `${fieldName} ${field?.label ?? ""}`.toLowerCase();
  return PROTECTED_KEYS.has(fieldName) || PROTECTED_LABELS.some((label) => searchable.includes(label));
}

export function resolveVoiceFieldId(fieldId: string, form: DemoFormDefinition) {
  if (fieldId === "label" || fieldId === "notes") return fieldId;
  const normalized = fieldId.toLowerCase().replace(/[^a-z0-9]/g, "");
  const field = form.fields.find((candidate) =>
    candidate.key === fieldId ||
    candidate.key.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized ||
    candidate.label.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized,
  );
  return field?.key;
}

export function validateVoiceExtractionResponse(content: string, form: DemoFormDefinition) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("The AI returned invalid JSON.");
  }
  const response = VOICE_EXTRACTION_RESPONSE_SCHEMA.parse(parsed);
  return response.suggestions.flatMap((suggestion) => {
    const fieldId = resolveVoiceFieldId(suggestion.fieldId, form);
    if (!fieldId) return [];
    if (fieldId !== "label" && fieldId !== "notes" && isProtectedField(fieldId, form)) return [];
    const field = form.fields.find((candidate) => candidate.key === fieldId);
    if (!field) {
      return fieldId === "label" || fieldId === "notes"
        ? [{ ...suggestion, fieldId, value: suggestion.value.trim() }]
        : [];
    }
    const value = suggestion.value.trim();
    if (!value || value.length > (field.type === "textarea" ? 1000 : 200)) return [];
    if (field.type === "select") {
      const allowed = field.options?.find((option) => option.toLowerCase() === value.toLowerCase());
      return allowed ? [{ ...suggestion, fieldId, value: allowed }] : [];
    }
    if (field.type === "datetime-local" && !validDateTime(value)) return [];
    return [{ ...suggestion, fieldId, value }];
  });
}

function validDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() === Number(month) - 1
    && date.getUTCDate() === Number(day)
    && date.getUTCHours() === Number(hour)
    && date.getUTCMinutes() === Number(minute);
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
        explanation: "This field is required by the synthetic demo form.",
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
        explanation: "Use a valid date and time in YYYY-MM-DDTHH:mm format.",
        confidence: 1,
        manualReviewRequired: true,
      });
    }

    if (field.type === "select" && !field.options?.includes(value)) {
      issues.push({
        fieldName: field.key,
        detectedIssue: `${field.label} uses a value outside the permitted options.`,
        suggestedCorrection: null,
        explanation: "Choose one of the options provided by the form.",
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
        explanation: "Demo identifiers are checked locally and must be reviewed manually.",
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

export function validateAIResponse(content: string, form: DemoFormDefinition) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("The AI returned invalid JSON.");
  }
  const response = AI_VALIDATION_RESPONSE_SCHEMA.parse(parsed);
  const allowedFields = new Set(form.fields.map((field) => field.key));
  return response.issues
    .filter((issue) => allowedFields.has(issue.fieldName))
    .map((issue) => {
      const protectedField = isProtectedField(issue.fieldName, form);
      return {
        ...issue,
        suggestedCorrection: protectedField ? null : issue.suggestedCorrection,
        explanation: protectedField
          ? "This field is protected and must be reviewed manually."
          : issue.explanation,
        manualReviewRequired: protectedField,
      };
    });
}
