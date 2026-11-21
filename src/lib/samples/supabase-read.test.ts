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
      public_id: "SMP-0001",
      patient_code: "PRIVATE-123",
      specimen_type: "Oocyte",
      status: "in_transit",
      collected_at: "2026-11-18T08:30:00.000Z",
      facility: { code: "CRYONEXT", name: "Cryonext Facility" },
    });

    expect(sample).toMatchObject({
      displayId: "SMP-0001",
      patientDisplayName: "Patient information protected",
      sampleType: "Oocyte",
      currentState: "in_transit",
      storageSite: "Cryogenic Storage",
      source: "supabase",
    });
    expect(JSON.stringify(sample)).not.toContain("PRIVATE-123");
  });

  it("maps each actual facility code and does not use collected_at as latest custody", () => {
    const clinic = mapSnapshotToRegistry({
      public_id: "SMP-0001",
      specimen_type: "Oocyte",
      status: "collected",
      collected_at: "2026-11-18T08:30:00.000Z",
      facility: { code: "CLINIC-A", name: "Clinic" },
    });
    const transport = mapSnapshotToRegistry({
      public_id: "SMP-0002",
      specimen_type: "Embryo",
      status: "in_transit",
      collected_at: "2026-11-18T08:30:00.000Z",
      facility: { code: "CRYOPORT", name: "Transport" },
    });

    expect(clinic).toMatchObject({ displayId: "SMP-0001", storageSite: "Fertility Centre" });
    expect(transport).toMatchObject({ displayId: "SMP-0002", storageSite: "Cryo Transport" });
    expect(clinic?.latestEventAt).not.toBe("2026-11-18T08:30:00.000Z");
  });

  it("reads a successful snapshot", async () => {
    const rpc = rpcClient({
      data: [{ public_id: "SMP-0001", specimen_type: "Oocyte", status: "in_transit" }],
      error: null,
    });
    const rpcMock = rpc as { rpc: ReturnType<typeof vi.fn> };
    const result = await readSupabaseSnapshot(rpc, "SMP-0001");
    expect(result.ok).toBe(true);
    expect(rpcMock.rpc).toHaveBeenCalledWith("sample_snapshot", { sample_code: "SMP-0001" });
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

  it("classifies a missing public RPC as a missing function result", () => {
    const rpc = rpcClient({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.sample_snapshot(sample_id) in the schema cache",
      },
    });
    return readSupabaseSnapshot(rpc, "SMP-0001").then((result) => {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PGRST202");
        expect(result.error.message).toContain("sample_snapshot");
      }
    });
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
