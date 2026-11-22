import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ElevenLabs voice for the doctor (preserved from the original app). Returns null when no key is
// configured so the browser can fall back to its built-in voice.
export const speak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ text: z.string().min(1).max(2500) }).parse(d))
  .handler(async ({ data }) => {
    const { synthesizeSpeech } = await import("@/lib/ai/voice.server");
    return synthesizeSpeech(data.text);
  });
