# MYOS Fertility

The MYOS Fertility application, adapted to run on Replit while preserving its original design and Supabase-backed workflows.

## Requirements

- Node.js 24
- pnpm

## Development

From the repository root:

```sh
pnpm install
PORT=18587 BASE_PATH=/ pnpm --filter @workspace/myos-fertility run dev
```

On Replit, use the configured MYOS Fertility web workflow; it supplies the port and base path.

## Checks and production

```sh
pnpm --filter @workspace/myos-fertility run typecheck
PORT=18587 BASE_PATH=/ pnpm --filter @workspace/myos-fertility run build
PORT=18587 BASE_PATH=/ pnpm --filter @workspace/myos-fertility run serve
```

This is a server-rendered TanStack Start application, not a static website.

## Configuration

Configure credentials through your hosting environment's secret manager, never in committed files:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` — intentionally public; included in the browser bundle.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only; never expose it in browser configuration.

The public pages work without these values. Sign-in and shared demos require the existing Supabase backend. Its allowed authentication redirect URLs must include your application's address.

Do not apply the exported database migrations to a new or existing database without reviewing and authorizing that change.

## Current limitations

- The original export omitted most media files. `MYOS_ASSET_ORIGIN` can point to the original HTTPS site when available, retaining a dependency on that host.
- Live AI chat, speech, and messaging require their service connections; they are not confirmed working in this environment.
- No credentials, database records, or original uploaded archive are included in this repository.

See [replit.md](replit.md) for operating details and migration constraints.

## Collaboration

Create a branch for changes and open a pull request into `main`. Repository access is managed in GitHub under **Settings → Collaborators**.
