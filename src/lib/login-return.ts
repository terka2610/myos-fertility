export function twinReturnTarget(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  const url = new URL(value, "https://myosfertility.lovable.app");
  const match = /^\/twin\/chat\/([\da-f-]{36})$/.exec(url.pathname);
  if (!match?.[1]) return null;
  return { doctorId: match[1], q: url.searchParams.get("q") ?? undefined, patient: url.searchParams.get("patient") ?? undefined };
}