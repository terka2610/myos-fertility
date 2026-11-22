import { matchFaq, outOfScope, asksMedicationAdvice, OUT_OF_SCOPE_TEXT, TREATMENT_PLAN_TEXT } from "@/lib/twin/faq";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classify, PATIENT_DECISION, CLINIC, GENERAL } from "./safety";
import { SYSTEM_PROMPT, MODE_STYLE, ROLE_STYLE, OPENING_MESSAGE, suggestedQuestions, type Mode, type CareRole } from "./doctor";
import { retrieve, toSource, citedOnly, type Source } from "./knowledge";
import { AI_REQUEST_TIMEOUT_MS, getChatProvider } from "@/lib/ai/provider.server";

const RECENT_TURNS = 12;
const SUMMARIZE_AFTER = 24;

async function complete(messages: { role: string; content: string }[], _temperature = 0.4): Promise<string> {
  const provider = getChatProvider();
  if (!provider) throw new Error("AI unavailable");
  const res = await fetch(provider.url, {
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    method: "POST",
    headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: provider.model, messages }),
  });
  if (!res.ok) throw new Error(`AI request failed [${res.status}]`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const out = json.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error("Empty AI reply");
  return out;
}


async function programBySlug(supabase: any, slug: string) {
  const { data, error } = await supabase.from("care_programs").select("*").eq("slug", slug).single();
  if (error || !data) throw new Error("Program not found");
  return data as { id: string; slug: string; name: string };
}

export const getFertilityState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { program?: string } | undefined) => ({ program: d?.program ?? "ivf-care" }))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const program = await programBySlug(supabase, data.program);
    const { data: membership } = await supabase.from("care_program_memberships").select("*").eq("user_id", context.userId).eq("program_id", program.id).maybeSingle();
    const { data: consultation } = await supabase.from("consultations").select("*").eq("user_id", context.userId).eq("program_id", program.id).maybeSingle();
    let messages: any[] = [];
    if (consultation) {
      const { data: rows } = await supabase.from("consultation_messages").select("*").eq("consultation_id", consultation.id).order("created_at", { ascending: true });
      messages = rows ?? [];
    }
    const role = (membership?.care_role ?? "patient") as CareRole;
    return {
      program,
      membership: membership ?? null,
      consultation: consultation ?? null,
      messages,
      opening: OPENING_MESSAGE,
      suggestions: suggestedQuestions(role, membership?.treatment_stage || (program.slug === "egg-freezing" ? "egg_freezing" : null)),
    };
  });

export const joinProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    program: z.string().default("ivf-care"),
    care_role: z.enum(["patient", "partner"]),
    treatment_stage: z.string().max(40).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const program = await programBySlug(supabase, data.program);
    const { error } = await supabase.from("care_program_memberships").upsert({
      user_id: context.userId, program_id: program.id, care_role: data.care_role, treatment_stage: data.treatment_stage ?? null,
    }, { onConflict: "user_id,program_id" });
    if (error) throw new Error(error.message);
    await supabase.from("consultations").upsert({ user_id: context.userId, program_id: program.id, care_role: data.care_role }, { onConflict: "user_id,program_id" });
    return { ok: true };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    program: z.string().default("ivf-care"),
    content: z.string().trim().min(1, "Message is empty").max(4000, "Message is too long"),
    mode: z.enum(["text", "voice", "avatar"]).default("text"),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const program = await programBySlug(supabase, data.program);
    const { data: membership } = await supabase.from("care_program_memberships").select("*").eq("user_id", context.userId).eq("program_id", program.id).maybeSingle();
    if (!membership) throw new Error("Join the program first");
    const role = membership.care_role as CareRole;
    const mode = data.mode as Mode;

    let { data: c } = await supabase.from("consultations").select("*").eq("user_id", context.userId).eq("program_id", program.id).maybeSingle();
    if (!c) {
      const ins = await supabase.from("consultations").insert({ user_id: context.userId, program_id: program.id, care_role: role }).select().single();
      c = ins.data;
    }
    const { data: history } = await supabase.from("consultation_messages").select("sender,content,created_at").eq("consultation_id", c.id).order("created_at", { ascending: true });
    const all = (history ?? []) as { sender: string; content: string }[];
    const recent = all.slice(-RECENT_TURNS);

    const verdict = classify(data.content, role);
    const recentUser = all.slice(-8).filter((m) => m.sender === "user").map((m) => m.content);
    const query = data.content.length < 40 ? [...recentUser, data.content].join(" ") : data.content;
    const chunks = retrieve(query);
    let sources: Source[] = chunks.map((ch, i) => toSource(ch, i + 1));
    let reply: string;

    const faq = !verdict.deterministic ? matchFaq(data.content) : null;
    if (!verdict.deterministic && (asksMedicationAdvice(data.content) || outOfScope(query) || faq)) {
      reply = asksMedicationAdvice(data.content) ? TREATMENT_PLAN_TEXT : outOfScope(query) ? OUT_OF_SCOPE_TEXT : `${faq!.answer}\n\nFor anything about your own treatment, please follow your clinic's plan.`;
      sources = [];
    } else if (verdict.deterministic) {
      reply = verdict.fixed_response ?? "";
      const urgent = sources.filter((s) => s.risk_level === "urgent" || s.risk_level === "emergency").slice(0, 2);
      sources = urgent.length ? urgent : sources.slice(0, 1);
    } else {
      const guard: Record<string, string> = {
        [PATIENT_DECISION]: "This is a patient-specific medical decision: explain the general considerations and refer the decision to the treating clinician. No personal predictions.",
        [CLINIC]: "This needs clinic-specific instructions: use an approved clinic source if one is in SOURCES; otherwise say the clinic's own instructions are not available here and suggest asking the clinic.",
        [GENERAL]: "General education question.",
      };
      let contextBlock = "PATIENT CONTEXT: none available to this partner (no authorization granted).";
      if (role === "patient") {
        const { data: ctx } = await supabase.from("patient_context_entries").select("*").eq("patient_id", context.userId).order("created_at", { ascending: false }).limit(20);
        const groups: Record<string, string[]> = { verified_clinical: [], patient_reported: [], ai_generated: [] };
        for (const r of ctx ?? []) (groups[r.provenance] ??= []).push(`- [${r.kind}]${r.is_synthetic ? " (SYNTHETIC DEMO)" : ""} ${r.content}`);
        if (membership.treatment_stage) groups["patient_reported"]!.push(`- [treatment_stage] ${membership.treatment_stage} (selected in app)`);
        contextBlock = [
          "PATIENT CONTEXT (never promote one provenance to another):",
          "VERIFIED CLINICAL (from clinic):\n" + (groups["verified_clinical"]!.join("\n") || "- none on file. Do not claim chart access."),
          "PATIENT-REPORTED (unverified):\n" + (groups["patient_reported"]!.join("\n") || "- none"),
        ].join("\n");
      }
      const sourceBlock = chunks.map((ch, i) => `[${i + 1}] (${ch.heading}; knowledge base; demo, not clinician-reviewed)\n${ch.content}`).join("\n\n");
      const system = [
        SYSTEM_PROMPT, ROLE_STYLE[role], MODE_STYLE[mode],
        `SAFETY CLASSIFICATION: ${verdict.category}. ${guard[verdict.category] ?? ""}`,
        "PHASE 1 DEMO: you may use general medical knowledge for general education, but SOURCES take priority and you must not invent patient-specific facts.",
        contextBlock,
        c.summary ? "EARLIER CONVERSATION SUMMARY (AI-generated, unverified):\n" + c.summary : null,
        "SOURCES:\n" + (sourceBlock || "(no matching sources found — say when you are answering from general knowledge)"),
      ].filter(Boolean).join("\n\n");
      try {
        reply = await complete([
          { role: "system", content: system },
          ...recent.map((m) => ({ role: m.sender === "assistant" ? "assistant" : "user", content: m.content })),
          { role: "user", content: data.content },
        ]);
        sources = citedOnly(reply, sources);
      } catch (e) {
        console.error("fertility AI failed; knowledge-base fallback", e);
        const top = chunks[0];
        if (!top) throw new Error("The AI service is unavailable. Please try again.");
        reply = `From your clinic's knowledge base: ${top.content.slice(0, 1200)} [1]\n\nFor anything about your own treatment, please check with your fertility team.`;
        sources = sources.slice(0, 1);
      }
    }

    const { safety_fixed: _x, ...safety } = { ...verdict, safety_fixed: undefined } as any;
    delete safety.fixed_response;
    const now = new Date();
    const { error } = await supabase.from("consultation_messages").insert([
      { consultation_id: c.id, sender: "user", content: data.content, mode, care_role: role, provenance: "patient_reported", safety, sources: [], created_at: now.toISOString() },
      { consultation_id: c.id, sender: "assistant", content: reply, mode, care_role: role, provenance: "ai_generated", safety, sources, created_at: new Date(now.getTime() + 1).toISOString() },
    ]);
    if (error) throw new Error(error.message);
    await supabase.from("consultations").update({ last_activity_at: now.toISOString(), last_mode: mode, care_role: role }).eq("id", c.id);

    if (all.length + 2 > SUMMARIZE_AFTER) {
      try {
        const older = all.slice(0, -RECENT_TURNS).slice(-40);
        const summary = await complete([
          { role: "system", content: "Summarise this fertility consultation for continuity in <=120 words: topics, the user's concerns and anything the user reported. Mark everything as unverified. No advice." },
          { role: "user", content: (c.summary ? `Previous summary: ${c.summary}\n` : "") + older.map((m) => `${m.sender}: ${m.content}`).join("\n") },
        ], 0.2);
        await supabase.from("consultations").update({ summary }).eq("id", c.id);
      } catch (e) { console.error("summary failed", e); }
    }
    return { reply, sources, safety };
  });

export const simulateEscalation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ program: z.string().default("ivf-care"), category: z.string().max(40), summary: z.string().max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const program = await programBySlug(supabase, data.program);
    const { data: c } = await supabase.from("consultations").select("id,care_role").eq("user_id", context.userId).eq("program_id", program.id).single();
    if (!c) throw new Error("Not found");
    await supabase.from("simulated_escalations").insert({ consultation_id: c.id, category: data.category || "unspecified", summary: data.summary || "Patient requested contact with the care team." });
    await supabase.from("consultation_messages").insert({ consultation_id: c.id, sender: "assistant", mode: "text", care_role: c.care_role, provenance: "ai_generated", content: "Simulated: request placed in the demo nurse queue. No real message was sent — please contact your clinic directly if you need help now." });
    return { ok: true };
  });

export const clearHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { program?: string } | undefined) => ({ program: d?.program ?? "ivf-care" }))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const program = await programBySlug(supabase, data.program);
    const { data: c } = await supabase.from("consultations").select("id").eq("user_id", context.userId).eq("program_id", program.id).maybeSingle();
    if (c) {
      await supabase.from("consultation_messages").delete().eq("consultation_id", c.id);
      await supabase.from("consultations").update({ summary: null }).eq("id", c.id);
    }
    return { ok: true };
  });

export const updateMembership = joinProgram;
