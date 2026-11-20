# MYO'S migration roadmap
- [x] Fertility app: landing, programs, auth, dashboard, consultation (text/voice), history, doctor, resources, settings
- [ ] Live video avatar (HeyGen LiveAvatar) — blocked on LIVEAVATAR_API_KEY
- [ ] ElevenLabs voice — blocked on ELEVENLABS_API_KEY (browser voice used meanwhile)
- [ ] Care platform: clinics, staff, programs catalog, courses/lessons, handoffs, community, memory, agent grants
- [ ] Egg freezing stage pages and instructional videos
- [ ] Publisher / subscriber / admin teaching & avatar marketplace, billing, webhooks, MCP server
- [ ] Import existing records and users — blocked on CSV/JSON exports from the old Postgres database

- [x] Redesign around the digital twin (landing page look, 24/7 in every language, specialists, provider workspace, admin review)
- [x] Pre-recorded Tessa video uploaded and playable on her twin page
- [ ] Cloned doctor voice (waiting on ElevenLabs key)
- [ ] Paused: care platform and teaching marketplace migration

## Current requests
- [x] Optimize introduction video size and verify playback, stopping and retry on phones
- [x] Address Linq .env request using encrypted server secrets instead of exposing the private key
- [x] Correct the Linq outgoing reply envelope for normal and fallback replies
- [ ] Replace rejected Linq API key and verify a new real-text reply — awaiting valid key
- [x] Audit Linq entry points and fix older incoming message formats and storage-error handling
- [x] Play the uploaded fertility guide video from the homepage introduction button
- [x] Rewrite About with the uploaded content and replace the old brand spelling sitewide
- [x] Correct My twin navigation highlight on desktop and mobile
- [x] Address password-prefill request: do not expose account credentials; browser password autofill is enabled
- [x] Public grouped Resources guides, source links, and automatic Tessa questions with login return
- [x] Play the uploaded video on Tessa's page and add the queer-couple suggested question
- [x] Allow new-twin drafts without file uploads and prefill Dr Tessa's portrait
- [x] Label all twin expertise lists and update Aisha's PCOS/endometriosis and Elena's queer/trans selections
- [x] Remove lip-sync; all doctor portraits in white coats, approachable
- [x] Fixed (deterministic) answers for IVF, egg freezing, surrogacy from the protocols; scope + no-medication-advice guardrails
- [x] Explain connecting an OpenAI key for wider knowledge later
- [x] Put patient intake and specialists on the same page as the twin hub
- [x] Try as patient / provider demo buttons (instant sign-in, Maya + Dr Tessa)
- [x] Chat suggestion chips; kind "not covered" reply with Send to clinic; red only for safety rules
- [x] Trim demo knowledge base; remove Fertility companion from nav

## Instant demos brief (uploaded)
- [ ] Maya dashboard ("Welcome back, Maya") with clinical record sections ("Not yet available" until files arrive) — waiting on Maya's records
- [ ] Maya's 3 preloaded questions with Quick / Detailed / Talk to a specialist options
- [ ] Provider wizard "Use pre-filled demo information" with Tessa's media — waiting on Tessa's portraits, voice and videos
- [ ] Per-visitor isolated, expiring demo sessions (currently one shared demo account per role)

## Linq text channel
- [x] Shared answer pipeline, webhook, dedupe, first-text welcome, QR on Tessa page
- [x] Keys, number and Tessa owner set
- [ ] Point the Linq webhook at the published site and send a test text

## Custom domain
- [x] health.myos.sk checked: pending verification; A + TXT records reported to user for Cloudflare
