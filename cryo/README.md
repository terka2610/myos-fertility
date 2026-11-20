# Cryo sample API and simulated chat

`SMP-0001` is cryo id `CRYO-1700`: eight oocytes that left Harbour IVF and are still with the courier, on the way to CryoNext storage.

The MYOS tables already live in `artifacts/myos-fertility/drizzle/migrations`. In the Supabase SQL editor, run `sql/schema.sql`, then `sql/seed.sql`. To wipe the cryo rows, run `sql/reset.sql` and then `sql/seed.sql` again.

```bash
cd cryo/api
python3 server.py
```

- Sample check: `http://127.0.0.1:8790/api/samples/SMP-0001`
- Simulated chat: `http://127.0.0.1:8790/chat`

`lib/events.ts` and `lib/tokens.ts` are the step names and the `SMP-0001` id shape. The chat is simulated. Linq is not connected.
