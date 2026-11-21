import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getFormDefinition,
  runDeterministicValidation,
  validateAIResponse,
  type AIValidationResult,
  VOICE_EXTRACTION_RESPONSE_SCHEMA,
  isProtectedField,
  resolveVoiceFieldId,
  type VoiceExtractionResult,
} from "./ai-form-validation";

const inputSchema = z.object({
  formId: z.string().min(1).max(100),
  fields: z.record(z.string()).refine((fields) => Object.keys(fields).length <= 50),
  label: z.string().max(120).default(""),
  notes: z.string().max(1000).default(""),
  handoff: z.string().max(300).default(""),
});

const voiceExtractionInputSchema = z.object({
  formId: z.string().min(1).max(100),
  transcript: z.string().trim().min(1).max(4000),
  currentValues: z.record(z.string()).optional().default({}),
});

function dubaiContext(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${value["year"]}-${value["month"]}-${value["day"]}`,
    time: `${value["hour"]}:${value["minute"]}`,
    timezone: "Asia/Dubai",
  };
}

function normalizeExtractedDate(value: string, now: Date): string {
  const trimmed = value.trim();
  const isoDateTime = /^(\d{4}-\d{2}-\d{2})(?:T|\s)(\d{2}:\d{2})/.exec(trimmed);
  if (isoDateTime) return `${isoDateTime[1]}T${isoDateTime[2]}`;

  const isoDate = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
  if (isoDate) return isoDate[1]!;

  const namedDate =
    /^(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+(\d{4}))?$/i.exec(
      trimmed,
    );
  if (namedDate) {
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const context = dubaiContext(now);
    const year = Number(namedDate[3] ?? context.date.slice(0, 4));
    const month =
      monthNames.findIndex((monthName) => monthName.toLowerCase() === namedDate[2]!.toLowerCase()) +
      1;
    const day = Number(namedDate[1]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }
  return trimmed;
}

export const extractVoiceFieldsWithAI = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => voiceExtractionInputSchema.parse(data))
  .handler(async ({ data }): Promise<VoiceExtractionResult> => {
    const form = getFormDefinition(data.formId);
    if (!form) {
      return {
        enabled: false,
        suggestions: [],
        message: "AI field extraction is unavailable for this form.",
      };
    }

    const apiKey = process.env["GROQ_API_KEY"];
    if (!apiKey) {
      return {
        enabled: false,
        suggestions: [],
        message: "AI field extraction is unavailable. You can continue with manual review.",
      };
    }

    const model = process.env["GROQ_MODEL"]?.trim() || "llama-3.3-70b-versatile";
    const now = new Date();
    const editableFields = form.fields.map((field) => ({
      id: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      options: field.options ?? null,
      exampleFormat: field.placeholder ?? null,
      protected: isProtectedField(field.key, form),
    }));
    editableFields.push({
      id: "label",
      label: "Record Title",
      type: "text",
      required: false,
      options: null,
      exampleFormat: null,
      protected: false,
    });
    editableFields.push({
      id: "notes",
      label: form.id === "SHP-001" ? "Transport Notes" : "Additional Notes",
      type: "textarea",
      required: false,
      options: null,
      exampleFormat: null,
      protected: false,
    });
    editableFields.push({
      id: "handoff",
      label: "Transfer Route",
      type: "text",
      required: false,
      options: null,
      exampleFormat: null,
      protected: true,
    });

    const allowedIds = new Set(
      editableFields.filter((field) => !field.protected).map((field) => field.id),
    );
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
                'Extract only explicitly stated values from the transcript into editable MYOS form fields. Return JSON: {"suggestions":[{"fieldId":"actual field ID","value":"value","confidence":0.0}]}. Do not invent missing values. Never suggest protected IDs, patient identity, specimen counts, consent, authorisation, reconciliation, custody or seal fields. The field with id "label" (Record Title) is the title or name of the record; map "title", "document title", "record title", "record name" and mishearings such as "document tightly" or "record tidal" to it, and use the words after it as the title (for example "document title is patient registration" gives Patient registration). If a spoken title is a garbled version of formTitle (for example "special registration registration" for Patient registration), use formTitle as written; drop repeated words and filler such as "my", "uh" or "um". A garbled or partial year such as "226" or "20 26" means the year in currentDateTimeAsiaDubai. Each value ends where the speaker moves on to another field: never copy field names, dates or values of other fields into a text or notes value (for example "additional notes checking date is November 21st" gives notes "checking" and a separate date; "additional notes shipped today and date is today at 10 am" gives notes "shipped today" and the date and time field today at 10:00). Words like "and date is", "record date", "time is" always start a new field. Resolve obvious speech recognition mistakes from the supplied labels, for example "additional NERS", "additional nurse", or "additional nerts" means Additional Notes unless the form uses Transport Notes. Map "record date" or "record date and time" to the matching date/datetime field. For date fields use YYYY-MM-DD. For datetime-local fields use YYYY-MM-DDTHH:mm when a time is stated; if only a date is stated, still return the date as YYYY-MM-DD (the user will add the time) and never guess a time. If the speaker says now, just now or right now, use currentDateTimeAsiaDubai date and time. Speech recognition often mishears words, especially numbers ("to"/"too" for two, "for" for four, "won" for one) and verb endings ("ship today" for shipped today). When a field has an exampleFormat, rewrite the spoken value to match that format, for example "staff to" becomes "Staff 02" when the example is "Staff 01". For text and textarea otherwise preserve the spoken wording, fixing only clearly misheard words; never add new facts. For select fields use exactly one listed allowed value. Use Asia/Dubai for date interpretation.',
            },
            {
              role: "user",
              content: JSON.stringify({
                transcript: data.transcript,
                formId: form.id,
                formTitle: form.title,
                currentDateTimeAsiaDubai: dubaiContext(now),
                editableFields,
                currentValues: data.currentValues,
              }),
            },
          ],
        }),
      });
      if (!response.ok) throw new Error(`Groq extraction failed [${response.status}]`);

      const json = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error("Groq returned an empty extraction response");

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error("Groq returned invalid extraction JSON");
      }
      const validated = VOICE_EXTRACTION_RESPONSE_SCHEMA.parse(parsed);
      const suggestions = validated.suggestions
        .map((suggestion) => ({
          ...suggestion,
          fieldId: resolveVoiceFieldId(suggestion.fieldId, form) ?? suggestion.fieldId,
        }))
        .filter((suggestion) => allowedIds.has(suggestion.fieldId))
        .map((suggestion) => {
          const field = editableFields.find((candidate) => candidate.id === suggestion.fieldId);
          if (!field) return null;
          if (field.type === "date") {
            const normalized = normalizeExtractedDate(suggestion.value, now);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
            return { ...suggestion, value: normalized };
          }
          if (field.type === "datetime-local") {
            const normalized = normalizeExtractedDate(suggestion.value, now);
            // A date without a time is kept so the review step can ask for the time.
            if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(normalized)) return null;
            return { ...suggestion, value: normalized };
          }
          if (field.type === "select") {
            const option = field.options?.find(
              (allowed) => allowed.toLowerCase() === suggestion.value.trim().toLowerCase(),
            );
            return option ? { ...suggestion, value: option } : null;
          }
          return suggestion;
        })
        .filter(
          (suggestion): suggestion is (typeof validated.suggestions)[number] => suggestion !== null,
        );

      return {
        enabled: true,
        suggestions,
        message:
          suggestions.length > 0
            ? "AI suggestions are ready for review."
            : "AI found no clear field matches. The original transcript and manual fields remain available.",
      };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Groq voice extraction failed", error);
      }
      return {
        enabled: false,
        suggestions: [],
        message: "Groq field extraction failed. Use the manual review option below.",
      };
    }
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
