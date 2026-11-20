import { describe, it, expect } from "vitest";
import { escalationReason, retrieveChunks, matchesDoctor, chunkPages } from "./rules";

describe("twin escalation", () => {
  it("escalates dose changes", () => expect(escalationReason("Should I increase my Gonal-f dose to 300 units?")).not.toBeNull());
  it("escalates missed doses", () => expect(escalationReason("I missed my injection last night")).not.toBeNull());
  it("escalates conflicting instructions", () => expect(escalationReason("The nurse said something different from the leaflet")).not.toBeNull());
  it("escalates test results", () => expect(escalationReason("Is my AMH of 0.8 low?")).not.toBeNull());
  it("escalates worrying symptoms", () => expect(escalationReason("I have severe pain and bleeding")).not.toBeNull());
  it("answers general questions", () => expect(escalationReason("How long does egg retrieval take?")).toBeNull());
});

describe("twin retrieval and match", () => {
  const chunks = chunkPages("protocol.pdf", ["Egg retrieval\nEgg retrieval takes about 20 minutes under sedation.", "Storage\nFrozen eggs are stored in liquid nitrogen."]);
  it("finds the covering passage", () => expect(retrieveChunks("how long is egg retrieval", chunks)[0]?.chunk.section).toContain("Page 1"));
  it("returns nothing when documents do not cover it", () => expect(retrieveChunks("parking costs", chunks)).toHaveLength(0));
  const d = { is_female: true, treats_pcos: false, treats_endo: true, supports_queer_trans: true, supports_single_women: true, languages: "English, Spanish" };
  it("excludes doctors missing a selected preference", () => expect(matchesDoctor(d, ["pcos"])).toBe(false));
  it("matches language", () => expect(matchesDoctor(d, ["female", "language"], "spanish")).toBe(true));
  const aisha = { ...d, treats_pcos: false, treats_endo: false };
  const elena = { ...d, supports_queer_trans: false };
  it("excludes Aisha for a PCOS expertise preference", () => expect(matchesDoctor(aisha, ["pcos"])).toBe(false));
  it("excludes Elena for a queer/trans expertise preference", () => expect(matchesDoctor(elena, ["queer"])).toBe(false));
});
