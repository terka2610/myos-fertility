import test from "node:test";
import assert from "node:assert/strict";
import { createReviewBudget } from "./review-budget.server.ts";

test("public demo AI reviews have a bounded rolling request budget", () => {
  const take = createReviewBudget(2, 60_000);
  assert.equal(take(60_000), true);
  assert.equal(take(60_001), true);
  assert.equal(take(60_002), false);
  assert.equal(take(120_000), true);
});
