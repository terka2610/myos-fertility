---
name: Production startup checks
description: Environment-specific startup constraints observed when publishing the MYOS artifact services.
---

Test production commands from the repository root, not from the artifact directory used by managed development workflows. Keep the two command contexts separate.

**Why:** A publish compiled successfully but crash-looped because the development-relative Python paths resolved outside the repository in production.

**How to apply:** Launch production-command smoke checks from the repository root with isolated ports and temporary synthetic databases. Confirm every service responds and public reset endpoints remain unavailable.

Bind the production Nitro server explicitly to IPv4 (`0.0.0.0`).

**Why:** The published runtime rejected the default IPv6 wildcard bind with `listen ENOSYS`.

**How to apply:** Preserve the explicit production host when changing web server commands. A local compile alone cannot verify production startup.
