import { describe, expect, it } from "vitest";
import { fetchLatestFix, parseLatestFix } from "./gps-monitor";

const PAYLOAD = {
  server_time: "2026-11-21T12:00:05Z",
  position_count: 10,
  assets: [
    { asset_id: "phone-demo", last: null, trail: [] },
    {
      asset_id: "vehicle-cryo-01",
      kind: "vehicle",
      label: "Courier van",
      last: {
        lat: 24.452,
        lon: 54.575,
        speed_kmh: 48,
        accuracy_m: 12,
        recorded_at: "2026-11-21T12:00:00Z",
        source: "owntracks",
      },
      trail: [],
    },
  ],
};

describe("parseLatestFix", () => {
  it("reads the courier's last fix from /api/latest", () => {
    expect(parseLatestFix(PAYLOAD, "vehicle-cryo-01")).toEqual({
      ok: true,
      fix: {
        assetId: "vehicle-cryo-01",
        lat: 24.452,
        lon: 54.575,
        recordedAt: "2026-11-21T12:00:00Z",
        speedKmh: 48,
        accuracyM: 12,
      },
    });
  });

  it("reports missing assets, missing fixes and malformed payloads", () => {
    expect(parseLatestFix(PAYLOAD, "bag-ship-01")).toEqual({ ok: false, reason: "no_fix" });
    expect(parseLatestFix(PAYLOAD, "phone-demo")).toEqual({ ok: false, reason: "no_fix" });
    expect(parseLatestFix({ nope: true }, "vehicle-cryo-01")).toEqual({
      ok: false,
      reason: "invalid_response",
    });
  });
});

describe("fetchLatestFix", () => {
  it("calls GET /api/latest on the configured monitor", async () => {
    let calledUrl = "";
    const result = await fetchLatestFix("vehicle-cryo-01", "http://monitor.test/", async (url) => {
      calledUrl = String(url);
      return new Response(JSON.stringify(PAYLOAD), { status: 200 });
    });
    expect(calledUrl).toBe("http://monitor.test/api/latest");
    expect(result.ok).toBe(true);
  });

  it("fails safely when the monitor is not configured or unreachable", async () => {
    expect(await fetchLatestFix("vehicle-cryo-01", undefined)).toEqual({
      ok: false,
      reason: "not_configured",
    });
    expect(
      await fetchLatestFix("vehicle-cryo-01", "http://monitor.test", async () => {
        throw new Error("connection refused");
      }),
    ).toEqual({ ok: false, reason: "unreachable" });
  });
});
