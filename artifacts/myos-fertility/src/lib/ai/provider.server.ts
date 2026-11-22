/** Server-only provider selection. Never return this object from a server function. */
export function selectChatProvider(env: Record<string, string | undefined>) {
  if (env["GROQ_API_KEY"]) {
    return {
      key: env["GROQ_API_KEY"],
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: env["GROQ_MODEL"]?.trim() || "openai/gpt-oss-120b",
    };
  }
  if (env["OPENAI_API_KEY"]) {
    return {
      key: env["OPENAI_API_KEY"],
      url: "https://api.openai.com/v1/chat/completions",
      model: env["OPENAI_MODEL"]?.trim() || "gpt-4o-mini",
    };
  }
  if (env["LOVABLE_API_KEY"]) {
    return {
      key: env["LOVABLE_API_KEY"],
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      model: "openai/gpt-6.1-terra",
    };
  }
  return null;
}

export function getChatProvider() {
  return selectChatProvider(process.env);
}

export const AI_REQUEST_TIMEOUT_MS = 25_000;
