---
name: Integration boundaries
description: User-approved rules for combining Muhsina features with the current Replit application.
---

Prioritize Muhsina's feature behavior when integrating her branch, while preserving Replit startup/routing, existing Cryo/GPS services, and synthetic-data safety boundaries.

**Why:** On 2026-11-22 the user changed the earlier main-first preference: “prioritize muhusina branch for features as opposed to main one pull from there and push to main.”

**How to apply:** Integrate and verify on a working branch, then update main normally when the user requests it; never force-push. Prefer Muhsina's newer product features over conflicting older UI, but do not silently migrate persistence or join synthetic patient IDs to real records.
