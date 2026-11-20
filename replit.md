# MYOS Fertility

The original MYOS fertility-care application imported from the user's Lovable ZIP, preserving its pages, styling, database schema, and patient/provider workflows.

## Run & Operate

- `pnpm --filter @workspace/myos-fertility run dev` — managed web workflow, using injected `PORT` and `BASE_PATH`.
- `pnpm --filter @workspace/myos-fertility run typecheck` — check the imported application.
- `pnpm --filter @workspace/myos-fertility run build` — production client and Node server build; requires the service environment.
- `pnpm --filter @workspace/myos-fertility run serve` — run the production Node server from `.output/server/index.mjs`.

## Stack and structure

- Original React + TanStack Start application, TypeScript, Tailwind CSS, and Supabase.
- `artifacts/myos-fertility/src/routes/` — original public and authenticated pages.
- `artifacts/myos-fertility/src/styles.css` — original visual theme.
- `artifacts/myos-fertility/src/lib/` — original server functions, clinical safety rules, and knowledge content.
- `artifacts/myos-fertility/drizzle/` — original exported migrations; not applied to a different database.
- The template's shared Express API and mockup sandbox are not needed to run the imported application.

## Migration decisions

- Preserve the existing Supabase database and authentication rather than replace them.
  **Why:** the user asked to run the existing app, not migrate accounts or data to a different provider. Do not run exported SQL or change the data store without explicit authorization.
- Use standard TanStack Start, Vite, and Nitro's Node server instead of Lovable's build wrapper.
  **Why:** server functions and server-side rendering must remain functional outside the original hosting environment.
- Google sign-in uses the same Supabase project's OAuth provider directly. Lovable editor sign-in is not available here.
- Missing backend configuration must leave public pages accessible and show actionable setup messages; never fabricate demo sessions or bypass authenticated routes.

## Existing backend connection

The imported `.env` was deliberately not read, extracted, or committed. Configure values through project Secrets:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` — the intentionally public key, never a service-role key; this is included in the browser bundle.
- `SUPABASE_SERVICE_ROLE_KEY` — server only; required by the original shared-demo sign-in function.

The existing Supabase project's auth settings must allow the app's actual callback URLs. No database records or auth identities have been migrated.

## Missing media and optional services

Most original media assets are `.asset.json` manifests pointing at Lovable-hosted `/__l5e/assets-v1/` paths; their file bytes were not exported. The fictional Maya image is included.

- `MYOS_ASSET_ORIGIN` — optional HTTPS address of the original published site. When configured, Vite resolves the existing asset manifests against that site. This retains a dependency on the original host; permanent recovery requires the original files.
- Original AI server functions still reference Lovable's AI gateway. AI responses are not connected or verified in this environment. Do not claim full chat functionality before connecting a supported AI provider.
- Original ElevenLabs speech and Linq messaging integrations require their existing service configuration; speech code includes its original browser fallback.

## Production

This is a server-rendered app, not a static SPA. The artifact uses the Node server production command and routes `/api/linq` to the imported webhook handler. The general shared API service stays separate.
