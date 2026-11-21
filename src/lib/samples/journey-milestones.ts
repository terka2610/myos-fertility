import type { JourneyMilestone } from "./types";

// Builds the Journey Calendar milestone list from real custody_events rows, using the same
// milestones as the simulated journey so the page looks the same with live data.

const MILESTONES: readonly {
  id: string;
  title: string;
  facility: JourneyMilestone["facility"];
  kind: "outbound" | "return";
  steps: readonly string[];
  final?: boolean;
}[] = [
  {
    id: "pickup",
    title: "Pickup",
    facility: "Fertility Centre",
    kind: "outbound",
    steps: ["released"],
  },
  {
    id: "transport-handover",
    title: "Transport handover",
    facility: "Cryo Transport",
    kind: "outbound",
    steps: ["in_transit"],
  },
  {
    id: "storage-arrival",
    title: "Storage arrival",
    facility: "Cryogenic Storage",
    kind: "outbound",
    steps: ["arrived_storage", "stored"],
    final: true,
  },
  {
    id: "return-request",
    title: "Return requested",
    facility: "Fertility Centre",
    kind: "return",
    steps: ["release_requested"],
  },
  {
    id: "return-handover",
    title: "Return handover",
    facility: "Cryo Transport",
    kind: "return",
    steps: ["in_transit_return"],
  },
  {
    id: "return-arrival",
    title: "Return arrival",
    facility: "Fertility Centre",
    kind: "return",
    steps: ["received", "verified"],
    final: true,
  },
];

export function milestonesFromCustody(
  rows: readonly Record<string, unknown>[],
): JourneyMilestone[] {
  const firstAt = new Map<string, string>();
  const events = rows
    .flatMap((row) =>
      typeof row["step"] === "string" &&
      typeof row["recorded_at"] === "string" &&
      Number.isFinite(Date.parse(row["recorded_at"]))
        ? [{ step: row["step"], at: row["recorded_at"] }]
        : [],
    )
    .sort((first, second) => Date.parse(first.at) - Date.parse(second.at));
  for (const event of events) if (!firstAt.has(event.step)) firstAt.set(event.step, event.at);

  const reached = MILESTONES.map((milestone) => {
    const at = milestone.steps.map((step) => firstAt.get(step)).find(Boolean) ?? null;
    return { milestone, at };
  });
  let lastReached = -1;
  reached.forEach((entry, index) => {
    if (entry.at) lastReached = index;
  });

  return reached.map(({ milestone, at }, index) => ({
    id: milestone.id,
    title: milestone.title,
    facility: milestone.facility,
    kind: milestone.kind,
    at,
    status: !at ? "pending" : index === lastReached && !milestone.final ? "current" : "completed",
  }));
}
