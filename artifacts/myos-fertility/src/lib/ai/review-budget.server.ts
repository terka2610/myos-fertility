/** Conservative process-local guard for public synthetic-only review endpoints.
 * A shared distributed limiter should replace this if the app scales to multiple instances.
 */
export function createReviewBudget(limit = 20, windowMs = 60_000) {
  let windowStart = 0;
  let count = 0;
  return (now = Date.now()) => {
    if (now - windowStart >= windowMs) {
      windowStart = now;
      count = 0;
    }
    if (count >= limit) return false;
    count++;
    return true;
  };
}

export const takeDemoReviewBudget = createReviewBudget();
