// Standard Webhooks signature check (pure, Web Crypto only).
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};

export async function verifyStandardWebhook(secret: string, id: string | null, ts: string | null, sigHeader: string | null, body: string, nowSec = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!id || !ts || !sigHeader) return false;
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(nowSec - t) > 300) return false;
  let raw: Uint8Array<ArrayBuffer>;
  try { raw = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0)); }
  catch { return false; }
  if (!raw.length) return false;
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = b64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`)));
  return sigHeader.split(" ").some((p) => { const [v, s] = p.split(","); return v === "v1" && !!s && safeEqual(s, expected); });
}

export const maskHandle = (h: string) => `Text from •••${h.replace(/\D/g, "").slice(-4)}`;
