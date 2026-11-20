import type { Clinic, ClinicDataSource } from "./types";

export type ClinicSelection =
  | { status: "missing"; clinic: null }
  | { status: "invalid"; clinic: null }
  | { status: "selected"; clinic: Clinic };

export interface PatientSearch {
  selectedClinicId?: string;
}

export function validatePatientSearch(search: Record<string, unknown>): PatientSearch {
  const selectedClinicId = search["selectedClinicId"];
  return typeof selectedClinicId === "string" ? { selectedClinicId } : {};
}

export async function resolveClinicSelection(
  selectedClinicId: string | undefined,
  dataSource: ClinicDataSource,
): Promise<ClinicSelection> {
  if (selectedClinicId === undefined) {
    return { status: "missing", clinic: null };
  }

  const clinics = await dataSource.listClinics();
  const clinic = clinics.find((candidate) => candidate.id === selectedClinicId);
  return clinic
    ? { status: "selected", clinic }
    : { status: "invalid", clinic: null };
}
