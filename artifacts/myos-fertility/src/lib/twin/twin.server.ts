import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { retrieveChunks, escalationReason, LEVEL_STYLE, type Chunk } from "./rules";
import { matchFaq, outOfScope, asksMedicationAdvice, asksIdentity, OUT_OF_SCOPE_TEXT, TREATMENT_PLAN_TEXT } from "./faq";
import { bookingText, greetingText, notCoveredText, type TwinKind } from "./intents";
import { escalationText, LANGUAGES } from "./languages";
import kb from "@/lib/fertility/kb.json";
import tessaKb from "./tessa-kb.json";
import { AI_REQUEST_TIMEOUT_MS, getChatProvider } from "@/lib/ai/provider.server";

export const TESSA_DOCTOR_ID = "d0c70000-0000-4000-8000-000000000004";
const TESSA_CHUNKS: Chunk[] = tessaKb as Chunk[];

export const MODEL = "openai/gpt-6.1-terra";
const DEMO_CHUNKS: Chunk[] = (kb as { section: string; heading: string; content: string }[]).map((k) => ({ doc_name: "MYOS demo clinic protocol", section: `${k.section} — ${k.heading}`, content: k.content }));

export async function translateTo(lang: string, text: string): Promise<string> {
  const provider = getChatProvider();
  if (lang === "English" || !provider) return text;
  const res = await fetch(provider.url, {
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    method: "POST", headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: provider.model, messages: [
      { role: "system", content: `Translate the user's message to ${lang}. Keep the warm tone. Output only the translation.` },
      { role: "user", content: text },
    ] }),
  });
  if (!res.ok) { console.error(`Translate failed [${res.status}]`); return text; }
  const j = (await res.json()) as { choices: { message: { content: string } }[] };
  return j.choices[0]?.message.content?.trim() || text;
}

export async function toEnglish(text: string): Promise<string> {
  const provider = getChatProvider();
  if (!provider) return text;
  const res = await fetch(provider.url, {
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    method: "POST", headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: provider.model, messages: [
      { role: "system", content: "Translate the user's message to English. Output only the translation." },
      { role: "user", content: text },
    ] }),
  });
  if (!res.ok) { console.error(`Translate failed [${res.status}]`); return text; }
  const j = (await res.json()) as { choices: { message: { content: string } }[] };
  return j.choices[0]?.message.content?.trim() || text;
}

const REASONS: Record<string, string> = { egg_freezing: "considering egg freezing", ivf: "going through or considering IVF", diagnosis: "here about a diagnosis", exploring: "just exploring options" };

export type Intent = "booking" | "question" | "greeting" | "off_topic";

/** Small AI call: classify the patient's message and translate it to English. Falls back to keyword checks. */
export async function classifyIntent(text: string): Promise<{ intent: Intent; english: string }> {
  const fallback = { intent: (asksIdentity(text) ? "greeting" : outOfScope(text) ? "off_topic" : "question") as Intent, english: text };
  const provider = getChatProvider();
  if (!provider) return fallback;
  try {
    const res = await fetch(provider.url, {
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      method: "POST", headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: provider.model, messages: [
        { role: "system", content: `Classify a patient's message to a fertility doctor's AI twin. Messages may have typos or be in any language.
intent:
- "booking": wants an appointment, to meet/see the doctor in person, to schedule, or to talk to a real person/human.
- "greeting": hello/hi, who are you, what can you do, small talk with no medical question.
- "question": anything about fertility, reproductive health, IVF, egg freezing, surrogacy, family building, LGBTQ+ family building, clinic costs, insurance or logistics.
- "off_topic": clearly unrelated to health or the clinic (weather, homework, recipes, sports).
english: the message translated to English (unchanged if already English).` },
        { role: "user", content: text },
      ], response_format: { type: "json_schema", json_schema: { name: "intent", strict: true, schema: { type: "object", additionalProperties: false, required: ["intent", "english"], properties: { intent: { type: "string", enum: ["booking", "question", "greeting", "off_topic"] }, english: { type: "string" } } } } } }),
    });
    if (!res.ok) { console.error(`Intent failed [${res.status}]`); return fallback; }
    const j = (await res.json()) as { choices: { message: { content: string } }[] };
    const out = JSON.parse(j.choices[0]?.message.content || "{}") as { intent: Intent; english: string };
    return ["booking", "question", "greeting", "off_topic"].includes(out.intent) ? { intent: out.intent, english: out.english || text } : fallback;
  } catch (e) { console.error("Intent error", e); return fallback; }
}

export interface TwinArgs { doctorId: string; patientId: string | null; question: string; language: string | null; ownerId: string; patientName?: string }

/** Shared twin answer pipeline: escalation rules, fixed answers, retrieval, model call, nurse review insert. Used by the website and the text channel. */
export async function answerTwin(sb: SupabaseClient<Database>, args: TwinArgs) {
  const data = args;
    
    const [{ data: doc }, { data: pat }] = await Promise.all([
      sb.from("twin_doctors").select("id,name,clinic,consent,is_demo").eq("id", data.doctorId).single(),
      data.patientId ? sb.from("twin_patients").select("*").eq("id", data.patientId).single() : Promise.resolve({ data: null }),
    ]);
    if (!doc?.consent) throw new Error("This twin is not available.");
    if (data.patientId && !pat) throw new Error("Patient profile not found.");
    const p = pat ?? { id: null, display_name: "Preview", reason: "exploring", diagnosis: "", medication: "", knowledge_level: "some", values_note: "", language: "English" };
    const lang = data.language && LANGUAGES.some((l) => l.name === data.language) ? data.language : p.language || "English";

    const escalate = async (reason: string) => {
      await sb.from("twin_nurse_reviews").insert({ owner_id: args.ownerId, doctor_id: doc.id, patient_id: p.id, patient_name: args.patientName ?? p.display_name, question: data.question, reason });
      return { escalated: true as const, uncovered: false, kind: "escalation" as TwinKind, reason, language: lang, answer: escalationText(lang), sources: [] as { doc_name: string; section: string; excerpt: string }[] };
    };

    const rule = escalationReason(data.question);
    if (rule) return escalate(rule);
    const fixed = (answer: string, sources: { doc_name: string; section: string; excerpt: string }[] = []) => ({ escalated: false as const, uncovered: false, kind: "answer" as TwinKind, reason: null, language: lang, answer, sources });
    // Not a safety issue: reply kindly in the chosen language and offer to send it to the clinic (no nurse-list entry).
    const notCovered = async () => ({ ...fixed(await translateTo(lang, notCoveredText(doc.name))), uncovered: true, kind: "not_covered" as TwinKind });
    if (asksMedicationAdvice(data.question)) return fixed(TREATMENT_PLAN_TEXT);
    // Intent (AI, works with typos and any language). Safety rules above always run first.
    const cls = await classifyIntent(data.question);
    const english = cls.english || data.question;
    if (english !== data.question) {
      const r1 = escalationReason(english);
      if (r1) return escalate(r1);
      if (asksMedicationAdvice(english)) return fixed(await translateTo(lang, TREATMENT_PLAN_TEXT));
    }
    const isTessaDoc = doc.id === TESSA_DOCTOR_ID;
    if (cls.intent === "booking") return { ...fixed(await translateTo(lang, bookingText(doc.name, isTessaDoc))), kind: "booking" as TwinKind };
    if (cls.intent === "greeting") return { ...fixed(await translateTo(lang, greetingText(doc.name, doc.clinic, isTessaDoc))), kind: "greeting" as TwinKind };
    if (cls.intent === "off_topic") return fixed(await translateTo(lang, OUT_OF_SCOPE_TEXT));
    const isTessa = doc.id === TESSA_DOCTOR_ID;
    const faq = isTessa ? null : matchFaq(english); // Tessa answers from her two guides, not the generic fixed answers
    if (faq) return fixed(await translateTo(lang, faq.answer), [{ doc_name: "MYOS fixed answers", section: `${faq.topic} — ${faq.source}`, excerpt: "" }]);

    const chunks = isTessa ? TESSA_CHUNKS : doc.is_demo ? DEMO_CHUNKS : ((await sb.from("twin_chunks").select("id,doc_name,section,content").eq("doctor_id", doc.id).limit(2000)).data ?? []);
    const query = english;
    let hits = retrieveChunks(query, chunks, `${p.diagnosis} ${p.medication}`);
    if (!hits.length) return notCovered();

    const passages = hits.map((h, i) => `[${i + 1}] (${h.chunk.doc_name}, ${h.chunk.section})\n${h.chunk.content}`).join("\n\n");
    const system = `You are the AI twin of Dr ${doc.name}${doc.clinic ? ` at ${doc.clinic}` : ""}. You are not a live consultation.
RULES:
- Answer ONLY with facts stated in the PASSAGES. Never add medical facts from outside them.
- Only discuss fertility and reproductive health (IVF, egg freezing, surrogacy). Otherwise set covered=false.
- Never diagnose. Always point the patient to their own treatment plan for anything about their medicines. Never recommend starting, stopping or changing any medication or dose. Never interpret test results.
- If the passages do not actually answer the question, set covered=false.
- Adapt wording only, never facts. ${LEVEL_STYLE[p.knowledge_level] ?? LEVEL_STYLE["new"]}
- Prefer passages relevant to the patient's diagnosis or medication when they apply, but do not comment on whether their medication is right.
- The patient's values affect tone and respect only, never medical content.
- Speak in first person as the doctor's twin, warm and brief (under 120 words), plain text, no markdown.
- List the passage numbers you used in "used".
- Write the answer in ${lang}, whatever language the question is in. Keep drug and procedure names recognisable.
- Set needs_care_team=true if the question (in any language) asks about a dose change, starting or stopping medication, a missed or wrong dose, conflicting instructions, interpreting test results, a diagnosis, or reports worrying symptoms.`;
    const user = `PATIENT CONTEXT (optional, may be blank): ${REASONS[p.reason] ?? ""}. Diagnosis: ${p.diagnosis || "not shared"}. Medication: ${p.medication || "not shared"}. Values to respect: ${p.values_note || "none shared"}.

PASSAGES:
${passages}

QUESTION: ${data.question}${query !== data.question ? `\n(English: ${query})` : ""}`;

    const provider = getChatProvider();
    if (!provider) throw new Error("AI unavailable");
    const res = await fetch(provider.url, {
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      method: "POST", headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        response_format: { type: "json_schema", json_schema: { name: "twin_answer", strict: true, schema: {
          type: "object", additionalProperties: false, required: ["covered", "needs_care_team", "answer", "used"],
          properties: { covered: { type: "boolean" }, needs_care_team: { type: "boolean" }, answer: { type: "string" }, used: { type: "array", items: { type: "integer" } } },
        } } },
      }),
    });
    if (!res.ok) { console.error(`AI failed [${res.status}]`); throw new Error(res.status === 402 ? "AI credits are used up." : res.status === 429 ? "Too many requests, try again shortly." : `AI error ${res.status}`); }
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const out = JSON.parse(json.choices[0]?.message.content || "{}") as { covered: boolean; needs_care_team: boolean; answer: string; used: number[] };
    if (out.needs_care_team) return escalate("Flagged for the care team");
    if (!out.covered || !out.answer) return notCovered();
    const used = (out.used?.length ? out.used : [1]).map((n) => hits[n - 1]).filter(Boolean);
    return { escalated: false as const, uncovered: false, kind: "answer" as TwinKind, reason: null, language: lang, answer: out.answer, sources: used.map((h) => ({ doc_name: h!.chunk.doc_name, section: h!.chunk.section, excerpt: h!.chunk.content.slice(0, 220) })) };
  }

/** Detect which supported language a text is written in (defaults to English). */
export async function detectLanguage(text: string): Promise<string> {
  const provider = getChatProvider();
  if (!provider) return "English";
  const names = LANGUAGES.map((l) => l.name);
  const res = await fetch(provider.url, {
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    method: "POST", headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: provider.model, messages: [
      { role: "system", content: `Which language is the user's message written in? Answer with exactly one of: ${names.join(", ")}. If none fit, answer English.` },
      { role: "user", content: text },
    ] }),
  });
  if (!res.ok) { console.error(`Language detect failed [${res.status}]`); return "English"; }
  const j = (await res.json()) as { choices: { message: { content: string } }[] };
  const out = j.choices[0]?.message.content?.trim() ?? "";
  return names.find((n) => out.toLowerCase().includes(n.toLowerCase())) ?? "English";
}

/** Pull proposed days/times out of a patient's text reply (any language). Returns null when none are given. */
export async function extractTimes(text: string): Promise<string | null> {
  const provider = getChatProvider();
  if (!provider) return null;
  const res = await fetch(provider.url, {
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    method: "POST", headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: provider.model, messages: [
      { role: "system", content: "The patient was asked which days and times work for a clinic appointment. If the message proposes any days, dates or times, return them in short English (e.g. 'Tue or Thu after 3pm'). Otherwise return an empty string." },
      { role: "user", content: text },
    ], response_format: { type: "json_schema", json_schema: { name: "times", strict: true, schema: { type: "object", additionalProperties: false, required: ["times"], properties: { times: { type: "string" } } } } } }),
  });
  if (!res.ok) { console.error(`Extract times failed [${res.status}]`); return null; }
  const j = (await res.json()) as { choices: { message: { content: string } }[] };
  const t = (JSON.parse(j.choices[0]?.message.content || "{}") as { times?: string }).times?.trim();
  return t ? t.slice(0, 300) : null;
}
