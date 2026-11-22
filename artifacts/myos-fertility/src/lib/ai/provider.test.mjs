import assert from "node:assert/strict";
import test from "node:test";
import { selectChatProvider } from "./provider.server.ts";

test("Groq takes priority over legacy providers and honors the configured model", () => {
  const provider = selectChatProvider({
    GROQ_API_KEY: "test-groq-placeholder",
    GROQ_MODEL: "openai/gpt-oss-120b",
    OPENAI_API_KEY: "test-openai-placeholder",
    LOVABLE_API_KEY: "test-legacy-placeholder",
  });
  assert.equal(provider?.url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(provider?.model, "openai/gpt-oss-120b");
  assert.equal(provider?.key, "test-groq-placeholder");
});

test("missing provider configuration fails explicitly without inventing a key", () => {
  assert.equal(selectChatProvider({}), null);
  assert.equal(selectChatProvider({ GROQ_API_KEY: "test-placeholder" })?.model, "openai/gpt-oss-120b");
});

test("legacy provider is retained only when Groq is not configured", () => {
  assert.equal(selectChatProvider({ OPENAI_API_KEY: "test-placeholder" })?.model, "gpt-4o-mini");
  assert.equal(selectChatProvider({ LOVABLE_API_KEY: "test-placeholder" })?.url, "https://ai.gateway.lovable.dev/v1/chat/completions");
});
