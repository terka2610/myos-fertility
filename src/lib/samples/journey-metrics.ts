// Pure journey metrics derived from trusted location and custody data.
// Shared by the dashboard and the WhatsApp intelligence layer so both give the same answer.
// Rules: never invent a location, timestamp, ETA or traffic value; say when data is missing or stale.

export type JourneyDataSource = "live_vehicle" | "recorded_route" | "simulation";
export type EtaMethod = "distance_speed_estimate" | "arrived" | "unavailable";
export type JourneyLeg = "outbound" | "return";

export interface JourneyLocationInput {
  lat: number;
  lon: number;
  recordedAt: string;
  /** Speed reported by the GPS device, if any. */
  speedKmh?: number | null;
}

export interface JourneyCustodyEventInput {
  step: string;
  recordedAt: string;
}

export interface JourneyMetricsInput {
  sampleId: string;
  now: Date;
  /** Where the location points came from. Recorded routes and simulations are never "live". */
  source: JourneyDataSource;
  locations: readonly JourneyLocationInput[];
  custodyEvents: readonly JourneyCustodyEventInput[];
  /** Destination of the current leg, if known. Needed for any ETA. */
  destination?: { lat: number; lon: number } | null;
  /** A fix older than this is stale. Default 5 minutes, agreed with the GPS owner. */
  staleAfterSeconds?: number;
}

export interface JourneyMetrics {
  sampleId: string;
  source: JourneyDataSource;
  leg: JourneyLeg | null;
  currentStep: string | null;
  stage: string;
  latestCustodyAt: string | null;
  lastLocation: JourneyLocationInput | null;
  locationAgeSeconds: number | null;
  locationStale: boolean | null;
  pickupAt: string | null;
  arrivedAt: string | null;
  transportMinutes: number | null;
  freezerLoadedAt: string | null;
  freezerUnloadedAt: string | null;
  inTransportFreezerMinutes: number | null;
  etaAt: string | null;
  etaMethod: EtaMethod;
  /** A factual reason the shipment may be delayed (stale GPS, stationary vehicle), or null. */
  delayReason: string | null;
  /** Traffic is only reported when a real provider supplies it; none is connected. */
  traffic: null;
  notices: string[];
}

// Custody steps supplied by the Supabase custody_events data.
const STAGE_LABELS: Record<string, string> = {
  collected: "Collected at Fertility Centre",
  consent_recorded: "Consent recorded",
  released: "Released to Cryo Transport",
  in_transit: "In transit to Cryogenic Storage",
  arrived_storage: "Arrived at Cryogenic Storage",
  stored: "Stored at Cryogenic Storage",
  release_requested: "Return requested",
  in_transit_return: "In transit back to Fertility Centre",
  received: "Received at Fertility Centre",
  verified: "Verified at Fertility Centre",
};

const RETURN_STEPS = new Set(["release_requested", "in_transit_return", "received", "verified"]);
const LEG_STEPS: Record<JourneyLeg, { pickup: readonly string[]; arrival: readonly string[] }> = {
  outbound: { pickup: ["released", "in_transit"], arrival: ["arrived_storage", "stored"] },
  return: { pickup: ["in_transit_return"], arrival: ["received", "verified"] },
};

const DEFAULT_STALE_AFTER_SECONDS = 5 * 60;
const FUTURE_TOLERANCE_MS = 60 * 1000;
const ETA_SPEED_WINDOW_MS = 30 * 60 * 1000;
const STATIONARY_KMH = 3;
const MIN_PLAUSIBLE_KMH = 15;
const MAX_PLAUSIBLE_KMH = 150;
// Straight-line distance underestimates road distance; scale up for an approximate estimate.
const ROAD_DISTANCE_FACTOR = 1.3;

function parseTime(value: string, now: Date): number | null {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  if (time > now.getTime() + FUTURE_TOLERANCE_MS) return null;
  return time;
}

function isValidCoordinate(lat: number, lon: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export function distanceKm(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(to.lat - from.lat);
  const dLon = radians(to.lon - from.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function minutesBetween(start: number, end: number) {
  return Math.max(0, Math.round((end - start) / 60000));
}

export function deriveJourneyMetrics(input: JourneyMetricsInput): JourneyMetrics {
  const { now } = input;
  const nowMs = now.getTime();
  const staleAfter = input.staleAfterSeconds ?? DEFAULT_STALE_AFTER_SECONDS;
  const notices: string[] = [];

  if (input.source === "simulation") {
    notices.push("Simulated data: not a live shipment.");
  } else if (input.source === "recorded_route") {
    notices.push("Location comes from the recorded route, not a live vehicle feed.");
  }

  // Locations: drop invalid or future fixes, order by time.
  const locations = input.locations
    .map((point) => ({ point, time: parseTime(point.recordedAt, now) }))
    .filter(
      (entry): entry is { point: JourneyLocationInput; time: number } =>
        entry.time !== null && isValidCoordinate(entry.point.lat, entry.point.lon),
    )
    .sort((first, second) => first.time - second.time);
  const dropped = input.locations.length - locations.length;
  if (dropped > 0) notices.push(`${dropped} invalid location update(s) were ignored.`);

  const last = locations.at(-1) ?? null;
  const locationAgeSeconds = last ? Math.max(0, Math.round((nowMs - last.time) / 1000)) : null;
  const locationStale = locationAgeSeconds === null ? null : locationAgeSeconds > staleAfter;
  if (!last) notices.push("No location data available.");
  else if (locationStale) {
    notices.push(
      `Last location update is ${Math.round(locationAgeSeconds! / 60)} min old; current position is unknown.`,
    );
  }

  // Custody events: drop invalid timestamps, order by time.
  const events = input.custodyEvents
    .map((event) => ({ event, time: parseTime(event.recordedAt, now) }))
    .filter(
      (entry): entry is { event: JourneyCustodyEventInput; time: number } => entry.time !== null,
    )
    .sort((first, second) => first.time - second.time);
  const latestEvent = events.at(-1) ?? null;
  const currentStep = latestEvent?.event.step ?? null;
  if (!latestEvent) notices.push("No custody events recorded.");

  const leg: JourneyLeg | null = !latestEvent
    ? null
    : events.some((entry) => RETURN_STEPS.has(entry.event.step))
      ? "return"
      : "outbound";
  const legEvents =
    leg === "return"
      ? events.slice(events.findIndex((entry) => RETURN_STEPS.has(entry.event.step)))
      : events;
  const firstStep = (steps: readonly string[]) =>
    legEvents.find((entry) => steps.includes(entry.event.step)) ?? null;
  const pickup = leg ? firstStep(LEG_STEPS[leg].pickup) : null;
  const arrival = leg ? firstStep(LEG_STEPS[leg].arrival) : null;
  const arrivedAfterPickup = pickup && arrival && arrival.time >= pickup.time ? arrival : null;

  const transportMinutes = pickup
    ? minutesBetween(pickup.time, arrivedAfterPickup?.time ?? nowMs)
    : null;

  // Agreed with the custody data owner: the transport freezer period starts at pickup
  // (released / in_transit) and ends at arrival (arrived_storage; received on the return leg).
  const loaded = pickup;
  const unloaded = arrivedAfterPickup;
  const inTransportFreezerMinutes = transportMinutes;

  // ETA: only an approximate distance/speed estimate from recent, fresh, plausible movement.
  let etaAt: string | null = null;
  let etaMethod: EtaMethod = "unavailable";
  if (arrivedAfterPickup) {
    etaMethod = "arrived";
  } else if (pickup && last && !locationStale && input.destination) {
    // Prefer the speed the GPS device reports; otherwise derive it from recent movement.
    const reportedSpeed = last.point.speedKmh;
    const recent = locations.filter((entry) => entry.time >= last.time - ETA_SPEED_WINDOW_MS);
    const first = recent[0]!;
    const hours = (last.time - first.time) / 3600000;
    const speedKmh =
      typeof reportedSpeed === "number" && Number.isFinite(reportedSpeed)
        ? reportedSpeed
        : hours > 0
          ? distanceKm(first.point, last.point) / hours
          : 0;
    if (
      isValidCoordinate(input.destination.lat, input.destination.lon) &&
      speedKmh >= MIN_PLAUSIBLE_KMH &&
      speedKmh <= MAX_PLAUSIBLE_KMH
    ) {
      const remainingKm = distanceKm(last.point, input.destination) * ROAD_DISTANCE_FACTOR;
      etaAt = new Date(last.time + (remainingKm / speedKmh) * 3600000).toISOString();
      etaMethod = "distance_speed_estimate";
      notices.push("ETA is approximate (distance and current speed); no routing provider.");
    } else {
      notices.push("ETA unavailable: not enough recent movement to estimate.");
    }
  } else if (pickup && !arrivedAfterPickup) {
    notices.push("ETA unavailable: needs a fresh location and a known destination.");
  }

  // Delay reasons are only stated from facts we hold; no traffic provider is connected.
  let delayReason: string | null = null;
  if (pickup && !arrivedAfterPickup && last) {
    if (locationStale) {
      delayReason = `GPS signal lost: last update ${Math.round(locationAgeSeconds! / 60)} min ago`;
    } else if (typeof last.point.speedKmh === "number" && last.point.speedKmh < STATIONARY_KMH) {
      delayReason = "Vehicle stationary";
    }
  }

  return {
    sampleId: input.sampleId,
    source: input.source,
    leg,
    currentStep,
    stage: currentStep ? (STAGE_LABELS[currentStep] ?? currentStep) : "Unknown",
    latestCustodyAt: latestEvent ? new Date(latestEvent.time).toISOString() : null,
    lastLocation: last ? { ...last.point, recordedAt: new Date(last.time).toISOString() } : null,
    locationAgeSeconds,
    locationStale,
    pickupAt: pickup ? new Date(pickup.time).toISOString() : null,
    arrivedAt: arrivedAfterPickup ? new Date(arrivedAfterPickup.time).toISOString() : null,
    transportMinutes,
    freezerLoadedAt: loaded ? new Date(loaded.time).toISOString() : null,
    freezerUnloadedAt: unloaded ? new Date(unloaded.time).toISOString() : null,
    inTransportFreezerMinutes,
    etaAt,
    etaMethod,
    delayReason,
    traffic: null,
    notices,
  };
}

/** Adapt Supabase route_points and custody_events rows into metrics input. */
export function journeyInputFromSupabaseRows(params: {
  sampleId: string;
  now: Date;
  routePoints: readonly Record<string, unknown>[];
  custodyEvents: readonly Record<string, unknown>[];
  destination?: { lat: number; lon: number } | null;
}): JourneyMetricsInput {
  return {
    sampleId: params.sampleId,
    now: params.now,
    source: "recorded_route",
    destination: params.destination ?? null,
    locations: params.routePoints.flatMap((row) =>
      typeof row["lat"] === "number" &&
      typeof row["lon"] === "number" &&
      typeof row["recorded_at"] === "string"
        ? [{ lat: row["lat"], lon: row["lon"], recordedAt: row["recorded_at"] }]
        : [],
    ),
    custodyEvents: params.custodyEvents.flatMap((row) =>
      typeof row["step"] === "string" && typeof row["recorded_at"] === "string"
        ? [{ step: row["step"], recordedAt: row["recorded_at"] }]
        : [],
    ),
  };
}

/** Row written to the database for the WhatsApp agent. Field names agreed with the agent owner. */
export interface JourneyMetricsRecord {
  sample_id: string;
  eta: string | null;
  minutes_in_freezer: number | null;
  delay_reason: string | null;
  lat: number | null;
  lon: number | null;
  /** Time of the GPS fix that lat/lon come from. */
  recorded_at: string | null;
}

export function toJourneyMetricsRecord(metrics: JourneyMetrics): JourneyMetricsRecord {
  return {
    sample_id: metrics.sampleId,
    eta: metrics.etaAt,
    minutes_in_freezer: metrics.inTransportFreezerMinutes,
    delay_reason: metrics.delayReason,
    lat: metrics.lastLocation?.lat ?? null,
    lon: metrics.lastLocation?.lon ?? null,
    recorded_at: metrics.lastLocation?.recordedAt ?? null,
  };
}
