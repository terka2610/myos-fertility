import { describe, expect, it } from "vitest";
import { canContinueSetup, doctorInput } from "./setup";

describe("optional twin uploads", () => {
  it.each([1, 2, 3])("allows continuing upload step %s without files", (step) => {
    expect(canContinueSetup(step, "Demo doctor", false)).toBe(true);
    expect(canContinueSetup(step, "Demo doctor", true)).toBe(false);
  });
  it("allows saving a draft without knowledge documents", () => {
    expect(doctorInput.safeParse({
      name: "Demo doctor", clinic: "", specialty: "Fertility", languages: "English", bio: "",
      is_female: false, treats_pcos: false, treats_endo: false, supports_queer_trans: false, supports_single_women: false,
      consent: true, photos: ["/tessa.jpg"], mouth_x: 0.5, mouth_y: 0.72, documents: [],
    }).success).toBe(true);
  });
});