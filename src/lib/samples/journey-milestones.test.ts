import { describe, expect, it } from "vitest";
import { milestonesFromCustody } from "./journey-milestones";

const statusById = (rows: Record<string, unknown>[]) =>
  Object.fromEntries(milestonesFromCustody(rows).map((m) => [m.id, [m.status, m.at]]));

describe("milestonesFromCustody", () => {
  it("marks reached milestones from custody events and the latest one as current", () => {
    expect(
      statusById([
        { step: "in_transit", recorded_at: "2026-11-19T07:20:00Z" },
        { step: "collected", recorded_at: "2026-11-19T06:00:00Z" },
        { step: "released", recorded_at: "2026-11-19T07:10:00Z" },
      ]),
    ).toEqual({
      pickup: ["completed", "2026-11-19T07:10:00Z"],
      "transport-handover": ["current", "2026-11-19T07:20:00Z"],
      "storage-arrival": ["pending", null],
      "return-request": ["pending", null],
      "return-handover": ["pending", null],
      "return-arrival": ["pending", null],
    });
  });

  it("completes the outbound leg on arrival and tracks the return trip", () => {
    const result = statusById([
      { step: "released", recorded_at: "2026-11-19T07:10:00Z" },
      { step: "in_transit", recorded_at: "2026-11-19T07:20:00Z" },
      { step: "arrived_storage", recorded_at: "2026-11-19T09:00:00Z" },
      { step: "release_requested", recorded_at: "2026-11-20T09:00:00Z" },
    ]);
    expect(result["storage-arrival"]).toEqual(["completed", "2026-11-19T09:00:00Z"]);
    expect(result["return-request"]).toEqual(["current", "2026-11-20T09:00:00Z"]);

    const arrivedOnly = statusById([
      { step: "released", recorded_at: "2026-11-19T07:10:00Z" },
      { step: "stored", recorded_at: "2026-11-19T10:00:00Z" },
    ]);
    expect(arrivedOnly["storage-arrival"]).toEqual(["completed", "2026-11-19T10:00:00Z"]);
  });

  it("ignores rows without a step or valid time", () => {
    expect(
      milestonesFromCustody([{ step: "released" }, { recorded_at: "2026-11-19T07:10:00Z" }]).every(
        (m) => m.status === "pending",
      ),
    ).toBe(true);
  });
});
