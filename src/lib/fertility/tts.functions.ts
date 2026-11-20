import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ElevenLabs voice for the doctor (preserved from the original app). Returns null when no key is
// configured so the browser can fall back to its built-in voice.
export const speak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().min(1).max(2500) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env["ELEVENLABS_API_KEY"];
    if (!key) return { audio: null as string | null };
    const voice = process.env["ELEVENLABS_VOICE_ID_FEMALE"] || "EXAVITQu4vr4xnSDxMaL";
    const clean = data.text.replace(/\[\d+\]/g, "").replace(/[*#_`]/g, "");
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, model_id: "eleven_turbo_v2_5" }),
    });
    if (!res.ok) { console.error(`ElevenLabs failed [${res.status}]: ${await res.text()}`); return { audio: null }; }
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { audio: btoa(bin) };
  });
