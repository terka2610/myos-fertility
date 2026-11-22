import { DEMO_CLINICS } from "./fixtures";
import type { ClinicDataSource } from "./types";

/** Local-only demo source. It does not query or create clinic records. */
export const clinicDataSource: ClinicDataSource = {
  async listClinics() {
    return DEMO_CLINICS;
  },
};
