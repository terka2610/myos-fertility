// Temporary UI model; replace with Seidu's shared sample type when available.
export interface SampleRegistryRecord {
  displayId: string;
  patientDisplayName: string;
  sampleType: string;
  currentState: string;
  storageSite: string;
  latestEventAt: string;
  source?: "supabase" | "synthetic";
}

export interface SampleDataSource {
  listSamples(): Promise<readonly SampleRegistryRecord[]>;
}

export type JourneyMilestoneStatus = "completed" | "current" | "pending";
export type ETASource = "scheduled" | "calculated" | "simulated";

export interface JourneyMilestone {
  id: string;
  title: string;
  facility: "Fertility Centre" | "Cryo Transport" | "Cryogenic Storage";
  at: string | null;
  status: JourneyMilestoneStatus;
  kind?: "outbound" | "return";
}

export interface JourneyRoutePoint {
  id: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  facility: "Fertility Centre" | "Cryo Transport" | "Cryogenic Storage";
  label: string;
}

export interface SyntheticJourney {
  sampleId: string;
  pickupAt: string;
  etaAt: string;
  etaSource: ETASource;
  currentStage: string;
  state: "outbound" | "return";
  milestones: readonly JourneyMilestone[];
  routePoints: readonly JourneyRoutePoint[];
  returnJourney: boolean;
}
