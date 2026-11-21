// Reads the courier GPS monitor (GET /api/latest). The monitor stores asset positions only,
// with no patient or sample identity. The demo links SMP-0001 to vehicle-cryo-01; that link
// is not stored anywhere, so it lives here.

export const DEMO_SAMPLE_VEHICLES: Readonly<Record<string, string>> = {
  "SMP-0001": "vehicle-cryo-01",
};

export interface VehicleFix {
  assetId: string;
  lat: number;
  lon: number;
  recordedAt: string;
  speedKmh: number | null;
  accuracyM: number | null;
}

export type VehicleFixResult =
  | { ok: true; fix: VehicleFix }
  | { ok: false; reason: "not_configured" | "unreachable" | "no_fix" | "invalid_response" };

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Extract one asset's last fix from the monitor's /api/latest payload. */
export function parseLatestFix(payload: unknown, assetId: string): VehicleFixResult {
  if (!payload || typeof payload !== "object") return { ok: false, reason: "invalid_response" };
  const assets = (payload as { assets?: unknown }).assets;
  if (!Array.isArray(assets)) return { ok: false, reason: "invalid_response" };
  const asset = assets.find(
    (item): item is { last?: unknown } =>
      Boolean(item) &&
      typeof item === "object" &&
      (item as { asset_id?: unknown }).asset_id === assetId,
  );
  const last = asset?.last;
  if (!last || typeof last !== "object") return { ok: false, reason: "no_fix" };
  const row = last as Record<string, unknown>;
  const lat = asNumber(row["lat"]);
  const lon = asNumber(row["lon"]);
  const recordedAt = typeof row["recorded_at"] === "string" ? row["recorded_at"] : null;
  if (lat === null || lon === null || !recordedAt) return { ok: false, reason: "no_fix" };
  return {
    ok: true,
    fix: {
      assetId,
      lat,
      lon,
      recordedAt,
      speedKmh: asNumber(row["speed_kmh"]),
      accuracyM: asNumber(row["accuracy_m"]),
    },
  };
}

/** Server-side only: fetch the latest fix for an asset from GPS_MONITOR_URL. */
export async function fetchLatestFix(
  assetId: string,
  baseUrl: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<VehicleFixResult> {
  if (!baseUrl) return { ok: false, reason: "not_configured" };
  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/api/latest`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return { ok: false, reason: "unreachable" };
    return parseLatestFix(await response.json(), assetId);
  } catch {
    return { ok: false, reason: "unreachable" };
  }
}
