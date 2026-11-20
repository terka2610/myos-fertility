import { describe, expect, it } from "vitest";

import { DEMO_CLINICS } from "./fixtures";
import { resolveClinicSelection, validatePatientSearch } from "./selection";
import type { ClinicDataSource } from "./types";

const demoDataSource: ClinicDataSource = {
  async listClinics() {
    return DEMO_CLINICS;
  },
};

describe("clinic selection", () => {
  it("accepts a string selectedClinicId and ignores non-string search values", () => {
    expect(validatePatientSearch({ selectedClinicId: "demo-clinic-a" })).toEqual({
      selectedClinicId: "demo-clinic-a",
    });
    expect(validatePatientSearch({ selectedClinicId: ["demo-clinic-a"] })).toEqual({});
    expect(validatePatientSearch({})).toEqual({});
  });

  it.each(DEMO_CLINICS)("resolves $name from the data source", async (clinic) => {
    await expect(resolveClinicSelection(clinic.id, demoDataSource)).resolves.toEqual({
      status: "selected",
      clinic,
    });
  });

  it("distinguishes a missing selection from an unknown ID", async () => {
    await expect(resolveClinicSelection(undefined, demoDataSource)).resolves.toEqual({
      status: "missing",
      clinic: null,
    });
    await expect(resolveClinicSelection("unknown-clinic", demoDataSource)).resolves.toEqual({
      status: "invalid",
      clinic: null,
    });
  });
});
