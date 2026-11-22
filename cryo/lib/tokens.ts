export const SAMPLE_ID = /^SMP-\d{4}$/;

export const DEMO_SAMPLE_ID = "SMP-0001";

export const FACILITY_CODES = ["CLINIC-A", "CRYOPORT", "CRYONEXT"] as const;

export type FacilityCode = (typeof FACILITY_CODES)[number];
