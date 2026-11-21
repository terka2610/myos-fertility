import { describe, expect, it, vi } from "vitest";
import {
  mapSnapshotToRegistry,
  readSupabaseSnapshot,
  readSupabaseCustodyEvents,
  readSupabaseRoutePoints,
} from "./supabase-read";

function rpcClient(result: { data: unknown; error: unknown | null }) {
  return {
    rpc: vi.fn().mockResolvedValue(result),
  } as never;
}

function tableClient(rows: unknown[] | null, error: unknown | null = null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: rows, error }),
      })),
    })),
  } as never;
}

describe("Supabase cryogenic sample reads", () => {
  it("maps a successful SMP-0001 snapshot without patient_code", () => {
    const sample = mapSnapshotToRegistry({
      sample_id: "SMP-0001",
      patient_code: "PRIVATE-123",
      sample_type: "Oocyte",
      current_state: "In storage",
      storage_site: "Cryogenic Storage Facility",
      latest_event_at: "2026-11-20T08:30:00.000Z",
    });

    expect(sample).toMatchObject({
      displayId: "SMP-0001",
      patientDisplayName: "Patient information protected",
      sampleType: "Oocyte",
      storageSite: "Cryogenic Storage",
      source: "supabase",
    });
    expect(JSON.stringify(sample)).not.toContain("PRIVATE-123");
  });

  it("reads a successful snapshot", async () => {
    const result = await readSupabaseSnapshot(
      rpcClient({
        data: [{ sample_id: "SMP-0001", status: "In storage" }],
        error: null,
      }),
      "SMP-0001",
    );
    expect(result.ok).toBe(true);
  });

  it("reports a missing snapshot", async () => {
    const result = await readSupabaseSnapshot(rpcClient({ data: [], error: null }), "SMP-9999");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("missing_sample");
  });

  it("reports network failures", async () => {
    const result = await readSupabaseSnapshot(
      {
        rpc: vi.fn().mockRejectedValue(new Error("Failed to fetch")),
      } as never,
      "SMP-0001",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("network");
  });

  it("reports exact permission failures", async () => {
    const result = await readSupabaseCustodyEvents(
      tableClient(null, {
        code: "42501",
        message: "permission denied for table custody_events",
      }),
      "SMP-0001",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("permission");
      expect(result.error.code).toBe("42501");
      expect(result.error.message).toContain("permission denied");
    }
  });

  it("reads custody_events and route_points filtered by sample_id", async () => {
    const custody = await readSupabaseCustodyEvents(
      tableClient([{ event_type: "Handover" }]),
      "SMP-0001",
    );
    const route = await readSupabaseRoutePoints(
      tableClient([{ location: "Cryogenic Storage" }]),
      "SMP-0001",
    );
    expect(custody.ok && custody.data).toEqual([{ event_type: "Handover" }]);
    expect(route.ok && route.data).toEqual([{ location: "Cryogenic Storage" }]);
  });
});
