// The main features, grouped by party. Each one is a numbered pin in that party's environment
// and a numbered card in the side panel. Keep it to two or three per party so the view stays simple.
// Set `route` to the matching page in the portal; `status` is demo text you can override with live data.
import type { Party } from "./nodes";

export interface Feature {
  id: string;
  party: Party;
  label: string;
  /** One or two plain sentences: what it does for the person using it. */
  description: string;
  status: string;
  route: string;
  /** Where the pin sits inside the party's environment (x, y, z). */
  position: [number, number, number];
}

export const FEATURES: Feature[] = [
  // Fertility centre
  {
    id: "documents",
    party: "centre",
    label: "Document check",
    description: "The centre completes its transfer pack: registration, consents and release. Counts follow the saved demo records.",
    status: "2 of 3 · serology report missing",
    route: "",
    position: [0, 2.45, 0.3],
  },
  {
    id: "consent",
    party: "centre",
    label: "Consent records",
    description: "Storage and transfer consent records. Voice fill only drafts form text; it is not clinical consent capture.",
    status: "Signed",
    route: "",
    position: [-2.5, 2.2, 0.9],
  },
  {
    id: "calendar",
    party: "centre",
    label: "Shipment booking",
    description: "The pickup is booked on the SHP-001 shipment form.",
    status: "Pickup today 10:30",
    route: "",
    position: [2.6, 2.4, -1.3],
  },

  // Cryo transport
  {
    id: "gps",
    party: "transport",
    label: "GPS monitor",
    description: "Open the GPS monitor demo feed. Its tracker positions are separate from this browser's sample records; no clinical ETA is inferred.",
    status: "On the road · ETA 11:15",
    route: "",
    position: [0, 2.0, 0], // relative to the moving van
  },
  {
    id: "freezer",
    party: "transport",
    label: "Time outside the freezer",
    description: "A freezer timer is not connected in this demo. Note time out of storage on SHP-012.",
    status: "14 min · limit 120 min (placeholder)",
    route: "",
    position: [2.3, 2.35, -2.6],
  },
  {
    id: "handover",
    party: "transport",
    label: "Witnessed pickup",
    description: "Chain-of-custody record for the centre to courier handover (SHP-011).",
    status: "Confirmed 10:31",
    route: "",
    position: [0, 1.95, -0.1],
  },

  // Cryogenic storage
  {
    id: "acceptance",
    party: "storage",
    label: "Acceptance check",
    description: "Receiving facility acceptance (SHP-016) and receipt records.",
    status: "Accepted 09:50",
    route: "",
    position: [-2.9, 2.55, 1.2],
  },
  {
    id: "placement",
    party: "storage",
    label: "Witnessed storage",
    description: "Tank and location register (INV-005) and seal reconciliation (SHP-017).",
    status: "Tank 3 · position B-12",
    route: "",
    position: [0, 2.85, -2.9],
  },
  {
    id: "readings",
    party: "storage",
    label: "Tank alerts",
    description: "Tank telemetry and alerts are not connected. Illustrative only.",
    status: "Normal · demo sensor data",
    route: "",
    position: [2.8, 2.05, 1.2],
  },

  // Patient
  {
    id: "updates",
    party: "patient",
    label: "Cryo demo chat",
    description: "Open the existing Cryo chat demonstration. This is not patient WhatsApp delivery; messages in the 3D scene remain illustrative.",
    status: "3 updates today",
    route: "",
    position: [-0.4, 3.75, 0],
  },
  {
    id: "whereis",
    party: "patient",
    label: "Where is my sample?",
    description: "Current journey stage, derived from the saved demo records.",
    status: "On its way · ETA 11:15",
    route: "",
    position: [2.5, 1.4, 0.4],
  },
];

export const featuresFor = (party: Party) => FEATURES.filter((f) => f.party === party);
