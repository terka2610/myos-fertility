# Cryo sample API and simulated chat

`SMP-0001` is cryo id `CRYO-1700`: eight oocytes that left NYU Abu Dhabi and are still with the courier, on the way to MBZUAI.

The MYOS tables already live in `artifacts/myos-fertility/drizzle/migrations`. In the Supabase SQL editor, run `sql/schema.sql`, then `sql/seed.sql`. To wipe the cryo rows, run `sql/reset.sql` and then `sql/seed.sql` again.

```bash
cd cryo/api
python3 server.py
```

- Sample check: `http://127.0.0.1:8790/api/samples/SMP-0001`
- Simulated chat: `http://127.0.0.1:8790/chat`

WhatsApp uses the admin, clinic, and storage numbers already joined to the Twilio trial. Cryoport and the patient stay on the chat page. Set these environment values where the server runs, and do not commit them:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WEBHOOK_URL`, the public `https://…/api/twilio/whatsapp` address Twilio calls

In the Twilio Try out WhatsApp page, set the auto-reply to Custom and paste that webhook. A message from one of the three phones is posted as that party. Assistant replies go back to the phone that owns the role. Announcements go to the admin phone. The trial keeps one recipient active in the console at a time, so a send to a phone that is not the active session can fail while the chat itself still updates.

`lib/events.ts` and `lib/tokens.ts` are the step names and the `SMP-0001` id shape.
