import { describe, expect, it } from "vitest";
import {
  deriveJourneyMetrics,
  journeyInputFromSupabaseRows,
  toJourneyMetricsRecord,
} from "./journey-metrics";

const NOW = new Date("2026-11-21T10:00:00Z");
const STORAGE = { lat: 25.2048, lon: 55.2708 };

const outboundEvents = [
  { step: "collected", recordedAt: "2026-11-21T06:00:00Z" },
  { step: "released", recordedAt: "2026-11-21T09:00:00Z" },
  { step: "in_transit", recordedAt: "2026-11-21T09:05:00Z" },
];

describe("deriveJourneyMetrics", () => {
  it("reports unknowns instead of inventing values when there is no data", () => {
    const metrics = deriveJourneyMetrics({
      sampleId: "SMP-0001",
      now: NOW,
      source: "live_vehicle",
      locations: [],
      custodyEvents: [],
    });

    expect(metrics.lastLocation).toBeNull();
    expect(metrics.locationStale).toBeNull();
    expect(metrics.stage).toBe("Unknown");
    expect(metrics.pickupAt).toBeNull();
    expect(metrics.etaAt).toBeNull();
    expect(metrics.etaMethod).toBe("unavailable");
    expect(metrics.inTransportFreezerMinutes).toBeNull();
    expect(metrics.traffic).toBeNull();
    expect(metrics.notices).toContain("No location data available.");
    expect(metrics.notices).toContain("No custody events recorded.");
  });

  it("uses the latest valid fix, ignores bad or future points, and computes age", () => {
    const metrics = deriveJourneyMetrics({
      sampleId: "SMP-0001",
      now: NOW,
      source: "live_vehicle",
      custodyEvents: outboundEvents,
      locations: [
        { lat: 24.6, lon: 54.6, recordedAt: "2026-11-21T09:58:00Z" },
        { lat: 24.5, lon: 54.5, recordedAt: "2026-11-21T09:50:00Z" },
        { lat: 999, lon: 54.5, recordedAt: "2026-11-21T09:59:00Z" },
        { lat: 24.7, lon: 54.7, recordedAt: "2026-11-21T11:00:00Z" },
        { lat: 24.7, lon: 54.7, recordedAt: "not a date" },
      ],
    });

    expect(metrics.lastLocation).toEqual({
      lat: 24.6,
      lon: 54.6,
      recordedAt: "2026-11-21T09:58:00.000Z",
    });
    expect(metrics.locationAgeSeconds).toBe(120);
    expect(metrics.locationStale).toBe(false);
    expect(metrics.notices).toContain("3 invalid location update(s) were ignored.");
  });

  it("marks old fixes stale and refuses to estimate an ETA from them", () => {
    const metrics = deriveJourneyMetrics({
      sampleId: "SMP-0001",
      now: NOW,
      source: "live_vehicle",
      custodyEvents: outboundEvents,
      destination: STORAGE,
      locations: [
        { lat: 24.5, lon: 54.5, recordedAt: "2026-11-21T09:10:00Z" },
        { lat: 24.6, lon: 54.6, recordedAt: "2026-11-21T09:20:00Z" },
      ],
    });

    expect(metrics.locationStale).toBe(true);
    expect(metrics.etaAt).toBeNull();
    expect(metrics.etaMethod).toBe("unavailable");
    expect(metrics.notices.some((notice) => notice.includes("40 min old"))).toBe(true);
  });

  it("derives stage, pickup and time since pickup from custody events", () => {
    const metrics = deriveJourneyMetrics({
      sampleId: "SMP-0001",
      now: NOW,
      source: "recorded_route",
      locations: [],
      custodyEvents: [...outboundEvents].reverse(),
    });

    expect(metrics.leg).toBe("outbound");
    expect(metrics.currentStep).toBe("in_transit");
    expect(metrics.stage).toBe("In transit to Cryogenic Storage");
    expect(metrics.pickupAt).toBe("2026-11-21T09:00:00.000Z");
    expect(metrics.transportMinutes).toBe(60);
    expect(metrics.notices).toContain(
      "Location comes from the recorded route, not a live vehicle feed.",
    );
  });

  it("stops the transport clock on arrival and reports ETA as arrived", () => {
    const metrics = deriveJourneyMetrics({
      sampleId: "SMP-0001",
      now: NOW,
      source: "live_vehicle",
      locations: [],
      custodyEvents: [
        ...outboundEvents,
        { step: "arrived_storage", recordedAt: "2026-11-21T09:45:00Z" },
      ],
    });

    expect(metrics.arrivedAt).toBe("2026-11-21T09:45:00.000Z");
    expect(metrics.transportMinutes).toBe(45);
    expect(metrics.etaMethod).toBe("arrived");
  });

  it("tracks the return leg separately", () => {
    const metrics = deriveJourneyMetrics({
      sampleId: "SMP-0003",
      now: NOW,
      source: "simulation",
      locations: [],
      custodyEvents: [
        ...outboundEvents,
        { step: "stored", recordedAt: "2026-11-21T09:30:00Z" },
        { step: "release_requested", recordedAt: "2026-11-21T09:40:00Z" },
        { step: "in_transit_return", recordedAt: "2026-11-21T09:50:00Z" },
      ],
    });

    expect(metrics.leg).toBe("return");
    expect(metrics.pickupAt).toBe("2026-11-21T09:50:00.000Z");
    expect(metrics.transportMinutes).toBe(10);
    expect(metrics.notices).toContain("Simulated data: not a live shipment.");
  });

  it("counts freezer time from pickup until arrival", () => {
    const inTransit = deriveJourneyMetrics({
      sampleId: "SMP-0001",
      now: NOW,
      source: "live_vehicle",
      locations: [],
      custodyEvents: outboundEvents,
    });
    expect(inTransit.freezerLoadedAt).toBe("2026-11-21T09:00:00.000Z");
    expect(inTransit.inTransportFreezerMinutes).toBe(60);

    const arrived = deriveJourneyMetrics({
      sampleId: "SMP-0001",
      now: NOW,
      source: "live_vehicle",
      locations: [],
      custodyEvents: [
        ...outboundEvents,
        { step: "arrived_storage", recordedAt: "2026-11-21T09:40:00Z" },
      ],
    });
    expect(arrived.freezerUnloadedAt).toBe("2026-11-21T09:40:00.000Z");
    expect(arrived.inTransportFreezerMinutes).toBe(40);

    const notPickedUp = deriveJourneyMetrics({
      sampleId: "SMP-0001",
      now: NOW,
      source: "live_vehicle",
      locations: [],
      custodyEvents: [{ step: "collected", recordedAt: "2026-11-21T06:00:00Z" }],
    });
    expect(notPickedUp.inTransportFreezerMinutes).toBeNull();
  });

  it("uses the device-reported speed for ETA and reports factual delay reasons", () => {
    const moving = deriveJourneyMetrics({
      sampleId: "SMP-0001",
      now: NOW,
      source: "live_vehicle",
      custodyEvents: outboundEvents,
      destination: { lat: 24.452, lon: 54.975 },
      locations: [{ lat: 24.452, lon: 54.575, recordedAt: "2026-11-21T09:59:00Z", speedKmh: 48 }],
    });
    expect(moving.etaMethod).toBe("distance_speed_estimate");
    // ~40.5 km straight line x 1.3 road factor at 48 km/h is about 66 minutes after the fix.
    const minutes = (Date.parse(moving.etaAt!) - Date.parse("2026-11-21T09:59:00Z")) / 60000;
    expect(minutes).toBeGreaterThan(60);
    expect(minutes).toBeLessThan(72);
    expect(moving.delayReason).toBeNull();

    const stopped = deriveJourneyMetrics({
      sampleId: "SMP-0001",
      now: NOW,
      source: "live_vehicle",
      custodyEvents: outboundEvents,
      destination: { lat: 24.452, lon: 54.975 },
      locations: [{ lat: 24.452, lon: 54.575, recordedAt: "2026-11-21T09:59:00Z", speedKmh: 0 }],
    });
    expect(stopped.etaAt).toBeNull();
    expect(stopped.delayReason).toBe("Vehicle stationary");

    const lost = deriveJourneyMetrics({
      sampleId: "SMP-0001",
      now: NOW,
      source: "live_vehicle",
      custodyEvents: outboundEvents,
      locations: [{ lat: 24.452, lon: 54.575, recordedAt: "2026-11-21T09:30:00Z", speedKmh: 48 }],
    });
    expect(lost.lastLocation?.lat).toBe(24.452);
    expect(lost.locationStale).toBe(true);
    expect(lost.delayReason).toBe("GPS signal lost: last update 30 min ago");
  });

  it("maps metrics to the agreed WhatsApp record fields", () => {
    const metrics = deriveJourneyMetrics({
      sampleId: "SMP-0001",
      now: NOW,
      source: "live_vehicle",
      custodyEvents: outboundEvents,
      locations: [{ lat: 24.452, lon: 54.575, recordedAt: "2026-11-21T09:59:00Z", speedKmh: 48 }],
    });
    expect(toJourneyMetricsRecord(metrics)).toEqual({
      sample_id: "SMP-0001",
      eta: null,
      minutes_in_freezer: 60,
      delay_reason: null,
      lat: 24.452,
      lon: 54.575,
      recorded_at: "2026-11-21T09:59:00.000Z",
    });
  });

  it("gives an approximate ETA only from fresh, plausible movement", () => {
    const metrics = deriveJourneyMetrics({
      sampleId: "SMP-0001",
      now: NOW,
      source: "live_vehicle",
      custodyEvents: outboundEvents,
      destination: STORAGE,
      locations: [
        { lat: 24.6, lon: 54.6, recordedAt: "2026-11-21T09:40:00Z" },
        { lat: 24.75, lon: 54.75, recordedAt: "2026-11-21T09:58:00Z" },
      ],
    });

    expect(metrics.etaMethod).toBe("distance_speed_estimate");
    expect(metrics.etaAt).not.toBeNull();
    expect(Date.parse(metrics.etaAt!)).toBeGreaterThan(NOW.getTime());
    expect(metrics.notices).toContain(
      "ETA is approximate (distance and current speed); no routing provider.",
    );

    const parked = deriveJourneyMetrics({
      sampleId: "SMP-0001",
      now: NOW,
      source: "live_vehicle",
      custodyEvents: outboundEvents,
      destination: STORAGE,
      locations: [
        { lat: 24.6, lon: 54.6, recordedAt: "2026-11-21T09:40:00Z" },
        { lat: 24.6, lon: 54.6, recordedAt: "2026-11-21T09:58:00Z" },
      ],
    });
    expect(parked.etaAt).toBeNull();
    expect(parked.etaMethod).toBe("unavailable");
  });
});

describe("journeyInputFromSupabaseRows", () => {
  it("maps route_points and custody_events rows and labels them as a recorded route", () => {
    const input = journeyInputFromSupabaseRows({
      sampleId: "SMP-0001",
      now: NOW,
      routePoints: [
        {
          id: 1,
          sample_id: "SMP-0001",
          lat: 24.45,
          lon: 54.38,
          recorded_at: "2026-11-21T09:00:00Z",
        },
        {
          id: 2,
          sample_id: "SMP-0001",
          lat: null,
          lon: 54.38,
          recorded_at: "2026-11-21T09:05:00Z",
        },
      ],
      custodyEvents: [{ step: "in_transit", recorded_at: "2026-11-21T09:05:00Z" }],
    });

    expect(input.source).toBe("recorded_route");
    expect(input.locations).toEqual([
      { lat: 24.45, lon: 54.38, recordedAt: "2026-11-21T09:00:00Z" },
    ]);
    expect(input.custodyEvents).toEqual([
      { step: "in_transit", recordedAt: "2026-11-21T09:05:00Z" },
    ]);
  });
});
