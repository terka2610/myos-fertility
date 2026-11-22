# Samples scene performance gate

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/myos-fertility run test:scene-budgets
pnpm --filter @workspace/myos-fertility run test:scene-performance
```

The last command builds the production app, starts an isolated Node test server on
an available loopback port, runs the benchmark, compares against
`scene-baseline.json`, and stops the server/browser. It does not deploy, start a
second development workflow, sign in, save forms, or touch the backend. Chromium
must be installed; the Replit Chromium executable is detected automatically.
Elsewhere install Chromium with `pnpm --filter @workspace/myos-fertility exec playwright install chromium`,
or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## What is measured

- Three fresh browser contexts per profile, blocked service workers and disabled
  HTTP cache. No storage state or authenticated browser is reused.
- Direct cold navigation to `/clinic/samples?scenePerf=1`, the actual synthetic
  sample route and default clinic view, followed by scrolling the scene into view.
- **readyMs:** navigation start to submitted WebGL geometry and projected HTML
  controls, plus the next animation frame. Canvas attachment, build duration,
  network idle, and the loading skeleton do not count as readiness.
- **interactiveMs:** navigation start to a successful real pointer selection of
  the clinic's Document check pin and a visible feature detail.
  **interactionMs** separately records the scripted two-click response time.
  These include automation scheduling, so they are conservative lab measurements,
  not browser INP or a claim about a real user's device.
- **downloadBytes / scriptBytes:** actual CDP encoded transfer bytes completed by
  scene readiness, including response headers; all resources / JavaScript.
  These are observed transfers, not the build's estimated gzip size. The isolated
  Node server does not compress responses, so these are deliberately uncompressed
  lab budgets. The production proxy/CDN may transfer fewer bytes.
- Each of the five views gets 1.5 seconds to settle and a 2-second sample of
  actual rendering: p95 main-thread frame CPU/submission time, p95 frame interval,
  draw calls, triangles, live geometries and textures. Samples are bounded to 600.
  This catches geometry/line-helper cost changes as well as bundle growth.
- Per cold run, actual frame counters must stop while a Document Form is open
  and while the scene is off-screen, and increase after closing/scrolling back.
  Hiding overlays alone also implies pause. The document `visibilitychange`
  handler is checked using a synthetic hidden state because headless Chromium
  does not reliably background tabs; this is not an OS power/battery test.

The desktop profile is 1440×1000 at 1× CPU, unthrottled network. Mobile is 390×844
at 4× CPU slowdown, 150 ms latency, 1.6 Mbit/s download and 750 Kbit/s upload.
Both use DPR 1 (matching Canvas), reduced motion, and Chromium SwiftShader for
repeatable software WebGL. These are regression checks, **not real-phone GPU/FPS
benchmarks**. Compare only on similar hosts without competing CPU-heavy work.
No render time is spent sampling normal visitors: diagnostics require the query
flag; the component does not store or transmit patient or form information.

## Results and failures

`generated-artifacts/scene-performance/report.json` contains all raw run metrics,
browser version, profile settings and failures. `server.log` contains production
build/startup output. Both are ignored by Git and deployment. A missing scene,
WebGL fallback, broken click, failure to pause/resume, uncaught browser error,
missing sample, or budget regression returns a nonzero exit code.

Load metrics use the median of three cold runs. Render metrics use the median of
the three per-run p95 values, separately for every view. This avoids failing for
one noisy scheduling spike while catching sustained slowdowns. Structural budgets
(bytes, calls, triangles, geometry/texture counts) complement the noisier timings.

## Initial calibration

Measured on 2026-11-21 using Chromium 155 and SwiftShader:

| Profile | Cold rendered scene | Transfer at readiness | Script transfer |
| --- | ---: | ---: | ---: |
| Desktop | median 1.06 s | 2.12 MB | 1.84 MB |
| Throttled mobile | about 13 s | 2.12 MB | 1.84 MB |

In view order (overview, clinic, transport, storage, patient), draw calls were
approximately 81, 89, 74, 77, 43 and triangles approximately 22,066, 11,882,
14,064, 22,610, 8,924. Counts can vary slightly with the shared animation clock.
These establish per-view limits, rather than giving every view the heaviest
view's allowance. Desktop p95 frame intervals were roughly 61–123 ms across
views on software WebGL; they must not be represented as hardware FPS results.

The checked-in load limits are 3 s desktop / 20 s mobile to rendered geometry,
4.5 s / 23 s to the exercised interactive detail, and 2.55 MB total / 2.21 MB
JavaScript transfer. Per-view geometry and draw-call limits allow roughly 20–25%
growth; timing limits have more headroom for shared-host scheduling variance.
These are regression budgets, not a claim that a 20-second mobile load is ideal.

## Updating baselines deliberately

Run `pnpm --filter @workspace/myos-fertility run test:scene-performance --measure`
to collect three runs per profile **without changing or enforcing the checked-in
budgets**. All interaction/pause checks still run. Review the report, compare
each median with the checked-in measurements, and investigate regressions before
editing the limits. Never automatically accept the current build as the baseline.
After a browser/host change, measure again on the intended gate host and record
the reason for any adjusted budgets. Budget evaluator unit tests include deliberate
load, download and render regressions and missing-run/sample cases.

For a targeted diagnostic, `--measure --profile=mobile --runs=1` avoids repeating
unrelated runs. Partial runs cannot be used in gating mode. On browser failures
the harness also saves a screenshot and prints scene visibility/frame diagnostics.
