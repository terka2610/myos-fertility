// Temporary UI model; replace with Seidu's shared sample type when available.
export interface SampleRegistryRecord {
  displayId: string;
  patientDisplayName: string;
  sampleType: string;
  currentState: string;
  storageSite: string;
  latestEventAt: string;
}

export interface SampleDataSource {
  listSamples(): Promise<readonly SampleRegistryRecord[]>;
}
