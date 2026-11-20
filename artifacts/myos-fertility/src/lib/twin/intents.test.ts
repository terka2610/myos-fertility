import { describe, it, expect } from "vitest";
import { bookingText, notCoveredText } from "./intents";

describe("booking and not-covered replies", () => {
  it("booking reply for Tessa offers her agent and text number", () => { expect(bookingText("Tessa", true)).toContain("(415) 799-0277"); });
  it("booking reply for other doctors has no agent number", () => { expect(bookingText("Elena", false)).not.toContain("799-0277"); });
  it("not-covered reply names the doctor's guides", () => { expect(notCoveredText("Tessa")).toBe("That's not in Dr Tessa's guides yet. Want me to ask the clinic?"); });
});
