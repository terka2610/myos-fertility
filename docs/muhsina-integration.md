# Muhsina integration

The `integrate/muhsina` branch combines the existing Replit snapshot with selected
features from `muhsina/cryogenic-workflow`. It does not replace `main`.
`backup/main-before-muhsina` marks the original GitHub main snapshot.

## Feature inventory and decisions

| Group | Features | Integration decision |
| --- | --- | --- |
| A — main only | MYOS 3D navigation, progressive place details, mobile scene controls and performance gates | Preserved |
| A — main only | Python GPS monitor, tracker administration, scoped credentials, public reset protection | Preserved |
| A — main only | Cryo chat, stakeholder membership, WhatsApp contact configuration, synthetic route feed | Preserved |
| B — Muhsina additions | Journey metrics and route replay | Ported into Journey Calendar using the existing Cryo API/GPS snapshot; no second location source |
| B — Muhsina additions | AI document validation | Ported into the existing document dialog; deterministic checks work locally, external review requires synthetic-data consent |
| B — Muhsina additions | AI voice field mapping | Added to the existing voice review UI; opt-in only, protected fields excluded from suggestions, manual approval required |
| B — Muhsina additions | Clinic selection and patient onboarding | Added `/clinics` and `/patient` with fictional fixtures and explicit demo notices |
| C — overlapping implementations | Workflow steps, role navigation, document forms and registry | Main's existing working architecture and styling retained; additions integrated into those screens rather than a parallel workflow |
| C — overlapping implementations | GPS-derived ETA, transit and milestones | Recorded Cryo events determine progress; stale GPS never creates a fresh ETA, transit does not start before pickup |
| C — different persistence | Supabase journey writes | Not copied: retaining the existing services avoids a database migration and a second source of truth |

## Safety and operating limits

- Synthetic courier positions are not joined to patient records.
- No WhatsApp messages are sent by this integration.
- No reset endpoints are enabled.
- Groq is the preferred chat provider, with its model selected by `GROQ_MODEL`.
  Missing configuration gives an explicit message while local validation and voice
  matching remain usable. ElevenLabs powers consented doctor voices when authorized;
  otherwise browser speech remains available.
- External voice mapping receives the opted-in transcript. Never use real patient
  information in that feature; consent is not a substitute for anonymization.
- AI suggestions do not automatically change forms or save records.
- Clinic selection is illustrative; it does not create or filter clinical records.
- Protected server functions retain their existing server-side authentication.
  Public demo functions can run without a configured Supabase client.

## Verification

The production build, TypeScript checks, journey metric tests, clinic selection
tests and form safety tests passed. The workflow browser checks cover scene
navigation, preservation of saved drafts, 390px/320px layouts, and the local and
missing-key AI fallback paths. Scene budget/performance checks also passed.

Muhsina's history is recorded with an `ours` merge after manual porting; that merge
is provenance, not a replacement of the main application tree. Review the pull
request and merge normally; do not force-push main.

## Latest feature priority

The user subsequently requested Muhsina-first feature behavior and a normal update
to main. Her latest patient treatment view, timeline, logistics helper, document
examples and leaflet downloads are now included on `/patient`. They are synthetic
and do not read patient data or claim real signatures. The existing clinic-selection
journey remains available on the same route.

Twin chat, translations, intent classification, appointment-time extraction and
fertility consultations now prefer Groq. Provider keys remain server-side; voice
cloning requires recorded consent and ownership. Public AI form review has a
process-local request budget and bounded timeouts.

The operator service check uses a short synthetic text and does not save audio or
read patient records. It can be run explicitly with `check:ai-services`; normal
unit tests never use live provider credits.
