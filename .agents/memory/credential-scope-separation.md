---
name: Credential scope separation
description: A security lesson for keeping role-based sessions distinct from asset-scoped sessions.
---

Represent operator authority with a reserved scope marker that cannot be confused with a valid asset scope.

**Why:** Asset codes can use ordinary words such as `operator`; treating such an identifier as a role marker can accidentally grant broad session behavior to one asset.

**How to apply:** When adding signed session roles or device scopes, use unambiguous type prefixes or structured claims, and test both a role-like asset name and cross-scope writes.
