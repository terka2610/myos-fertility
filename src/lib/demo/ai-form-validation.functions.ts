import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getFormDefinition,
  runDeterministicValidation,
  validateAIResponse,
  type AIValidationResult,
} from "./ai-form-validation";

const inputSchema = z.object({
  formId: z.string().min(1).max(100),
  fields: z.record(z.string()).refine((fields) => Object.keys(fields).length <= 50),
  label: z.string().max(120).default(""),
  notes: z.string().max(1000).default(""),
  handoff: z.string().max(300).default(""),
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
    const apiKey = process.env["GROQ_API_KEY"];
    if (!apiKey) {
      return {
        enabled: false,
        issues: deterministicIssues,
        deterministicIssues,
        aiIssues: [],
        message:
          "AI validation is disabled. Set GROQ_API_KEY in the server environment to enable it.",
      };
    }

    const model = process.env["GROQ_MODEL"]?.trim() || "llama-3.3-70b-versatile";
    const protectedKeys = [
      "sampleId",
      "patientAlias",
      "shipmentId",
      "specimenCount",
      "consentVersion",
      "sealId",
      "reconciliationResult",
      "expectedSealId",
      "observedSealId",
    ];
    const prompt = {
      form: { id: form.id, reference: form.reference, title: form.title },
      fields: form.fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
        options: field.options ?? null,
      })),
      entries: {
        fields: data.fields,
        label: data.label,
        notes: data.notes,
        handoff: data.handoff,
      },
      deterministicIssues,
      protectedKeys,
    };

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'You review synthetic MYOS cryogenic workflow form entries. Return only JSON matching {"issues":[{"fieldName":"...","detectedIssue":"...","suggestedCorrection":"... or null","explanation":"...","confidence":0.0}]}. Supplement deterministic validation; never override it. Never suggest changing protected identifiers, patient identity, specimen counts, consent, authorization, reconciliation, custody, or seal values. If uncertain, use confidence below 0.7 and a null correction.',
            },
            { role: "user", content: JSON.stringify(prompt) },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq request failed [${response.status}]`);
      }

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
        message: "AI validation completed. Review every suggested correction.",
      };
    } catch (error) {
      console.error("AI form validation failed", error);
      return {
        enabled: false,
        issues: deterministicIssues,
        deterministicIssues,
        aiIssues: [],
        message:
          "AI validation is temporarily unavailable. Your manual form entry has been preserved.",
      };
    }
  });
