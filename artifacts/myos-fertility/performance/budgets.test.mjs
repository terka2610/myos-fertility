import { test } from "node:test";
import assert from "node:assert/strict";
import { checkBudgets, percentile } from "./budgets.mjs";

const baseline = { runs: 3, views: ["network"], profiles: { mobile: {
  load: { readyMs: 100 }, render: { network: { calls: 20 } },
} } };
const run = { profile: "mobile", readyMs: 80, views: { network: { calls: 10 } } };
const report = () => ({ runs: [0, 1, 2].map(() => structuredClone(run)) });

test("uses medians so one noisy cold run does not fail", () => {
  const result = report();
  result.runs[0].readyMs = 200;
  assert.deepEqual(checkBudgets(result, baseline), []);
  assert.equal(percentile([3, 1, 2], 0.5), 2);
  assert.equal(percentile(Array.from({ length: 20 }, (_, i) => i + 1)), 19);
});
test("flags load, download and render regressions", () => {
  const result = report();
  for (const run of result.runs) { run.readyMs = 101; run.views.network.calls = 21; }
  assert.equal(checkBudgets(result, baseline).length, 2);
  const bytesBaseline = structuredClone(baseline);
  bytesBaseline.profiles.mobile.load.downloadBytes = 100;
  for (const run of result.runs) run.downloadBytes = 101;
  assert.match(checkBudgets(result, bytesBaseline).join("\n"), /downloadBytes/);
});
test("missing runs or render measurements fail closed", () => {
  assert.match(checkBudgets({ runs: [] }, baseline).join("\n"), /expected 3/);
  const result = report();
  delete result.runs[0].views.network;
  assert.match(checkBudgets(result, baseline).join("\n"), /missing calls/);
  const missingLoad = report();
  delete missingLoad.runs[0].readyMs;
  assert.match(checkBudgets(missingLoad, baseline).join("\n"), /missing readyMs/);
  assert.throws(() => percentile([]), /empty sample/);
});
test("each place has its own structural budget", () => {
  const result = report();
  const perPlace = structuredClone(baseline);
  perPlace.views.push("patient");
  perPlace.profiles.mobile.render.patient = { calls: 5 };
  for (const run of result.runs) run.views.patient = { calls: 6 };
  assert.match(checkBudgets(result, perPlace).join("\n"), /mobile\/patient/);
  assert.doesNotMatch(checkBudgets(result, perPlace).join("\n"), /mobile\/network/);
});
