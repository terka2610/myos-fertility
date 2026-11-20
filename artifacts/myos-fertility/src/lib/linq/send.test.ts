import { describe, it, expect, vi } from "vitest";
import { sendLinqText } from "./send";

describe("Linq replies", () => {
  it("sends text inside the required message.parts envelope", async () => {
    const request = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await sendLinqText(request, "Hello from Dr Tessa's twin");
    expect(request).toHaveBeenCalledWith("messages", { message: { parts: [{ type: "text", value: "Hello from Dr Tessa's twin" }] } });
  });
  it("surfaces a rejected API key rather than treating the reply as sent", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const request = vi.fn().mockResolvedValue(new Response("Invalid or expired token", { status: 401 }));
    await expect(sendLinqText(request, "Hello")).rejects.toThrow("Linq send failed [401]");
    vi.restoreAllMocks();
  });
});