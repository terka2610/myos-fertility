<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## MYO'S migration
- Fertility safety classification (src/lib/fertility/safety.ts) runs before any AI call; deterministic categories never reach the model. Why: ported core guarantee of the original app.
- Fertility knowledge base is bundled JSON with in-process keyword retrieval (src/lib/fertility/knowledge.ts). Why: small static KB; avoids a DB round-trip.
- Imported users are linked by verified email via public.legacy_user_map (server-only). Why: old passwords can't carry over.
- Doctor digital twins live in src/lib/twin (rules.ts pure + tested, twin.functions.ts server). Escalation is rule-based first, then a model needs_care_team flag for non-English questions; care-team text is fixed per language in languages.ts. Why: the model never writes the handoff or dosing advice.
- Twins go draft -> review -> published; a DB trigger stops non-admins publishing, and patients only retrieve from approved documents. Demo doctors (is_demo) answer from bundled kb.json. Why: clinical content is reviewed before patients see it.
- Twin originals (photos, voice, documents) live in the private twin-media bucket under <user id>/<folder>/. Why: owner-only storage policies.
- Fixed answers and guardrails live in src/lib/twin/faq.ts (pure + tested) and run after escalation rules, before any model call, in both twin chat and the companion. Why: demo questions must get the same reviewed answer every time.
- Model calls use OPENAI_API_KEY (and optional OPENAI_MODEL) when that secret exists, else the built-in AI. Why: lets the clinic switch to its own OpenAI account without code changes.
- Doctor portraits are static images (no lip-sync canvas). Why: user rejected the moving-mouth effect.
- Demo buttons sign into shared demo accounts via a server-issued one-time magic-link token (src/lib/demo/demo.functions.ts); the accounts are created pre-confirmed. Why: instant access without turning off email confirmation for real users.
- Twin answers run through answerTwin in src/lib/twin/twin.server.ts (takes a Supabase client); askTwin and the Linq text webhook (/api/linq/webhook) both call it. Why: one answer pipeline for web and SMS.
- Twin draft validation and setup progression live in src/lib/twin/setup.ts; uploads are optional, but consent and review remain required. Why: demo setup must work without files without bypassing clinical approval.
- Resources use bundled src/lib/resources.json and public nested routes; question links preserve q through login and send once after the twin loads. Why: guides stay accessible without exposing protected chat calls.
- The homepage introduction uses a user-started, fast-start H.264/AAC video with a CDN asset pointer, matching poster, metadata preload and cancellable loading/retry states. Why: preserve sound-on-click while keeping mobile transfers small and playback failures recoverable.
- Linq webhook parsing normalizes both documented message formats before processing; only unique-key conflicts count as duplicate deliveries. Why: older subscriptions and storage failures must not silently discard incoming texts.
- All Linq replies use sendLinqText with the message.parts envelope and checked HTTP results. Why: normal, booking, safety, and error replies must use Linq's required send format.
