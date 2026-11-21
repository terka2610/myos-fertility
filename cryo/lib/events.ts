export const CUSTODY_STEPS = [
  "collected",
  "consent_recorded",
  "released",
  "in_transit",
  "arrived_storage",
  "stored",
  "release_requested",
  "in_transit_return",
  "received",
  "verified",
] as const;

export type CustodyStep = (typeof CUSTODY_STEPS)[number];

export const SAMPLE_STATUSES = [
  "at_clinic",
  "in_transit",
  "in_storage",
  "returning",
  "received",
] as const;

export type SampleStatus = (typeof SAMPLE_STATUSES)[number];
