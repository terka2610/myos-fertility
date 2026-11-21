import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publicSupabaseRead } from "./public-read";
import { DEMO_SAMPLE_VEHICLES, fetchLatestFix, type VehicleFixResult } from "./gps-monitor";
import {
  deriveJourneyMetrics,
  journeyInputFromSupabaseRows,
  toJourneyMetricsRecord,
  type JourneyMetrics,
} from "./journey-metrics";
import {
  readSupabaseCustodyEvents,
  readSupabaseRoutePoints,
  readSupabaseSnapshot,
} from "./supabase-read";

/** Table the WhatsApp agent reads. Must exist with the JourneyMetricsRecord columns. */
export const JOURNEY_METRICS_TABLE = "journey_metrics";

const RETURN_STEPS = new Set(["release_requested", "in_transit_return", "received", "verified"]);

const inputSchema = z.object({
  sampleId: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/, "Sample ID contains unsupported characters"),
});

function gpsMonitorUrl() {
  // Local default matches the monitor's default port; deployments set GPS_MONITOR_URL.
  return (
    process.env["GPS_MONITOR_URL"] ?? (import.meta.env.DEV ? "http://127.0.0.1:8787" : undefined)
  );
}

async function liveFixForSample(sampleId: string): Promise<VehicleFixResult | null> {
  const assetId = DEMO_SAMPLE_VEHICLES[sampleId];
  if (!assetId) return null;
  return fetchLatestFix(assetId, gpsMonitorUrl());
}

function facilityPoint(value: unknown): { lat: number; lon: number } | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return typeof row["lat"] === "number" && typeof row["lon"] === "number"
    ? { lat: row["lat"], lon: row["lon"] }
    : null;
}

/** Latest courier fix only (asset coordinates, no sample or patient data). No sign-in needed. */
export const readVehicleFix = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<VehicleFixResult | null> => liveFixForSample(data.sampleId));

export type JourneyMetricsRefresh =
  | { connected: true; metrics: JourneyMetrics; saved: boolean; saveError: string | null }
  | { connected: false; message: string };

/** Computes journey metrics from Supabase custody data plus the live courier fix. */
async function computeJourneyMetrics(
  supabase: never,
  sampleId: string,
): Promise<JourneyMetrics | null> {
  const [snapshot, custody, route, live] = await Promise.all([
    readSupabaseSnapshot(supabase, sampleId),
    readSupabaseCustodyEvents(supabase, sampleId),
    readSupabaseRoutePoints(supabase, sampleId),
    liveFixForSample(sampleId),
  ]);
  if (!snapshot.ok || !custody.ok || !route.ok) return null;

  const sampleRow = Array.isArray(snapshot.data) ? snapshot.data[0] : snapshot.data;
  const record = (sampleRow ?? {}) as Record<string, unknown>;
  const onReturnLeg = custody.data.some(
    (row) => typeof row["step"] === "string" && RETURN_STEPS.has(row["step"]),
  );
  const destination = facilityPoint(onReturnLeg ? record["origin"] : record["destination"]);

  const input = journeyInputFromSupabaseRows({
    sampleId,
    now: new Date(),
    routePoints: route.data,
    custodyEvents: custody.data,
    destination,
  });
  const liveInput =
    live?.ok === true
      ? {
          ...input,
          source: "live_vehicle" as const,
          locations: [
            {
              lat: live.fix.lat,
              lon: live.fix.lon,
              recordedAt: live.fix.recordedAt,
              speedKmh: live.fix.speedKmh,
            },
          ],
        }
      : input;
  const metrics = deriveJourneyMetrics(liveInput);
  if (live && !live.ok) metrics.notices.unshift("Live courier GPS is unavailable right now.");
  return metrics;
}

/** Read-only metrics for anyone viewing the demo; nothing is written. */
export const readJourneyMetrics = createServerFn({ method: "POST" })
  .middleware([publicSupabaseRead])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<JourneyMetricsRefresh> => {
    const metrics = await computeJourneyMetrics(context.supabase as never, data.sampleId);
    if (!metrics) return { connected: false, message: "Live sample information is unavailable." };
    return { connected: true, metrics, saved: false, saveError: null };
  });

/**
 * Signed-in refresh: computes the metrics and writes one timestamped row for the WhatsApp agent.
 * Never sends messages itself.
 */
export const refreshJourneyMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<JourneyMetricsRefresh> => {
    const metrics = await computeJourneyMetrics(context.supabase as never, data.sampleId);
    if (!metrics) return { connected: false, message: "Live sample information is unavailable." };

    const writer = context.supabase as unknown as {
      from: (table: string) => {
        insert: (row: unknown) => PromiseLike<{ error: { message: string } | null }>;
      };
    };
    let saveError: string | null = null;
    try {
      const { error } = await writer
        .from(JOURNEY_METRICS_TABLE)
        .insert(toJourneyMetricsRecord(metrics));
      if (error) saveError = error.message;
    } catch (error) {
      saveError = error instanceof Error ? error.message : "Write failed";
    }
    if (saveError && import.meta.env.DEV) {
      console.warn("Journey metrics were not saved for WhatsApp", saveError);
    }

    return { connected: true, metrics, saved: saveError === null, saveError };
  });
