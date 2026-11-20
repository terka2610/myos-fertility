import { describe, expect, it } from "vitest";
import { parseLinqEvent } from "./event";

describe("Linq inbound formats", () => {
  it("accepts the current message format", () => {
    const result = parseLinqEvent(JSON.stringify({ event_id: "e1", event_type: "message.received", data: { direction: "inbound", chat: { id: "c1", is_group: false }, sender_handle: { handle: "+14155551234" }, parts: [{ type: "text", value: "hello" }] } }));
    expect(result?.data.direction).toBe("inbound");
    expect(result?.data.parts[0]?.value).toBe("hello");
  });
  it("normalizes older messages instead of silently skipping them", () => {
    const result = parseLinqEvent(JSON.stringify({ event_id: "e2", event_type: "message.received", data: { chat_id: "c2", from: "+14155551234", is_from_me: false, is_group: false, message: { parts: [{ type: "text", value: "hello" }] } } }));
    expect(result?.data.chat.id).toBe("c2");
    expect(result?.data.direction).toBe("inbound");
    expect(result?.data.sender_handle.handle).toBe("+14155551234");
  });
  it("preserves outbound and group markers so they remain excluded", () => {
    const result = parseLinqEvent(JSON.stringify({ event_id: "e3", event_type: "message.received", data: { chat_id: "c3", from: "+14155551234", is_from_me: true, is_group: true, message: { parts: [] } } }));
    expect(result?.data.direction).toBe("outbound");
    expect(result?.data.chat.is_group).toBe(true);
  });
  it("rejects malformed data", () => {
    expect(parseLinqEvent("not json")).toBeNull();
    expect(parseLinqEvent('{"event_id":"e4"}')).toBeNull();
  });
});