import { describe, it, expect } from "vitest";
import { verifyStandardWebhook, maskHandle } from "./verify";

const secret = "whsec_" + btoa("test-secret-key-1234567890");
async function sign(id: string, ts: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-secret-key-1234567890"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`)))));
}

describe("Linq webhook signature", () => {
  it("accepts a valid signature", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(await verifyStandardWebhook(secret, "msg_1", ts, `v1,${await sign("msg_1", ts, "{}")}`, "{}")).toBe(true);
  });
  it("rejects a wrong signature", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    expect(await verifyStandardWebhook(secret, "msg_1", ts, "v1,AAAA", "{}")).toBe(false);
  });
  it("rejects a timestamp more than 5 minutes old", async () => {
    const ts = String(Math.floor(Date.now() / 1000) - 301);
    expect(await verifyStandardWebhook(secret, "msg_1", ts, `v1,${await sign("msg_1", ts, "{}")}`, "{}")).toBe(false);
  });
  it("shows only the last 4 digits", () => { expect(maskHandle("+1 (415) 555-1234")).toBe("Text from •••1234"); });
  it("rejects malformed signing secrets without crashing", async () => {
    expect(await verifyStandardWebhook("whsec_invalid%", "e1", String(Math.floor(Date.now() / 1000)), "v1,AAAA", "{}")).toBe(false);
  });
});
