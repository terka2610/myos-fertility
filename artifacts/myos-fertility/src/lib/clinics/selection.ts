import type { Clinic, ClinicDataSource } from "./types.ts";

export type ClinicSelection =
  | { status: "missing"; clinic: null }
  | { status: "invalid"; clinic: null }
  | { status: "selected"; clinic: Clinic };

export interface PatientSearch {
  selectedClinicId?: string;
}

export function validatePatientSearch(search: Record<string, unknown>): PatientSearch {
  const value = search["selectedClinicId"];
  return typeof value === "string" && value.length <= 80
    ? { selectedClinicId: value }
    : {};
}

export async function resolveClinicSelection(
  selectedClinicId: string | undefined,
  dataSource: ClinicDataSource,
): Promise<ClinicSelection> {
  if (selectedClinicId === undefined) return { status: "missing", clinic: null };
  const clinics = await dataSource.listClinics();
  const clinic = clinics.find((candidate) => candidate.id === selectedClinicId);
  return clinic ? { status: "selected", clinic } : { status: "invalid", clinic: null };
}
