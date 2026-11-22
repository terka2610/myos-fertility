export interface JourneySchedule {
  status: string;
  pickup: string;
  eta: string;
  etaStale: boolean;
  zone: string;
}

export interface JourneyFix {
  latitude: number;
  longitude: number;
  recordedAt: string;
  speedKmh: number | null;
  accuracyM: number | null;
}

export interface JourneyRoutePoint {
  latitude: number;
  longitude: number;
  recordedAt: string | null;
}

export interface JourneyCustodyEvent {
  eventType: string;
  actor: string;
  recordedAt: string;
}

export interface JourneySnapshot {
  sampleId: string;
  schedule: JourneySchedule;
  gpsStatus: string;
  feed: {
    connected: boolean;
    synthetic: boolean;
    patientLinked: boolean;
    assetId: string;
    label: string;
    message: string;
    lastFix: JourneyFix | null;
    trail: JourneyRoutePoint[];
  };
  atDestination: boolean;
  received: boolean;
  placed: boolean;
  custody: JourneyCustodyEvent[];
}

export interface JourneyMetrics {
  pickupAt: string | null;
  receivedAt: string | null;
  placedAt: string | null;
  transitMinutes: number | null;
  lastFix: JourneyFix | null;
  locationAgeSeconds: number | null;
  locationStale: boolean | null;
  liveEtaAt: string | null;
}

const DESTINATION = { latitude: 24.4338, longitude: 54.6182 };
const STALE_AFTER_SECONDS = 5 * 60;
const MAX_FUTURE_SECONDS = 60;
const ROAD_DISTANCE_FACTOR = 1.3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function inRange(latitude: number, longitude: number) {
  return (
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function parseFix(value: unknown): JourneyFix | null {
  if (!isRecord(value)) return null;
  const latitude = finiteNumber(value["latitude"]);
  const longitude = finiteNumber(value["longitude"]);
  const recordedAt = typeof value["recorded_at"] === "string" ? value["recorded_at"] : null;
  if (latitude === null || longitude === null || !inRange(latitude, longitude) || !recordedAt) {
    return null;
  }
  return {
    latitude,
    longitude,
    recordedAt,
    speedKmh: finiteNumber(value["speed_kmh"]),
    accuracyM: finiteNumber(value["accuracy_m"]),
  };
}

function parseRoutePoint(value: unknown): JourneyRoutePoint | null {
  if (!isRecord(value)) return null;
  const latitude = finiteNumber(value["latitude"]);
  const longitude = finiteNumber(value["longitude"]);
  if (latitude === null || longitude === null || !inRange(latitude, longitude)) return null;
  return {
    latitude,
    longitude,
    recordedAt: typeof value["recorded_at"] === "string" ? value["recorded_at"] : null,
  };
}

/** Validate the existing Cryo demo API response without exposing its conversation data. */
export function parseJourneySnapshot(value: unknown): JourneySnapshot | null {
  if (!isRecord(value) || !isRecord(value["schedule"]) || !isRecord(value["gps_demo_feed"])) {
    return null;
  }
  const schedule = value["schedule"];
  const feed = value["gps_demo_feed"];
  const sampleId = typeof value["sample_id"] === "string" ? value["sample_id"] : null;
  if (!sampleId) return null;

  const rawTrail = Array.isArray(feed["trail"]) ? feed["trail"] : [];
  const rawCustody = Array.isArray(value["custody"]) ? value["custody"] : [];
  return {
    sampleId,
    schedule: {
      status: typeof schedule["status"] === "string" ? schedule["status"] : "Unknown",
      pickup: typeof schedule["pickup"] === "string" ? schedule["pickup"] : "",
      eta: typeof schedule["eta"] === "string" ? schedule["eta"] : "",
      etaStale: schedule["eta_stale"] === true,
      zone: typeof schedule["zone"] === "string" ? schedule["zone"] : "UAE time",
    },
    gpsStatus: typeof value["gps_status"] === "string" ? value["gps_status"] : "unavailable",
    feed: {
      connected: feed["connected"] === true,
      synthetic: feed["synthetic"] === true,
      patientLinked: feed["patient_linked"] === true,
      assetId: typeof feed["asset_id"] === "string" ? feed["asset_id"] : "unknown vehicle",
      label: typeof feed["label"] === "string" ? feed["label"] : "Courier",
      message: typeof feed["message"] === "string" ? feed["message"] : "GPS feed unavailable.",
      lastFix: parseFix(feed["last_fix"]),
      trail: rawTrail.flatMap((point) => {
        const parsed = parseRoutePoint(point);
        return parsed ? [parsed] : [];
      }),
    },
    atDestination: value["at_destination"] === true,
    received: value["received"] === true,
    placed: value["placed"] === true,
    custody: rawCustody.flatMap((event) => {
      if (!isRecord(event)) return [];
      const eventType = event["event_type"];
      const recordedAt = event["recorded_at"];
      if (typeof eventType !== "string" || typeof recordedAt !== "string") return [];
      return [{
        eventType,
        actor: typeof event["actor"] === "string" ? event["actor"] : "Unknown",
        recordedAt,
      }];
    }),
  };
}

function validTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const arc =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

function latestEventTime(events: readonly JourneyCustodyEvent[], eventType: string) {
  const matching = events
    .filter((event) => event.eventType === eventType && validTimestamp(event.recordedAt) !== null)
    .sort((first, second) => Date.parse(first.recordedAt) - Date.parse(second.recordedAt));
  return matching[0]?.recordedAt ?? null;
}

function estimateSpeedKmh(snapshot: JourneySnapshot, now: Date) {
  const reported = snapshot.feed.lastFix?.speedKmh;
  if (reported !== null && reported !== undefined && reported >= 15 && reported <= 150) {
    return reported;
  }

  const locations = snapshot.feed.trail
    .flatMap((point) => {
      const time = point.recordedAt ? validTimestamp(point.recordedAt) : null;
      if (time === null || time > now.getTime() + MAX_FUTURE_SECONDS * 1000) return [];
      return [{ point, time }];
    })
    .sort((first, second) => first.time - second.time)
    .filter((entry) => now.getTime() - entry.time <= 30 * 60 * 1000);
  if (snapshot.feed.lastFix) {
    const fixTime = validTimestamp(snapshot.feed.lastFix.recordedAt);
    if (fixTime !== null && !locations.some((entry) => entry.time === fixTime)) {
      locations.push({
        point: {
          latitude: snapshot.feed.lastFix.latitude,
          longitude: snapshot.feed.lastFix.longitude,
          recordedAt: snapshot.feed.lastFix.recordedAt,
        },
        time: fixTime,
      });
      locations.sort((first, second) => first.time - second.time);
    }
  }
  const first = locations[0];
  const last = locations.at(-1);
  if (!first || !last || last.time <= first.time) return null;
  const speed =
    distanceKm(first.point, last.point) / ((last.time - first.time) / 3_600_000);
  return speed >= 15 && speed <= 150 ? speed : null;
}

export function deriveJourneyMetrics(snapshot: JourneySnapshot, now: Date): JourneyMetrics {
  const pickupAt = latestEventTime(snapshot.custody, "pickup");
  const receivedAt = latestEventTime(snapshot.custody, "receipt");
  const placedAt = latestEventTime(snapshot.custody, "placement");
  const pickupTime = pickupAt ? validTimestamp(pickupAt) : null;
  const receivedTime = receivedAt ? validTimestamp(receivedAt) : null;
  const completedTransit =
    pickupTime !== null && receivedTime !== null && receivedTime >= pickupTime;
  const transitEnd = completedTransit ? receivedTime : now.getTime();
  const transitMinutes =
    pickupTime === null
      ? null
      : Math.max(0, Math.round((transitEnd - pickupTime) / 60_000));

  const lastFix = snapshot.feed.lastFix;
  const fixTime = lastFix ? validTimestamp(lastFix.recordedAt) : null;
  const age = fixTime === null ? null : Math.round((now.getTime() - fixTime) / 1000);
  const locationAgeSeconds = age === null ? null : Math.max(0, age);
  const locationStale =
    lastFix === null
      ? null
      : age === null || age < -MAX_FUTURE_SECONDS || age > STALE_AFTER_SECONDS;

  let liveEtaAt: string | null = null;
  if (
    pickupAt &&
    !receivedAt &&
    !snapshot.atDestination &&
    lastFix &&
    locationStale === false
  ) {
    const speed = estimateSpeedKmh(snapshot, now);
    if (speed !== null) {
      const remainingKm = distanceKm(lastFix, DESTINATION) * ROAD_DISTANCE_FACTOR;
      liveEtaAt = new Date(fixTime! + (remainingKm / speed) * 3_600_000).toISOString();
    }
  }

  return {
    pickupAt,
    receivedAt,
    placedAt,
    transitMinutes,
    lastFix,
    locationAgeSeconds,
    locationStale,
    liveEtaAt,
  };
}

export function formatJourneyTimestamp(value: string | null, fallback = "Not recorded") {
  if (!value || !Number.isFinite(Date.parse(value))) return fallback;
  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Dubai",
  }).format(new Date(value));
}

export function formatJourneyDuration(minutes: number | null) {
  if (minutes === null) return "Not started";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}
