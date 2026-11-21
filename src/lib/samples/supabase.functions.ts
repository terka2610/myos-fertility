import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { publicSupabaseRead } from "./public-read";
import {
  mapSnapshotToRegistry,
  mapGenericFacility,
  readSupabaseSnapshot,
  readSupabaseCustodyEvents,
  readSupabaseRoutePoints,
  type SupabaseReadError,
  type CustodyEventRow,
  type RoutePointRow,
} from "./supabase-read";
import type { SampleRegistryRecord } from "./types";

const inputSchema = z.object({
  sampleId: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/, "Sample ID contains unsupported characters"),
});

export type SupabaseSampleResponse =
  | { connected: true; sample: SampleRegistryRecord }
  | { connected: false; sample: null; error: SupabaseReadError };

export type SupabaseJourneyResponse =
  | {
      connected: true;
      sample: SampleRegistryRecord;
      custodyEvents: CustodyEventRow[];
      routePoints: RoutePointRow[];
    }
  | {
      connected: false;
      sample: null;
      custodyEvents: CustodyEventRow[];
      routePoints: RoutePointRow[];
      error: SupabaseReadError;
    };

function latestCustodyTimestamp(rows: readonly CustodyEventRow[]): string {
  const timestamps = rows
    .map((row) =>
      typeof row["recorded_at"] === "string"
        ? row["recorded_at"]
        : typeof row["created_at"] === "string"
          ? row["created_at"]
          : null,
    )
    .filter((value): value is string => Boolean(value));
  return timestamps.sort().at(-1) ?? "";
}

function safeRoutePoints(rows: readonly RoutePointRow[]): RoutePointRow[] {
  return rows.map((row, index) => ({
    id: typeof row["id"] === "string" ? row["id"] : `route-${index}`,
    sample_id: typeof row["sample_id"] === "string" ? row["sample_id"] : "",
    lat:
      typeof row["lat"] === "number"
        ? Number(row["lat"].toFixed(2))
        : typeof row["latitude"] === "number"
          ? Number(row["latitude"].toFixed(2))
          : null,
    lon:
      typeof row["lon"] === "number"
        ? Number(row["lon"].toFixed(2))
        : typeof row["longitude"] === "number"
          ? Number(row["longitude"].toFixed(2))
          : null,
    recorded_at:
      typeof row["recorded_at"] === "string"
        ? row["recorded_at"]
        : typeof row["created_at"] === "string"
          ? row["created_at"]
          : null,
  })) as RoutePointRow[];
}

export const readSupabaseSample = createServerFn({ method: "POST" })
  .middleware([publicSupabaseRead])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<SupabaseSampleResponse> => {
    const supabase = context.supabase as never;
    const snapshot = await readSupabaseSnapshot(supabase, data.sampleId);
    if (!snapshot.ok) {
      return { connected: false, sample: null, error: snapshot.error };
    }

    const sample = mapSnapshotToRegistry(snapshot.data, data.sampleId);
    if (!sample) {
      return {
        connected: false,
        sample: null,
        error: { kind: "missing_sample", message: "The Supabase snapshot was empty." },
      };
    }

    const custody = await readSupabaseCustodyEvents(supabase, data.sampleId);
    if (custody.ok) {
      sample.latestEventAt = latestCustodyTimestamp(custody.data);
    } else if (custody.error.kind === "permission") {
      sample.latestEventAt = "";
    }
    return { connected: true, sample };
  });

export const readSupabaseCustody = createServerFn({ method: "POST" })
  .middleware([publicSupabaseRead])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<
      | { connected: true; events: CustodyEventRow[] }
      | { connected: false; events: []; error: SupabaseReadError }
    > => {
      const result = await readSupabaseCustodyEvents(context.supabase as never, data.sampleId);
      if (!result.ok) return { connected: false, events: [], error: result.error };
      return { connected: true, events: result.data };
    },
  );

export const readSupabaseRoute = createServerFn({ method: "POST" })
  .middleware([publicSupabaseRead])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(
    async ({
      data,
      context,
    }): Promise<
      | { connected: true; points: RoutePointRow[] }
      | { connected: false; points: []; error: SupabaseReadError }
    > => {
      const result = await readSupabaseRoutePoints(context.supabase as never, data.sampleId);
      if (!result.ok) return { connected: false, points: [], error: result.error };
      return { connected: true, points: safeRoutePoints(result.data) };
    },
  );

export const readSupabaseJourney = createServerFn({ method: "POST" })
  .middleware([publicSupabaseRead])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<SupabaseJourneyResponse> => {
    const supabase = context.supabase as never;
    const snapshot = await readSupabaseSnapshot(supabase, data.sampleId);
    if (!snapshot.ok) {
      return {
        connected: false,
        sample: null,
        custodyEvents: [],
        routePoints: [],
        error: snapshot.error,
      };
    }

    const sample = mapSnapshotToRegistry(snapshot.data, data.sampleId);
    if (!sample) {
      return {
        connected: false,
        sample: null,
        custodyEvents: [],
        routePoints: [],
        error: { kind: "missing_sample", message: "The Supabase snapshot was empty." },
      };
    }

    const [custody, route] = await Promise.all([
      readSupabaseCustodyEvents(supabase, data.sampleId),
      readSupabaseRoutePoints(supabase, data.sampleId),
    ]);
    if (!custody.ok) {
      return {
        connected: false,
        sample: null,
        custodyEvents: [],
        routePoints: [],
        error: custody.error,
      };
    }
    if (!route.ok) {
      return {
        connected: false,
        sample: null,
        custodyEvents: [],
        routePoints: [],
        error: route.error,
      };
    }

    sample.latestEventAt = latestCustodyTimestamp(custody.data);
    return {
      connected: true,
      sample,
      custodyEvents: custody.data,
      routePoints: safeRoutePoints(route.data),
    };
  });

export function genericFacilityLabel(value: unknown): string {
  return mapGenericFacility(typeof value === "string" ? value : null);
}
