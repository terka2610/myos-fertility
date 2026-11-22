import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRoute,
  readConfig,
  replayGps,
  ROUTE_END,
  ROUTE_START,
  SAMPLE_ID,
} from "./replay_gps.mjs";

test("buildRoute returns the synthetic clinic-to-storage route endpoints", () => {
  const route = buildRoute(4);
  assert.equal(route.length, 5);
  assert.deepEqual(route[0], ROUTE_START);
  assert.deepEqual(route.at(-1), ROUTE_END);
});

test("buildRoute rejects invalid step counts", () => {
  assert.throws(() => buildRoute(0), /steps must be an integer/);
  assert.throws(() => buildRoute(501), /steps must be an integer/);
});

test("readConfig requires server-side Supabase environment values", () => {
  assert.throws(() => readConfig({}), /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/);
  assert.throws(
    () =>
      readConfig({
        SUPABASE_URL: "http://example.test",
        SUPABASE_SERVICE_ROLE_KEY: "not-used",
      }),
    /must use HTTPS/,
  );
  assert.equal(
    readConfig({
      SUPABASE_URL: "https://example.supabase.co/",
      SUPABASE_SERVICE_ROLE_KEY: "test-only",
    }).url,
    "https://example.supabase.co",
  );
});

test("replayGps writes only the seeded synthetic sample and route tables", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url: new URL(url), ...options });
    return {
      ok: true,
      status: 200,
      json: async () => [{ public_id: SAMPLE_ID }],
    };
  };

  await replayGps({
    config: { url: "https://example.supabase.co", serviceRoleKey: "test-only" },
    steps: 2,
    intervalMs: 0,
    fetchImpl,
    now: () => 1_800_000_000_000,
    log: () => {},
  });

  assert.equal(requests.length, 8);
  assert.match(requests[0].url.pathname, /\/samples$/);
  assert.match(requests[1].url.pathname, /\/samples$/);
  assert.match(requests[2].url.pathname, /\/custody_events$/);
  assert.deepEqual(
    requests.filter(({ url }) => url.pathname.endsWith("/route_points")).map(({ body }) => {
      const point = JSON.parse(body);
      return [point.sample_id, point.lat, point.lon];
    }),
    [
      [SAMPLE_ID, ROUTE_START.lat, ROUTE_START.lon],
      [SAMPLE_ID, (ROUTE_START.lat + ROUTE_END.lat) / 2, (ROUTE_START.lon + ROUTE_END.lon) / 2],
      [SAMPLE_ID, ROUTE_END.lat, ROUTE_END.lon],
    ],
  );
  assert.equal(requests.at(-2).method, "PATCH");
  assert.equal(JSON.parse(requests.at(-2).body).current_facility, "CRYONEXT");
});

test("replayGps stops before writing when the synthetic sample is absent", async () => {
  let writes = 0;
  await assert.rejects(
    replayGps({
      config: { url: "https://example.supabase.co", serviceRoleKey: "test-only" },
      steps: 1,
      intervalMs: 0,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => [],
      }),
      log: () => {
        writes += 1;
      },
    }),
    /Synthetic sample SMP-0001 was not found/,
  );
  assert.equal(writes, 0);
});
