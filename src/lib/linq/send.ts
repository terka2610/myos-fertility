/** Linq requires message.parts, not top-level parts, for every kind of reply. */
export async function sendLinqText(
  request: (path: string, body?: unknown) => Promise<Response>,
  text: string,
) {
  if (!text.trim()) throw new Error("Cannot send an empty Linq reply");
  const response = await request("messages", { message: { parts: [{ type: "text", value: text }] } });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Linq send failed [${response.status}]: ${body}`);
    throw new Error(`Linq send failed [${response.status}]: ${body}`);
  }
  return response;
}