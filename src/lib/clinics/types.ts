export interface Clinic {
  id: string;
  name: string;
  location: string;
  description: string;
  careOptions: readonly string[];
}

export interface ClinicDataSource {
  listClinics(): Promise<readonly Clinic[]>;
}
