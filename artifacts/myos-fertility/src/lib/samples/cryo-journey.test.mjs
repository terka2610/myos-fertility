import assert from "node:assert/strict";
import test from "node:test";
import { deriveJourneyMetrics, parseJourneySnapshot } from "./cryo-journey.ts";

function makeSnapshot({
  custody = [],
  lastFix = null,
  trail = [],
  atDestination = false,
} = {}) {
  return {
    sampleId: "SMP-0001",
    schedule: {
      status: "asking availability",
      pickup: "10:00 UAE time",
      eta: "12:20 UAE time",
      etaStale: false,
      zone: "UAE time",
    },
    gpsStatus: "current",
    feed: {
      connected: true,
      synthetic: true,
      patientLinked: false,
      assetId: "vehicle-cryo-01",
      label: "Synthetic courier",
      message: "Synthetic demo feed",
      lastFix,
      trail,
    },
    atDestination,
    received: false,
    placed: false,
    custody,
  };
}

test("parses synthetic route points without linking them to patients", () => {
  const snapshot = parseJourneySnapshot({
    sample_id: "SMP-0001",
    schedule: { status: "Planned", pickup: "10:00", eta: "12:20", eta_stale: false },
    gps_status: "current",
    gps_demo_feed: {
      connected: true,
      synthetic: true,
      patient_linked: false,
      asset_id: "vehicle-cryo-01",
      trail: [
        { latitude: 24.4, longitude: 54.5, recorded_at: "2026-11-22T10:00:00Z" },
        { latitude: 100, longitude: 54.5, recorded_at: "invalid" },
      ],
    },
  });

  assert.ok(snapshot);
  assert.equal(snapshot.feed.synthetic, true);
  assert.equal(snapshot.feed.patientLinked, false);
  assert.equal(snapshot.feed.trail.length, 1);
  assert.equal(snapshot.feed.trail[0].label, "GPS point 1");
});

test("does not start transit or forecast ETA before pickup is recorded", () => {
  const snapshot = makeSnapshot({
    lastFix: {
      latitude: 24.5,
      longitude: 54.5,
      recordedAt: "2026-11-22T10:10:00Z",
      speedKmh: 48,
      accuracyM: 12,
    },
  });

  const metrics = deriveJourneyMetrics(snapshot, new Date("2026-11-22T10:15:00Z"));

  assert.equal(metrics.pickupAt, null);
  assert.equal(metrics.transitMinutes, null);
  assert.equal(metrics.liveEtaAt, null);
  assert.equal(metrics.locationStale, false);
});

test("uses fresh GPS only after recorded pickup for an approximate ETA", () => {
  const snapshot = makeSnapshot({
    custody: [
      { eventType: "pickup", actor: "transport", recordedAt: "2026-11-22T10:00:00Z" },
    ],
    lastFix: {
      latitude: 24.5,
      longitude: 54.5,
      recordedAt: "2026-11-22T10:10:00Z",
      speedKmh: 48,
      accuracyM: 12,
    },
  });

  const freshMetrics = deriveJourneyMetrics(snapshot, new Date("2026-11-22T10:12:00Z"));
  assert.equal(freshMetrics.pickupAt, "2026-11-22T10:00:00Z");
  assert.equal(freshMetrics.transitMinutes, 12);
  assert.ok(freshMetrics.liveEtaAt);

  const staleSnapshot = makeSnapshot({
    custody: snapshot.custody,
    lastFix: {
      ...snapshot.feed.lastFix,
      recordedAt: "2026-11-22T10:00:00Z",
    },
  });
  const staleMetrics = deriveJourneyMetrics(staleSnapshot, new Date("2026-11-22T10:10:01Z"));
  assert.equal(staleMetrics.locationStale, true);
  assert.equal(staleMetrics.liveEtaAt, null);
});

test("uses recorded receipt and placement milestones to end transit", () => {
  const snapshot = makeSnapshot({
    custody: [
      { eventType: "pickup", actor: "transport", recordedAt: "2026-11-22T10:00:00Z" },
      { eventType: "receipt", actor: "storage", recordedAt: "2026-11-22T10:30:00Z" },
      { eventType: "placement", actor: "storage", recordedAt: "2026-11-22T10:35:00Z" },
    ],
    lastFix: {
      latitude: 24.4338,
      longitude: 54.6182,
      recordedAt: "2026-11-22T10:30:00Z",
      speedKmh: 0,
      accuracyM: 12,
    },
  });

  const metrics = deriveJourneyMetrics(snapshot, new Date("2026-11-22T10:45:00Z"));

  assert.equal(metrics.stage, "Stored at cryogenic storage");
  assert.equal(metrics.transitMinutes, 30);
  assert.equal(metrics.liveEtaAt, null);
});
