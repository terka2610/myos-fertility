import { expect, it } from "vitest";
import { twinReturnTarget } from "./login-return";
it("preserves a resource question through login", () => {
  expect(twinReturnTarget('/twin/chat/d0c70000-0000-4000-8000-000000000004?q=Does%20egg%20retrieval%20hurt%3F')).toEqual({ doctorId: 'd0c70000-0000-4000-8000-000000000004', q: 'Does egg retrieval hurt?', patient: undefined });
});
it("rejects external login return destinations", () => {
  expect(twinReturnTarget('//example.com/twin/chat/d0c70000-0000-4000-8000-000000000004')).toBeNull();
  expect(twinReturnTarget('https://example.com')).toBeNull();
});