import assert from "node:assert/strict";
import test from "node:test";
import { resolveClinicSelection, validatePatientSearch } from "./selection.ts";

const source = {
  async listClinics() {
    return [{ id: "demo-clinic-a", name: "Clinic A", location: "Demo", description: "Fictional", careOptions: [] }];
  },
};

test("clinic selection handles missing, selected, and unknown IDs", async () => {
  assert.deepEqual(await resolveClinicSelection(undefined, source), {
    status: "missing",
    clinic: null,
  });
  assert.equal((await resolveClinicSelection("demo-clinic-a", source)).status, "selected");
  assert.deepEqual(await resolveClinicSelection("real-facility-id", source), {
    status: "invalid",
    clinic: null,
  });
});

test("clinic search accepts only a bounded string ID", () => {
  assert.deepEqual(validatePatientSearch({ selectedClinicId: "demo-clinic-a" }), {
    selectedClinicId: "demo-clinic-a",
  });
  assert.deepEqual(validatePatientSearch({ selectedClinicId: 12 }), {});
  assert.deepEqual(validatePatientSearch({ selectedClinicId: "x".repeat(81) }), {});
});
