# Workflow panel browser regressions

Start the existing `artifacts/myos-fertility: web` workflow, then run from the repository root:

```sh
pnpm --filter @workspace/myos-fertility test:workflow
```

The default target is the shared proxy at `http://localhost:80/`. To use a development
preview or an artifact base path, set `PLAYWRIGHT_BASE_URL` to its full URL (including
the base path). Production targets are rejected.

The suite uses the real route, Three.js canvas, projected HTML labels, and document
dialog. WebGL must work: the fallback does not count as a pass. On Replit it uses
the system Chromium with software WebGL. Elsewhere, install Playwright's Chromium
with `pnpm --filter @workspace/myos-fertility exec playwright install chromium`, or
set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Tests cover:

- Sparse overview and initially closed details in every place.
- One detail at a time, replacement, pin toggling, and close-button dismissal.
- Form entry from both a feature and the work area, overlay removal, close/Escape
  restoration, and usable navigation afterward.
- Unsaved form dismissal, preservation of a seeded synthetic draft/activity, and
  preservation after reload.
- Actual non-overlapping, unclipped label/control rectangles at 390px and 320px,
  including numbered pins, place bars, selected details and journey navigation.

Every test uses a disposable browser context, never a saved/user profile. Only a
missing synthetic demo storage key is seeded; nothing clears browser storage or
resets a backend. A request guard blocks and fails on any non-read HTTP request or
reset endpoint access. Tests do not save forms, close transfers, open GPS/chat, or
access real patient records.

Reports, failure screenshots and traces are written under
`generated-artifacts/workflow-tests/` (excluded from Git and deployment).
