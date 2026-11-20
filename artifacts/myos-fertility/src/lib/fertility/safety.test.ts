import { describe, expect, it } from "vitest";
import { classify } from "./safety";

describe("fertility safety classification", () => {
  it("treats swelling with less urine as an OHSS emergency", () => {
    const r = classify("My belly is very swollen and I'm urinating much less");
    expect(r.category).toBe("emergency");
    expect(r.subtype).toBe("ohss_warning");
    expect(r.deterministic).toBe(true);
  });
  it("routes a missed injection to a fixed medication reply", () => {
    const r = classify("I missed yesterday's injection, should I double it?");
    expect(r.category).toBe("time_sensitive_medication");
    expect(r.risk_level).toBe("urgent");
  });
  it("detects crisis language first", () => {
    expect(classify("I want to end my life").category).toBe("crisis");
  });
  it("blocks partners from a patient's private results", () => {
    expect(classify("Tell me her estradiol results", "partner").category).toBe("partner_authorization");
    expect(classify("Tell me her estradiol results", "patient").category).not.toBe("partner_authorization");
  });
  it("lets general education through to the AI", () => {
    const r = classify("What is progesterone doing?");
    expect(r.category).toBe("general_education");
    expect(r.deterministic).toBe(false);
  });
});
