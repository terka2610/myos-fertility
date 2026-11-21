export type SupabaseReadErrorKind = "missing_sample" | "permission" | "network" | "unknown";

export type SupabaseReadError = {
  kind: SupabaseReadErrorKind;
  message: string;
  code?: string;
};

export type JsonReadValue =
  string | number | boolean | null | JsonReadValue[] | { [key: string]: JsonReadValue };
export type SampleSnapshotRow = Record<string, JsonReadValue>;
export type CustodyEventRow = Record<string, JsonReadValue>;
export type RoutePointRow = Record<string, JsonReadValue>;

export type SupabaseReadResult<T> = { ok: true; data: T } | { ok: false; error: SupabaseReadError };

function getString(row: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  for (const [key, value] of Object.entries(row)) {
    if (
      typeof value === "string" &&
      keys.some((candidate) => key.toLowerCase().includes(candidate.toLowerCase()))
    ) {
      return value.trim();
    }
  }
  return null;
}

function toRow(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    return value[0] && typeof value[0] === "object" ? (value[0] as Record<string, unknown>) : null;
  }
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function mapGenericFacility(value: string | null): string {
  const normalized = value?.toLowerCase() ?? "";
  if (
    normalized === "clinic-a" ||
    normalized.includes("fertility") ||
    normalized.includes("clinic")
  ) {
    return "Fertility Centre";
  }
  if (
    normalized === "cryoport" ||
    normalized.includes("transport") ||
    normalized.includes("ship") ||
    normalized.includes("carrier")
  ) {
    return "Cryo Transport";
  }
  if (
    normalized === "cryonext" ||
    normalized.includes("storage") ||
    normalized.includes("cryo") ||
    normalized.includes("tank")
  ) {
    return "Cryogenic Storage";
  }
  return "Cryogenic Storage";
}

export function mapSnapshotToRegistry(snapshotValue: unknown, fallbackSampleId = "SMP-0001") {
  const row = toRow(snapshotValue);
  if (!row) return null;

  const displayId = getString(row, ["public_id", "display_id", "sample_id"]) ?? fallbackSampleId;
  const sampleType =
    getString(row, ["specimen_type", "sample_type", "material", "type"]) ?? "Not specified";
  const currentState = getString(row, ["status", "current_state", "state"]) ?? "Status unavailable";

  let facilityCode: string | null = null;
  const facility = row["facility"];
  if (facility && typeof facility === "object" && !Array.isArray(facility)) {
    const facilityObject = facility as Record<string, unknown>;
    facilityCode = typeof facilityObject["code"] === "string" ? facilityObject["code"] : null;
  } else if (typeof facility === "string") {
    facilityCode = facility;
  }
  const storageSite = mapGenericFacility(facilityCode);

  return {
    displayId,
    patientDisplayName: "Patient information protected",
    sampleType,
    currentState,
    storageSite,
    latestEventAt: "",
    source: "supabase" as const,
  };
}

function classifySupabaseError(error: {
  code?: string;
  message?: string;
  status?: number;
}): SupabaseReadError {
  const message = error.message ?? "Unknown Supabase error";
  const code = error.code;
  if (
    code === "42501" ||
    code === "PGRST301" ||
    /\b(permission denied|insufficient privilege|rls|row-level security|not authorized)\b/i.test(
      message,
    )
  ) {
    return { kind: "permission", message, ...(code ? { code } : {}) };
  }
  if (
    error.status === 404 ||
    code === "PGRST202" ||
    /\b(no rows|not found|could not find the function|pgrst116)\b/i.test(message)
  ) {
    return { kind: "missing_sample", message, ...(code ? { code } : {}) };
  }
  if (
    error.status === 0 ||
    error.status === 408 ||
    error.status === 429 ||
    /\b(fetch|network|failed to fetch|timeout|connection)\b/i.test(message)
  ) {
    return { kind: "network", message, ...(code ? { code } : {}) };
  }
  return { kind: "unknown", message, ...(code ? { code } : {}) };
}

type SupabaseClientLike = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{
    data: unknown;
    error: { code?: string; message?: string; status?: number } | null;
  }>;
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => Promise<{
        data: unknown[] | null;
        error: { code?: string; message?: string; status?: number } | null;
      }>;
    };
  };
};

export async function readSupabaseSnapshot(
  supabase: SupabaseClientLike,
  sampleId: string,
): Promise<SupabaseReadResult<unknown>> {
  try {
    const { data, error } = await supabase.rpc("sample_snapshot", { sample_code: sampleId });
    if (error) return { ok: false, error: classifySupabaseError(error) };
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return {
        ok: false,
        error: {
          kind: "missing_sample",
          message: `No Supabase snapshot was returned for ${sampleId}.`,
        },
      };
    }
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "network",
        message: error instanceof Error ? error.message : "Network request failed",
      },
    };
  }
}

export async function readSupabaseCustodyEvents(
  supabase: SupabaseClientLike,
  sampleId: string,
): Promise<SupabaseReadResult<CustodyEventRow[]>> {
  try {
    const { data, error } = await supabase
      .from("custody_events")
      .select("id,sample_id,facility_code,step,recorded_at")
      .eq("sample_id", sampleId);
    if (error) return { ok: false, error: classifySupabaseError(error) };
    return { ok: true, data: (data ?? []) as unknown as CustodyEventRow[] };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "network",
        message: error instanceof Error ? error.message : "Network request failed",
      },
    };
  }
}

export async function readSupabaseRoutePoints(
  supabase: SupabaseClientLike,
  sampleId: string,
): Promise<SupabaseReadResult<RoutePointRow[]>> {
  try {
    const { data, error } = await supabase
      .from("route_points")
      .select("id,sample_id,lat,lon,recorded_at")
      .eq("sample_id", sampleId);
    if (error) return { ok: false, error: classifySupabaseError(error) };
    return { ok: true, data: (data ?? []) as unknown as RoutePointRow[] };
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "network",
        message: error instanceof Error ? error.message : "Network request failed",
      },
    };
  }
}
