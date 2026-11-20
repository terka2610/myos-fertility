# Redesign MYO'S around the doctor's digital twin

The whole site gets your landing page's look and tells one story: **your doctor's digital twin, there for you 24/7, in your language.**

## Look and feel (from your landing page)
- Cream background, deep plum text, pink and soft gold cards, one berry accent for highlighted words.
- Big elegant serif headlines (Instrument Serif) with italic berry words; clean Poppins for everything else.
- Large rounded cards, round dark arrow buttons, soft pink and gold blobs in the background.
- Every page uses it: home, sign-in, patient pages, provider setup, twin conversation, admin.

Note: the written brief asked for a dark burgundy theme. I'm following your landing page (light cream) because you asked for it. Tell me if you want a dark version for the twin conversation only.

## Home page
- Headline in your style, e.g. "Your doctor, *24/7, in your language*".
- A large doctor-twin portrait in the hero, gently animated (blinking, slight movement), labelled "AI-generated demo".
- A small language row ("English · Español · Français · Deutsch · 中文 · العربية …") showing the twin answers in any language.
- Your two big cards: **I'm a patient** (pink) and **I'm a provider** (gold), plus Log in.
- "How it works" with the patients / providers switch, then "Ready to get started?" in pink.

## 24/7 in every language (it really works)
- The patient picks a language (or the twin detects the language of the question).
- The twin answers in that language, still only from the doctor's documents, with sources shown.
- It speaks in that language: the doctor's own voice when a voice key is connected, otherwise the browser's voice for that language.
- Voice questions are heard in the chosen language.
- Safety rules still apply in every language: dosing, missed doses, results and worrying symptoms go to the care team.

## Patient journey
1. "Meet your fertility specialists": cards with photo, clinic, languages, PCOS / endometriosis / queer and trans / single women answers, and a "Meet their digital twin" button. Includes 3 clearly labelled demo doctors.
2. A short survey (already built) that adapts how the twin speaks.
3. The twin page: the doctor's face in the centre, talking, with "Ask a question" and "Book a real consultation" (opens a request form to the clinic). Always shows "AI twin of Dr …, not a live consultation".

## Provider journey ("Create your digital twin")
Profile → Headshots → Voice → Knowledge base → Preview → Submit.
- Already working: identity, photos with a mouth marker, voice recording or upload, PDF/text upload, consent.
- Added: a live preview of the patient profile, a preview where the twin answers a sample question from the uploaded documents, a document library with status, and Draft / Awaiting review / Published.
- Uploaded photos, voice samples and documents are saved securely so the provider can come back to them.

## Admin
A simple review page: approve documents and publish twins. Patients only see published twins.

## What stays the same
Sign-in, roles, the safety rules, the nurse review list, and the existing fertility consultation pages (restyled).

## Order
1. New look across the site + new home page.
2. Languages (answers, voice, voice input).
3. Specialist list with demo doctors and the twin page.
4. Provider preview, saved uploads, review statuses, admin approval.
5. End-to-end check as a patient in two languages and as a provider.

## Not included now
- A pre-recorded video of a real-looking avatar: I'll use the animated photo instead unless you send a video.
- Cloned doctor voices need your ElevenLabs key; I'll ask for it in a secure form when ready.

## Technical details
- Tokens in src/styles.css: background #FFF9F4, foreground #2A0E1A, primary #2A0E1A, accent #A13D6B, pink #E8A9C6, gold #F0D27A, muted text #5E4752; fonts via link in __root.
- Language: add `language` to twin_patients and a per-request override; system prompt says "answer in {language}"; escalation phrase translated by the model is not used — fixed translations for the care-team message in the top languages plus English fallback. SpeechSynthesis/SpeechRecognition `lang` set from the choice. Escalation rules gain a model-side check (structured `needs_care_team` flag) so non-English dosing questions are still caught.
- Storage bucket `twin-media` (private, owner-scoped policies) for photos, voice and source documents; `status` column on twin_doctors (draft/review/published) and twin_documents table with approval state; patient reads filter to published.
- Admin approval uses existing has_role(admin).
