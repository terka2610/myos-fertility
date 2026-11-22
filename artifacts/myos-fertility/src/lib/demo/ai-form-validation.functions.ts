import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { takeDemoReviewBudget } from "@/lib/ai/review-budget.server";
import {
  getFormDefinition,
  isProtectedField,
  runDeterministicValidation,
  validateVoiceExtractionResponse,
  validateAIResponse,
  type AIValidationResult,
  type VoiceExtractionResult,
} from "./ai-form-validation";

const inputSchema = z.object({
  formId: z.string().min(1).max(100),
  fields: z.record(z.string().max(1000)).refine((fields) => Object.keys(fields).length <= 50),
  syntheticConfirmed: z.boolean().default(false),
});

const voiceInputSchema = z.object({
  formId: z.string().min(1).max(100),
  transcript: z.string().trim().min(1).max(4000),
  syntheticConfirmed: z.boolean().default(false),
});

export const validateFormWithAI = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<AIValidationResult> => {
    const form = getFormDefinition(data.formId);
    if (!form) {
      return {
        enabled: false,
        issues: [],
        deterministicIssues: [],
        aiIssues: [],
        message: "This document form could not be found.",
      };
    }

    const deterministicIssues = runDeterministicValidation(form, data.fields);
    const localOnly = (message: string): AIValidationResult => ({
      enabled: false,
      issues: deterministicIssues,
      deterministicIssues,
      aiIssues: [],
      message,
    });

    if (!data.syntheticConfirmed) {
      return localOnly("Local checks ran. AI review is off until you confirm the entries are synthetic.");
    }

    const apiKey = process.env["GROQ_API_KEY"];
    if (!apiKey) {
      return localOnly("AI review is not configured. Local checks are available; continue with manual review.");
    }
    if (!takeDemoReviewBudget()) {
      return localOnly("AI review limit reached. Local checks remain available; try again in a minute.");
    }

    const safeFields = Object.fromEntries(
      form.fields
        .filter((field) => !isProtectedField(field.key, form))
        .flatMap((field) => {
          const value = data.fields[field.key];
          return typeof value === "string" && value.trim() ? [[field.key, value.trim()]] : [];
        }),
    );

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env["GROQ_MODEL"]?.trim() || "openai/gpt-oss-120b",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'Review only the supplied synthetic demo form values. Return JSON matching {"issues":[{"fieldName":"...","detectedIssue":"...","suggestedCorrection":"... or null","explanation":"...","confidence":0.0}]}. Do not invent information. Never suggest changing identifiers, patient identity, specimen counts, consent, reconciliation, custody, handover, or seal values. Corrections are suggestions for a human, never apply them automatically.',
            },
            {
              role: "user",
              content: JSON.stringify({
                form: { id: form.id, title: form.title, reference: form.reference },
                fields: form.fields
                  .filter((field) => !isProtectedField(field.key, form))
                  .map(({ key, label, type, required, options }) => ({
                    key,
                    label,
                    type,
                    required,
                    options: options ?? null,
                  })),
                values: safeFields,
                deterministicIssues,
              }),
            },
          ],
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`Groq request failed [${response.status}]`);

      const json = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error("Groq returned an empty response");
      const aiIssues = validateAIResponse(content, form);
      return {
        enabled: true,
        issues: [...deterministicIssues, ...aiIssues],
        deterministicIssues,
        aiIssues,
        message: "AI suggestions are ready for manual review.",
      };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(
          "AI form validation unavailable",
          error instanceof Error ? error.message : "unknown error",
        );
      }
      return localOnly("AI review is unavailable right now. Local checks and manual entry remain available.");
    }
  });

export const extractVoiceFieldsWithAI = createServerFn({ method: "POST" })
  .validator((data: unknown) => voiceInputSchema.parse(data))
  .handler(async ({ data }): Promise<VoiceExtractionResult> => {
    const form = getFormDefinition(data.formId);
    if (!form) {
      return { enabled: false, suggestions: [], message: "AI field extraction is unavailable for this form." };
    }
    if (!data.syntheticConfirmed) {
      return {
        enabled: false,
        suggestions: [],
        message: "AI extraction is off. Confirm the transcript contains synthetic demo data to continue.",
      };
    }
    const apiKey = process.env["GROQ_API_KEY"];
    if (!apiKey) {
      return {
        enabled: false,
        suggestions: [],
        message: "AI extraction is not configured. Local voice matching and manual review remain available.",
      };
    }
    if (!takeDemoReviewBudget()) {
      return {
        enabled: false,
        suggestions: [],
        message: "AI review limit reached. Local voice matching remains available; try again in a minute.",
      };
    }

    const safeFields = form.fields
      .filter((field) => !isProtectedField(field.key, form))
      .map((field) => ({
        id: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
        options: field.options ?? null,
        exampleFormat: field.placeholder ?? null,
      }));
    safeFields.push(
      { id: "label", label: "Record Title", type: "text", required: false, options: null, exampleFormat: null },
      { id: "notes", label: "Additional Notes", type: "textarea", required: false, options: null, exampleFormat: null },
    );

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env["GROQ_MODEL"]?.trim() || "openai/gpt-oss-120b",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'Extract only clearly stated values from this synthetic demo transcript. Return JSON: {"suggestions":[{"fieldId":"exact supplied field id","value":"...","confidence":0.0}]}. Do not invent missing information. Never extract or suggest patient identity, sample or shipment identifiers, consent, custody, handover, reconciliation, or seal values. Use exactly one permitted select option. Dates must be YYYY-MM-DD; datetime-local values must be YYYY-MM-DDTHH:mm. Do not infer a time when none is spoken. Return no suggestion when unclear.',
            },
            {
              role: "user",
              content: JSON.stringify({
                form: { id: form.id, title: form.title },
                fields: safeFields,
                transcript: data.transcript,
                currentDateTimeAsiaDubai: new Intl.DateTimeFormat("en-CA", {
                  timeZone: "Asia/Dubai",
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(new Date()),
                timezone: "Asia/Dubai",
              }),
            },
          ],
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`Groq request failed [${response.status}]`);
      const json = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error("Groq returned an empty extraction response");
      const suggestions = validateVoiceExtractionResponse(content, form);
      return {
        enabled: true,
        suggestions,
        message: suggestions.length
          ? "AI suggestions are ready for your review. Nothing has been applied."
          : "AI found no clear editable field matches. Use local voice matching or enter values manually.",
      };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(
          "AI voice extraction unavailable",
          error instanceof Error ? error.message : "unknown error",
        );
      }
      return {
        enabled: false,
        suggestions: [],
        message: "AI extraction is unavailable. Local voice matching and manual review remain available.",
      };
    }
  });
