import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getFormDefinition,
  isProtectedField,
  runDeterministicValidation,
  validateAIResponse,
  type AIValidationResult,
} from "./ai-form-validation";

const inputSchema = z.object({
  formId: z.string().min(1).max(100),
  fields: z.record(z.string().max(1000)).refine((fields) => Object.keys(fields).length <= 50),
  syntheticConfirmed: z.boolean().default(false),
});

export const validateFormWithAI = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
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
          model: process.env["GROQ_MODEL"]?.trim() || "llama-3.3-70b-versatile",
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
