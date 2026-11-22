---
name: Integration boundaries
description: User-approved rules for combining Muhsina features with the current Replit application.
---

Preserve both the existing Replit snapshot and GitHub main when integrating Muhsina's work. Port useful additions into main's architecture rather than replacing it.

**Why:** The user chose “Combine both snapshots” and supplied a safe-integration plan that prioritizes main's architecture, security, and services.

**How to apply:** Use an integration branch and normal review, never overwrite main. Read journey/GPS information from the existing Python services rather than introducing a second GPS source or silently migrating persistence to Supabase.
