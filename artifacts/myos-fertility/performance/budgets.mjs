export function percentile(values, fraction = 0.95) {
  if (!values.length) throw new Error("Cannot measure an empty sample");
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * fraction) - 1];
}

export function checkBudgets(report, baseline) {
  const failures = [];
  for (const [profile, limits] of Object.entries(baseline.profiles)) {
    const runs = report.runs.filter((run) => run.profile === profile);
    if (runs.length < baseline.runs) {
      failures.push(`${profile}: expected ${baseline.runs} cold runs; got ${runs.length}`);
      continue;
    }
    for (const [metric, limit] of Object.entries(limits.load)) {
      const values = runs.map((run) => run[metric]);
      if (values.some((value) => !Number.isFinite(value))) {
        failures.push(`${profile}: missing ${metric}`);
        continue;
      }
      const value = percentile(values, 0.5);
      if (!Number.isFinite(value) || value > limit) failures.push(`${profile} median ${metric}: ${value} > ${limit}`);
    }
    for (const view of baseline.views) {
      for (const [metric, limit] of Object.entries(limits.render[view])) {
        const values = runs.map((run) => run.views[view]?.[metric]);
        if (values.some((value) => !Number.isFinite(value))) {
          failures.push(`${profile}/${view}: missing ${metric}`);
          continue;
        }
        const value = percentile(values, 0.5);
        if (value > limit) failures.push(`${profile}/${view} median ${metric}: ${value} > ${limit}`);
      }
    }
  }
  return failures;
}
