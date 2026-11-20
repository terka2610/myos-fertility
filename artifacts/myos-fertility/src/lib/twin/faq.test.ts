import { describe, it, expect } from "vitest";
import { matchFaq, outOfScope, asksMedicationAdvice } from "./faq";

describe("deterministic answers", () => {
  it("answers IVF basics", () => expect(matchFaq("How does IVF work?")?.id).toBe("ivf-what"));
  it("answers egg freezing", () => expect(matchFaq("I'm thinking about freezing my eggs")?.topic).toBe("Egg freezing"));
  it("answers surrogacy", () => expect(matchFaq("What is a surrogate?")?.topic).toBe("Surrogacy"));
  it("same question gives same answer", () => expect(matchFaq("what is egg retrieval")?.answer).toBe(matchFaq("What is egg retrieval?")?.answer));
});

describe("guardrails", () => {
  it("blocks off-topic questions", () => expect(outOfScope("What's the best pizza in Rome?")).toBe(true));
  it("keeps reproductive questions", () => expect(outOfScope("Can PCOS affect my cycle?")).toBe(false));
  it("refuses medication recommendations", () => expect(asksMedicationAdvice("Should I take metformin?")).toBe(true));
  it("allows general medicine explanations", () => expect(asksMedicationAdvice("What does progesterone do?")).toBe(false));
});

import { asksIdentity as _id } from "./faq";
describe("identity questions", () => {
  it("treats 'who are you?' as an identity question", () => { expect(_id("Who are you?")).toBe(true); });
  it("does not treat a dosing question as identity", () => { expect(_id("I missed my dose, should I double it?")).toBe(false); });
});
