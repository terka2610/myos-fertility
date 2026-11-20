import { DEMO_CLINICS } from "./fixtures";
import type { ClinicDataSource } from "./types";

export const clinicDataSource: ClinicDataSource = {
  async listClinics() {
    return DEMO_CLINICS;
  },
};
