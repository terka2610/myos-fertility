import type { Clinic } from "./types.ts";

/** Fictional local fixtures; these IDs are not facility or patient-record IDs. */
export const DEMO_CLINICS = [
  {
    id: "demo-clinic-a",
    name: "Clinic A",
    location: "Demo location",
    description: "A fictional fertility clinic used for the MYOS workflow demonstration.",
    careOptions: ["Fertility consultations", "IVF", "Egg freezing"],
  },
  {
    id: "demo-clinic-b",
    name: "Clinic B",
    location: "Demo location",
    description: "A fictional fertility clinic used for the MYOS workflow demonstration.",
    careOptions: ["Fertility consultations", "IVF", "Care coordination"],
  },
  {
    id: "demo-clinic-c",
    name: "Clinic C",
    location: "Demo location",
    description: "A fictional fertility clinic used for the MYOS workflow demonstration.",
    careOptions: ["Fertility consultations", "Egg freezing", "Care coordination"],
  },
] satisfies readonly Clinic[];
