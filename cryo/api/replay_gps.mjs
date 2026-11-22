#!/usr/bin/env node
/**
 * Replay a synthetic courier route into the existing Supabase Cryo demo schema.
 *
 * This script is server-side only. It requires a Supabase service-role key and
 * is intentionally fixed to the synthetic sample SMP-0001.
 */

import { pathToFileURL } from "node:url";

export const SAMPLE_ID = "SMP-0001";
export const ROUTE_START = { lat: 24.4539, lon: 54.3773 }; // synthetic clinic
export const ROUTE_END = { lat: 25.2048, lon: 55.2708 }; // synthetic storage
export const DEFAULT_STEPS = 40;
export const DEFAULT_INTERVAL_MS = 2_000;

export function buildRoute(steps = DEFAULT_STEPS) {
  if (!Number.isInteger(steps) || steps < 1 || steps > 500) {
    throw new Error("steps must be an integer from 1 to 500");
  }

  return Array.from({ length: steps + 1 }, (_, index) => {
    const fraction = index / steps;
    return {
      lat: ROUTE_START.lat + (ROUTE_END.lat - ROUTE_START.lat) * fraction,
      lon: ROUTE_START.lon + (ROUTE_END.lon - ROUTE_START.lon) * fraction,
    };
  });
}

export function readConfig(env = process.env) {
  const url = env.SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment.",
    );
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("SUPABASE_URL must be a valid URL.");
  }
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && localHost)) {
    throw new Error("SUPABASE_URL must use HTTPS, except for localhost development.");
  }

  return { url: parsed.origin, serviceRoleKey };
}

async function requestSupabase(
  config,
  table,
  { method = "GET", query = "", body, fetchImpl = fetch } = {},
) {
  const endpoint = new URL(`/rest/v1/${table}${query}`, `${config.url}/`);
  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers.Prefer = "return=minimal";

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error(`Could not reach Supabase while requesting ${table}.`);
  }

  if (!response.ok) {
    // Do not print response bodies or request headers; they may contain sensitive data.
    throw new Error(`Supabase ${method} ${table} failed with HTTP ${response.status}.`);
  }

  if (method === "GET") return response.json();
  return undefined;
}

const pause = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function replayGps({
  config,
  steps = DEFAULT_STEPS,
  intervalMs = DEFAULT_INTERVAL_MS,
  fetchImpl = fetch,
  sleepImpl = pause,
  now = () => Date.now(),
  log = console.log,
} = {}) {
  if (!config?.url || !config?.serviceRoleKey) {
    throw new Error("A Supabase URL and service-role key are required.");
  }
  if (!Number.isInteger(intervalMs) || intervalMs < 0 || intervalMs > 60_000) {
    throw new Error("intervalMs must be an integer from 0 to 60000");
  }

  const query = `?select=public_id&public_id=eq.${encodeURIComponent(SAMPLE_ID)}&limit=1`;
  const samples = await requestSupabase(config, "samples", {
    query,
    fetchImpl,
  });
  if (!Array.isArray(samples) || !samples.some((sample) => sample.public_id === SAMPLE_ID)) {
    throw new Error(
      `Synthetic sample ${SAMPLE_ID} was not found. Run the existing Cryo demo seed first.`,
    );
  }

  const route = buildRoute(steps);
  const startedAt = now();
  await requestSupabase(config, "samples", {
    method: "PATCH",
    query: `?public_id=eq.${encodeURIComponent(SAMPLE_ID)}`,
    body: {
      status: "in_transit",
      current_step: "in_transit",
      current_facility: "CRYOPORT",
    },
    fetchImpl,
  });
  await requestSupabase(config, "custody_events", {
    method: "POST",
    body: {
      sample_id: SAMPLE_ID,
      facility_code: "CLINIC-A",
      step: "released",
      note: "Synthetic courier route replay started.",
      recorded_at: new Date(startedAt).toISOString(),
    },
    fetchImpl,
  });

  for (const [index, point] of route.entries()) {
    await requestSupabase(config, "route_points", {
      method: "POST",
      body: {
        sample_id: SAMPLE_ID,
        lat: point.lat,
        lon: point.lon,
        recorded_at: new Date(startedAt + index * intervalMs).toISOString(),
      },
      fetchImpl,
    });
    log(`Synthetic route point ${index}/${steps} saved.`);
    if (intervalMs > 0 && index < route.length - 1) {
      await sleepImpl(intervalMs);
    }
  }

  const arrivedAt = new Date(now()).toISOString();
  await requestSupabase(config, "samples", {
    method: "PATCH",
    query: `?public_id=eq.${encodeURIComponent(SAMPLE_ID)}`,
    body: {
      status: "in_storage",
      current_step: "arrived_storage",
      current_facility: "CRYONEXT",
    },
    fetchImpl,
  });
  await requestSupabase(config, "custody_events", {
    method: "POST",
    body: {
      sample_id: SAMPLE_ID,
      facility_code: "CRYONEXT",
      step: "arrived_storage",
      note: "Synthetic courier route replay completed.",
      recorded_at: arrivedAt,
    },
    fetchImpl,
  });
  log(`Synthetic route replay finished for ${SAMPLE_ID}.`);
}

function isDirectExecution() {
  return process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
}

if (isDirectExecution()) {
  replayGps({ config: readConfig() }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
