---
name: Workflow scope and safety
description: User-directed product boundaries for MYOS logistics demonstrations and the 3D workflow interface.
---

Use the user's supplied MYOS 3D scene as an interactive workflow interface, not merely a decorative model. Selecting clinic, transport, or storage should expose that area's usable functionality.

**Why:** The user explicitly requested that the model be the interface and that clicking places give access to their workflow.

**How to apply:** Keep the existing MYOS product and workflow actions; connect scene selections to those actions and retain accessible navigation for people who cannot use 3D.

Reveal explanatory text only after a specific place or feature is selected. A newly opened detail must replace the previous one rather than add another overlay.

**Why:** The user reported slow loading and overlapping text, and explicitly asked for click-to-reveal information with other content disappearing.

**How to apply:** Keep the default scene sparse, show at most one feature detail, and hide scene text while a working form is open. Prefer lightweight geometry and rendering over decorative effects.

Keep synthetic demonstration data separate from real patient records. Keep reset endpoints disabled on the public preview.

**Why:** The user explicitly required these safety boundaries while connecting Cryo chat to the GPS demonstration feed.

**How to apply:** Do not join demonstration positions, scripted messages, or browser-local sample forms to clinical records. Label illustrative and unconnected capabilities accurately.

Check projected workflow controls with rendered bounds and pointer hit-testing, not just DOM presence or keyboard activation.

**Why:** Mobile feature pins could still open details from the keyboard while a place bar intercepted pointer clicks. DOM-only checks would have missed the unusable touch targets.

**How to apply:** For responsive scene changes, verify visible controls are separate, unclipped and clickable at narrow widths; do not bypass pointer failures with forced clicks.

Treat viewport state as a prerequisite for measuring the scene, not as evidence of a rendering failure.

**Why:** Under mobile throttling, scrolling before the lazy canvas mounted led to a first-frame timeout. On the narrow layout, scrolling to the footer also left the scene visible, so it was not a valid off-screen test.

**How to apply:** Wait for canvas attachment, explicitly reveal it before timing readiness, and verify actual bounds before asserting an off-screen pause. Preserve real rendering suspension rather than disabling it for benchmarks.
