import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  readSupabaseSnapshot,
  readSupabaseCustodyEvents,
  readSupabaseRoutePoints,
  mapSnapshotToRegistry,
  mapGenericFacility,
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

export const readSupabaseSample = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<SupabaseSampleResponse> => {
    const result = await readSupabaseSnapshot(context.supabase as never, data.sampleId);
    if (!result.ok) return { connected: false, sample: null, error: result.error };
    const sample = mapSnapshotToRegistry(result.data, data.sampleId);
    if (!sample) {
      return {
        connected: false,
        sample: null,
        error: { kind: "missing_sample", message: "The Supabase snapshot was empty." },
      };
    }
    return { connected: true, sample };
  });

export const readSupabaseCustody = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
  .middleware([requireSupabaseAuth])
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
      return { connected: true, points: result.data };
    },
  );

export const readSupabaseJourney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    const [custody, routes] = await Promise.all([
      readSupabaseCustodyEvents(supabase, data.sampleId),
      readSupabaseRoutePoints(supabase, data.sampleId),
    ]);
    const custodyEvents = custody.ok ? custody.data : [];
    const routePoints = routes.ok ? routes.data : [];

    if (!custody.ok) {
      return {
        connected: false,
        sample: null,
        custodyEvents: [],
        routePoints: [],
        error: custody.error,
      };
    }
    if (!routes.ok) {
      return {
        connected: false,
        sample: null,
        custodyEvents: [],
        routePoints: [],
        error: routes.error,
      };
    }

    return { connected: true, sample, custodyEvents, routePoints };
  });

export function genericFacilityLabel(value: unknown): string {
  return mapGenericFacility(typeof value === "string" ? value : null);
}
