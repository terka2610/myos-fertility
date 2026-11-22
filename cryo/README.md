# Cryo sample API and simulated chat

`SMP-0001` is cryo id `CRYO-1700`: eight oocytes that left NYU Abu Dhabi and are still with the courier, on the way to MBZUAI.

The MYOS tables already live in `artifacts/myos-fertility/drizzle/migrations`. In the Supabase SQL editor, run `sql/schema.sql`, then `sql/seed.sql`. To wipe the cryo rows, run `sql/reset.sql` and then `sql/seed.sql` again.

```bash
cd cryo/api
python3 server.py
```

- Sample check: `http://127.0.0.1:8790/api/samples/SMP-0001`
- Simulated chat: `http://127.0.0.1:8790/chat`

`lib/events.ts` and `lib/tokens.ts` are the step names and the `SMP-0001` id shape. The chat is simulated. Linq is not connected.

The `/chat` preview reads only the synthetic GPS asset `vehicle-cryo-01` from `gps-monitor`. That feed is returned separately, is not written to the Cryo database, and is not linked to patient or sample records. To add route points without clearing monitor data, run:

```bash
python3 gps-monitor/simulate.py --url http://127.0.0.1:18589/gps --live --skip-reset
```

## Replay the route into Supabase

`sql/schema.sql` and `sql/seed.sql` use the existing Supabase demo tables. The optional
`api/replay_gps.mjs` script replays a synthetic route for the seeded `SMP-0001` into
`route_points`, and updates its synthetic custody status. It does not delete prior route
points. It uses the Supabase service-role key on the server; never put that key in browser
code or commit it.

```bash
SUPABASE_URL=https://your-project.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-rotated-service-role-key \
node cryo/api/replay_gps.mjs
```

This script writes to Supabase but does not change the current Preview data source: `/chat`
still reads the separate SQLite Cryo workflow and GPS monitor feed. The Supabase replay is
synthetic only and must not be used with real patient records. No Aiven connection is
configured in this repository.
