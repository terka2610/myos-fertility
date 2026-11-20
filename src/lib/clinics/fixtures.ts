import type { Clinic } from "./types";

// These local fixture IDs are temporary and are not Seidu's facility database IDs.
export const DEMO_CLINICS = [
  {
    id: "demo-clinic-a",
    name: "Clinic A",
    location: "Demo location",
    description: "A fictional fertility clinic for the MYOS hackathon demo.",
    careOptions: ["Fertility consultations", "IVF", "Egg freezing"],
  },
  {
    id: "demo-clinic-b",
    name: "Clinic B",
    location: "Demo location",
    description: "A fictional fertility clinic for the MYOS hackathon demo.",
    careOptions: ["Fertility consultations", "IVF", "Care coordination"],
  },
  {
    id: "demo-clinic-c",
    name: "Clinic C",
    location: "Demo location",
    description: "A fictional fertility clinic for the MYOS hackathon demo.",
    careOptions: ["Fertility consultations", "Egg freezing", "Care coordination"],
  },
] satisfies readonly Clinic[];
