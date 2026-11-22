const VOICE_TIMEOUT_MS = 25_000;

/** Keys and provider responses stay on the server. No audio or transcript is persisted here. */
export async function synthesizeSpeech(text: string, voiceId?: string): Promise<{
  audio: string | null;
  provider: "elevenlabs" | "browser";
}> {
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) return { audio: null, provider: "browser" };
  const voice = voiceId || process.env["ELEVENLABS_VOICE_ID_FEMALE"] || "EXAVITQu4vr4xnSDxMaL";
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
      signal: AbortSignal.timeout(VOICE_TIMEOUT_MS),
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text.replace(/\[\d+\]/g, "").replace(/[*#_`]/g, ""),
        model_id: "eleven_turbo_v2_5",
      }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      const allowedReasons = ["missing_permissions", "invalid_api_key", "quota_exceeded", "voice_not_found", "unauthorized"];
      const reason = allowedReasons.includes(failure?.detail?.status) ? failure.detail.status : "provider_rejected";
      console.error(`ElevenLabs speech unavailable [${response.status}: ${reason}]`);
      return { audio: null, provider: "browser" };
    }
    if (!response.headers.get("content-type")?.startsWith("audio/")) {
      return { audio: null, provider: "browser" };
    }
    return { audio: Buffer.from(await response.arrayBuffer()).toString("base64"), provider: "elevenlabs" };
  } catch {
    console.error("ElevenLabs speech request timed out or could not connect");
    return { audio: null, provider: "browser" };
  }
}
