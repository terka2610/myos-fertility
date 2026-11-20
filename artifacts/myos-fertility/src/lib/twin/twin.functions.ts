import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chunkPages } from "./rules";
import { doctorInput } from "./setup";

export const createTwin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => doctorInput.parse(d))
  .handler(async ({ data, context }) => {
    const { documents, ...doc } = data;
    const { data: row, error } = await context.supabase.from("twin_doctors").insert({ ...doc, owner_id: context.userId, status: "draft" }).select("id").single();
    if (error) throw new Error(error.message);
    const chunks: { doctor_id: string; document_id: string; doc_name: string; section: string; content: string }[] = [];
    for (const d of documents) {
      const { data: docRow, error: de } = await context.supabase.from("twin_documents").insert({ doctor_id: row.id, name: d.name, storage_path: d.storage_path }).select("id").single();
      if (de) throw new Error(de.message);
      chunks.push(...chunkPages(d.name, d.pages).map((c) => ({ ...c, doctor_id: row.id, document_id: docRow.id })));
    }
    if (documents.length && !chunks.length) throw new Error("No readable text was found in the documents.");
    for (let i = 0; i < chunks.length; i += 200) {
      const { error: e } = await context.supabase.from("twin_chunks").insert(chunks.slice(i, i + 200));
      if (e) throw new Error(e.message);
    }
    return { id: row.id, chunks: chunks.length };
  });

/** Clone the doctor's voice on ElevenLabs when a key is configured; otherwise the browser voice is used. */
export const createVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ doctorId: z.string().uuid(), audio: z.string().max(15_000_000), mime: z.string().max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env["ELEVENLABS_API_KEY"];
    if (!key) return { voiceId: null as string | null, provider: "browser" };
    const { data: d } = await context.supabase.from("twin_doctors").select("id,name,owner_id").eq("id", data.doctorId).single();
    if (!d || d.owner_id !== context.userId) throw new Error("Not your twin");
    const bin = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("name", `MYOS twin - ${d.name}`);
    form.append("files", new Blob([bin], { type: data.mime }), "sample");
    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", { method: "POST", headers: { "xi-api-key": key }, body: form });
    if (!res.ok) { const t = await res.text(); console.error(`ElevenLabs clone failed [${res.status}]: ${t}`); throw new Error(`Voice provider error [${res.status}]: ${t.slice(0, 200)}`); }
    const { voice_id } = (await res.json()) as { voice_id: string };
    await context.supabase.from("twin_doctors").update({ voice_id }).eq("id", d.id);
    return { voiceId: voice_id, provider: "elevenlabs" };
  });

export const speakAsTwin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ doctorId: z.string().uuid(), text: z.string().min(1).max(2500) }).parse(d))
  .handler(async ({ data, context }) => {
    const key = process.env["ELEVENLABS_API_KEY"];
    const { data: d } = await context.supabase.from("twin_doctors").select("voice_id,consent").eq("id", data.doctorId).single();
    if (!key || !d?.voice_id || !d.consent) return { audio: null as string | null };
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${d.voice_id}?output_format=mp3_44100_128`, {
      method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text: data.text, model_id: "eleven_turbo_v2_5" }),
    });
    if (!res.ok) { console.error(`ElevenLabs TTS failed [${res.status}]: ${await res.text()}`); return { audio: null }; }
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { audio: btoa(bin) };
  });

export const savePatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    display_name: z.string().min(1).max(80), reason: z.enum(["egg_freezing", "ivf", "diagnosis", "exploring"]),
    diagnosis: z.string().max(500), medication: z.string().max(500), knowledge_level: z.enum(["new", "some", "cycle"]),
    preferences: z.array(z.string().max(20)).max(6), preferred_language: z.string().max(60), values_note: z.string().max(800),
    language: z.string().max(40),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("twin_patients").insert({ ...data, owner_id: context.userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });


/** Patient chose to send a question the twin couldn't answer to the clinic. */
export const sendToClinic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ doctorId: z.string().uuid(), patientId: z.string().uuid().nullable(), patientName: z.string().max(80), question: z.string().min(1).max(1500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("twin_nurse_reviews").insert({ owner_id: context.userId, doctor_id: data.doctorId, patient_id: data.patientId, patient_name: data.patientName || "Patient", question: data.question, reason: "Patient asked to send this to the clinic" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });



export const askTwin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ doctorId: z.string().uuid(), patientId: z.string().uuid().nullable(), question: z.string().min(1).max(1500), language: z.string().max(40).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { answerTwin } = await import("./twin.server");
    return answerTwin(context.supabase, { ...data, ownerId: context.userId });
  });
