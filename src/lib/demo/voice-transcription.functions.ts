import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getFormDefinition } from "./ai-form-validation";

// Server-side speech-to-text for voice form filling. Uses ElevenLabs Scribe when
// ELEVENLABS_API_KEY is set, otherwise Groq Whisper with GROQ_API_KEY. Keys never reach the browser.

export type TranscriptionProvider = "elevenlabs" | "groq";

export type VoiceTranscriptionResult =
  { ok: true; text: string; provider: TranscriptionProvider } | { ok: false; message: string };

// About 60 seconds of compressed speech is far below this.
const MAX_AUDIO_BASE64_LENGTH = 8_000_000;

const inputSchema = z.object({
  formId: z.string().min(1).max(100),
  audioBase64: z.string().min(1).max(MAX_AUDIO_BASE64_LENGTH),
  mimeType: z
    .string()
    .max(100)
    .regex(/^audio\/[a-z0-9.+-]+(;.*)?$/i, "Unsupported audio type"),
});

function fileExtension(mimeType: string) {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg")) return "mp3";
  return "webm";
}

/** Vocabulary hint so the recogniser spells form words correctly ("Record Title", "Staff 01"). */
export function transcriptionPrompt(formId: string): string {
  const form = getFormDefinition(formId);
  const labels = form
    ? [form.title, ...form.fields.map((field) => field.label)].join(", ")
    : "MYOS transfer form";
  return `MYOS cryogenic sample transfer form: ${labels}, Record Title, Additional Notes, Record Date. Values like Staff 01, SMP-0001, Cryo Transport, Cryogenic Storage, Fertility Centre.`;
}

async function transcribeWithElevenLabs(audio: Blob, filename: string, apiKey: string) {
  const body = new FormData();
  body.append("model_id", process.env["ELEVENLABS_STT_MODEL"]?.trim() || "scribe_v1");
  body.append("language_code", "en");
  body.append("file", audio, filename);
  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`ElevenLabs transcription failed (${response.status})`);
  const json = (await response.json()) as { text?: unknown };
  return typeof json.text === "string" ? json.text : "";
}

async function transcribeWithGroq(audio: Blob, filename: string, apiKey: string, prompt: string) {
  const body = new FormData();
  body.append("model", process.env["GROQ_STT_MODEL"]?.trim() || "whisper-large-v3-turbo");
  body.append("language", "en");
  body.append("temperature", "0");
  body.append("response_format", "json");
  body.append("prompt", prompt);
  body.append("file", audio, filename);
  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Groq transcription failed (${response.status})`);
  const json = (await response.json()) as { text?: unknown };
  return typeof json.text === "string" ? json.text : "";
}

export const transcribeVoiceAudio = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<VoiceTranscriptionResult> => {
    const elevenLabsKey = process.env["ELEVENLABS_API_KEY"];
    const groqKey = process.env["GROQ_API_KEY"];
    if (!elevenLabsKey && !groqKey) {
      return { ok: false, message: "Speech-to-text is not configured on the server." };
    }

    const bytes = Buffer.from(data.audioBase64, "base64");
    if (bytes.length === 0) return { ok: false, message: "No audio was recorded." };
    const mimeType = data.mimeType.split(";")[0]!;
    const audio = new Blob([bytes], { type: mimeType });
    const filename = `speech.${fileExtension(mimeType)}`;

    const attempts: { provider: TranscriptionProvider; run: () => Promise<string> }[] = [];
    if (elevenLabsKey) {
      attempts.push({
        provider: "elevenlabs",
        run: () => transcribeWithElevenLabs(audio, filename, elevenLabsKey),
      });
    }
    if (groqKey) {
      attempts.push({
        provider: "groq",
        run: () => transcribeWithGroq(audio, filename, groqKey, transcriptionPrompt(data.formId)),
      });
    }

    for (const attempt of attempts) {
      try {
        const text = (await attempt.run()).trim();
        if (text) return { ok: true, text, provider: attempt.provider };
      } catch (error) {
        if (import.meta.env.DEV) console.error("Voice transcription attempt failed", error);
      }
    }
    return {
      ok: false,
      message: "Speech could not be transcribed. Try again, or type the transcript.",
    };
  });
