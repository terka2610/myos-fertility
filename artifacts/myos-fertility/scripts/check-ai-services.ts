// Explicit operator smoke check: only synthetic text; no patient data or persisted audio.
// Never print provider configuration, headers, response bodies or keys.
import { getChatProvider } from "../src/lib/ai/provider.server";
import { synthesizeSpeech } from "../src/lib/ai/voice.server";

async function check() {
  const provider = getChatProvider();
  if (!provider) {
    console.info("AI chat: not configured");
  } else {
    try {
      const response = await fetch(provider.url, {
        method: "POST",
        signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: "user", content: 'Synthetic connectivity check. Reply with the single word "ready".' }],
          max_completion_tokens: 64,
        }),
      });
      const body = response.ok ? await response.json() : null;
      console.info(JSON.stringify({ service: "AI chat", status: response.status, usable: Boolean(body?.choices?.[0]?.message?.content) }));
    } catch {
      console.info("AI chat: connection failed or timed out");
    }
  }
  const voice = await synthesizeSpeech("MYOS demo ready.");
  console.info(JSON.stringify({ service: "ElevenLabs speech", usable: voice.provider === "elevenlabs" && Boolean(voice.audio) }));
  if (!voice.audio && process.env["ELEVENLABS_API_KEY"]) {
    try {
      const response = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": process.env["ELEVENLABS_API_KEY"]! },
        signal: AbortSignal.timeout(15_000),
      });
      const result = response.ok ? null : await response.json();
      const code = result?.detail?.status;
      const known = ["invalid_api_key", "missing_permissions", "quota_exceeded", "unauthorized", "unusual_activity"];
      console.info(JSON.stringify({
        service: "ElevenLabs account authorization", status: response.status,
        reason: known.includes(code) ? code : "Check key validity and text-to-speech permissions",
      }));
      if (!response.bodyUsed) await response.body?.cancel();
    } catch {
      console.info("ElevenLabs account authorization: diagnostic unavailable");
    }
  }

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (url && key) {
    for (const [label, path] of [
      ["Supabase authentication", "/auth/v1/settings"],
      ["Supabase doctor schema", "/rest/v1/twin_doctors?select=id&limit=0"],
      ["Supabase care schema", "/rest/v1/care_programs?select=id&limit=0"],
    ]) {
      try {
        const response = await fetch(new URL(path, url), {
          headers: { apikey: key }, signal: AbortSignal.timeout(15_000),
        });
        console.info(JSON.stringify({ service: label, status: response.status }));
        await response.body?.cancel();
      } catch {
        console.info(`${label}: connection failed or timed out`);
      }
    }
  } else {
    console.info("Supabase: not configured");
  }
}

await check();
