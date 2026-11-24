# Zeni, the virtual concierge

Zeni is the public website's virtual concierge for Zion Events Place. Since 25 November 2026 it follows the team's ZENTRA plan (`ZENTRA_MASTER_PROMPT.md`, sections 0.4 and 17 and Appendix B), adapted to this codebase: there are no client accounts, and nothing runs outside the application.

Zeni is **LLM-assisted information retrieval**. Server code routes each message, collects explicit details, retrieves Zion's published sources and checks the admin calendar. A language model (Google Gemini, free tier) may then phrase the reply from those sources only. Every reply has a deterministic fallback, so Zeni keeps working without the model.

Zeni never reserves a date, creates or changes a booking, takes payment or confirms anything. It opens pre-filled pages instead, and staff confirm every booking.

## Pipeline for each message

| Step              | Where                                                                | What happens                                                                                                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Request guard     | `app/api/client/chatbot/route.ts`, `lib/chatbot/request.ts`          | Same-origin check, 8 KiB body and 600-character message limits, strict schema, process-local budget (120 requests/minute), `no-store` responses.                                                                                                             |
| Session           | `services/chatbot/state-store.ts`, `lib/chatbot/session-security.ts` | Opaque HttpOnly, SameSite=Strict cookie (`__Host-` and Secure in production). Visitors never choose a conversation ID. State is AES-256-GCM encrypted and expires after 24 hours.                                                                            |
| Language          | `lib/chatbot/language.ts`                                            | A word-list heuristic labels the message English, Filipino or Taglish. Messages without markers keep the previous language. Filipino and Taglish share the Taglish templates in `config/chatbot-receptionist.ts`.                                            |
| Routing and slots | `lib/chatbot/intent.ts`, `lib/chatbot/slots.ts`                      | Intents (information, packages, pricing, policy, availability, booking, visit, staff, complaint, reschedule, cancel, small talk, scope and safety). Dates (ISO, "Oct 9", "Oktubre 9", "tomorrow", "next Saturday", Asia/Manila), time windows, guest counts. |
| Plan              | `lib/chatbot/receptionist.ts`                                        | A pure, testable plan: the reply, optional cards and links, an optional effect (calendar check or consented staff hand-off), an optional request to compose with the model, and an optional unanswered-question record.                                      |
| Retrieval         | `lib/chatbot/retrieval.ts`, `services/chatbot/sources.ts`            | Keyword retrieval with English and Filipino synonyms over published sources only (see below). Names, emails and references are removed from the question before searching.                                                                                   |
| Effects           | `services/chatbot/receptionist.ts`                                   | Read-only calendar check and the calendar card (`services/orchestration/receptionist-calendar.ts`); the staff hand-off inquiry after explicit consent (`services/chatbot/escalation.ts`).                                                                    |
| Model (optional)  | `services/chatbot/gemini.ts`, `lib/chatbot/llm-prompt.ts`            | For grounded answers and small talk only. Redacted input, strict instructions (`ZENI_SYSTEM_INSTRUCTIONS`, versioned), JSON output `{answer, covered}`.                                                                                                      |
| Output validation | `lib/chatbot/llm-validation.ts`                                      | Rejects empty or long text (over 700 characters), web addresses, site paths other than public pages, contact details, amounts or numbers not found in the sources, spelled-out amounts, placeholders and booking or availability claims.                     |
| Unanswered log    | `services/chatbot/gaps.ts`                                           | Redacted questions with no source, a source conflict, a model "not covered" answer, or a staff request right after a question. Logged once per conversation.                                                                                                 |

If the model is off, over its limit, slow, blocked, malformed or rejected by validation, Zeni sends the deterministic answer: the published excerpt, its sources and the same buttons. Questions that no published source covers get an honest "I don't have that yet" and a staff offer; they are not sent to the model.

## Language model configuration (server only)

| Variable           | Default                 | Meaning                                                                                                                                  |
| ------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`   | none                    | Google AI Studio key. Without it Zeni uses deterministic answers only. Never prefix it with `NEXT_PUBLIC_`; it is never logged or shown. |
| `GEMINI_MODEL`     | `gemini-3.5-flash-lite` | Model code for `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` (header `x-goog-api-key`).         |
| `ZENI_LLM_ENABLED` | on when a key exists    | `false`, `0`, `off` or `no` turns the model off without removing the key.                                                                |

The default model was chosen from Google's model list on 25 November 2026: `gemini-3.5-flash-lite` is a stable free-tier model, recommended there for new projects, and the deprecated `gemini-2.5-flash` routes to it from 1 December 2026. `gemini-3.6-flash` is a stable free-tier alternative if answers need more nuance. Confirm the current list and free limits in Google AI Studio before launch.

Limits (`config/chatbot-llm.ts`): 8-second timeout per attempt, at most one retry (network errors, timeouts and HTTP 5xx only) within a 12-second budget, 512 output tokens, safety thresholds `BLOCK_MEDIUM_AND_ABOVE`. An in-memory guard allows 8 calls per minute and 200 per rolling day **per server process**, and pauses for the `Retry-After` time (default 60 seconds) after HTTP 429. It is not a distributed quota: several instances each keep their own counters.

## Privacy: what may reach the model

Google's free tier may use prompts and responses to improve its products, so **no personal data is sent to the model**:

- Before any model call, `lib/chatbot/redaction.ts` replaces email addresses, Philippine mobile and landline numbers, long digit sequences (card or account numbers), booking and inquiry references, street addresses (house numbers with street names, Blk/Lot, barangay, purok, sitio, subdivisions) and names with placeholders such as `[email]` or `[name]`. Names are recognized when the guest introduces them ("my name is…", "I'm…", "ako po si…", "pangalan ko ay…") or when Zeni collected them for a staff hand-off.
- A request contains only: the versioned instructions, up to four public source excerpts, the redacted current question and at most the **last three redacted messages**. Redaction runs again inside `prepareComposeInput` as a second safeguard.
- Hand-off details (name, email, phone), calendar results and booking references never go to the model. Messages with passwords, card numbers or identity documents are answered with a privacy notice and are not stored or sent.
- Limits: redaction is a pattern guard, not universal personal-data detection. A name mentioned without an introduction ("my daughter Ana") or written in lowercase after "I'm" can pass through. The "How Zeni works" panel asks visitors not to share personal details and explains the model use.

## Published knowledge

- Location, email and visiting hours share `config/brand.ts`. Policies and terms use the public pages' configuration.
- Facility descriptions and photos share `config/public-facilities.ts`; event descriptions and photos share `config/event-package-pages.ts` (eligible only while packages are visible).
- FAQs use the currently published, visible, effective version in an active visible category. Hidden, archived, draft, future and expired versions are excluded. Until managed FAQs exist, the FAQ page's built-in answers are used.
- Package facts come only from `package_versions.snapshot_data` at `current_version` for active, visible packages and categories. Card prices ("Starts at …") come only from such a published version; the built-in package summaries in `config/chatbot.ts` never show a price on a card.
- The admin venue policy contributes one plain-language payment requirement only after a super administrator marks it reviewed. Unreviewed policy, cash instructions, contract text and staff identity are excluded.
- Conflicting published facts (FAQ answers, capacity figures, payment methods, deposit rules) are not resolved by Zeni: it offers staff and logs the question as a conflict. Developer documents are not public knowledge.

## Cards, buttons and links

- **Detail cards**: facility, published package or event page, with a photo from `public/images`, a short description, a "Starts at" price only from a published package version, and a link to the page.
- **Availability calendar card**: a month view for today plus about 60 days (Manila). Dates with any `CONFIRMED` admin-calendar event are marked booked, in text as well as color. Dates only: no event, client, payment or note is exposed. Choosing an open date runs the calendar check.
- **Calendar check** (`receptionist-calendar.ts`): a date with a time window checks that window; a date alone checks the whole Manila day. Venue names are aliases of the one exclusive venue resource. A result is a timestamped snapshot, valid for five minutes, and never a hold.
- **Links** built by the server: "Book this date" / "Open the booking form" → `/booking?…&source=zeni`; "Schedule an ocular visit" → `/contact?topic=visit&date=…&source=zeni#message-us`; source links to the public page. "Talk to staff" starts the hand-off.
- **Suggested replies**: short, language-aware chips such as "Check a date", "Wedding packages" and "Schedule a visit".

### Pre-filled link contract

| Page       | Parameters                                                                                                                                                                                                                                                    | Parser                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `/booking` | `event` (wedding, debut, birthday, christening, christmas-party, gender-reveal), `package` (classic, signature, grand, custom), `date` (YYYY-MM-DD, today to three years ahead), `start` and `end` (HH:MM, start before end), `guests` (1–500), `source=zeni` | `app/booking/_components/bookingPrefill.ts` |
| `/contact` | `topic=visit`, `date` (YYYY-MM-DD, today to one year ahead), `source=zeni`                                                                                                                                                                                    | `app/contact/_components/visitPrefill.ts`   |

Each value is validated on its own with zod; anything missing or invalid is ignored. The booking journey has no time fields, so a time window is added to its notes. Values apply after hydration, and the visitor can change all of them. Zeni builds these links in `lib/chatbot/links.ts`; package names map only on exact tier words.

## Staff hand-off

"Talk to staff", complaints, special requests, reschedules and cancellations collect a name and an email (and keep a phone number if given), then ask for explicit consent. Only then does one standard `NEW` inquiry with source `zeni_receptionist`, an activity and a notification commit, together with the automation outbox jobs for the staff alert and the visitor acknowledgement (`lib/automation`). Retrying the same turn creates no duplicate. The summary for staff contains the redacted request, event details, any booking reference the visitor gave and the last calendar check; it never says a booking exists. An inquiry is not a reservation.

## Session, storage and retry contract

`GET /api/client/chatbot` returns this browser's saved summary and any interrupted command; `POST` sends a turn; `DELETE` forgets the saved details (it does not cancel bookings or inquiries).

`prisma/receptionist.sql` is additive and idempotent:

- `zion_receptionist_conversations`: encrypted envelopes. The key is derived (HKDF, purpose-separated) from server-only `RECEPTIONIST_STATE_KEY`, or an at-least-32-byte `AUTH_SECRET`. Changing the key makes saved conversations unreadable. Expired rows are purged when new conversations start.
- `zion_zeni_gaps`: unanswered questions (redacted text up to 300 characters, a grouping hash, topic, language, reason `no_source` / `low_confidence` / `handoff` / `conflict`, `created_at`, `resolved_at`, `resolved_by`). Rows older than 180 days are deleted when new ones are written.
- RLS is enabled on both tables and all `anon` / `authenticated` grants are revoked. Writes use a separate `pg` pool that bypasses Prisma's development query logger.
- The earlier `zion_receptionist_requests` booking ledger is no longer created or used. Existing copies are untouched and can be dropped after review.

Saved state holds explicit facts, at most three redacted exchanges, logged-question hashes and up to ten reply receipts for idempotent retries. Conversations saved before this version still load: removed fields are ignored and retired statuses fall back to neutral values. Each turn uses a revision check and a durable lease; an interrupted turn can be retried with its original ID. A replayed calendar result older than five minutes is replaced by a request to check again.

## Interface

`components/chatbot/` follows the Figma frame "ZENI CHATBOT LOOK LIKE": a white circular launcher with a thin deep-green ring and the ZENTRA "Z" monogram (accessible name "Chat with Zeni…"); a white panel with a thin green frame (about 400 × 640 px above the launcher on desktop, a full-height sheet with safe areas on phones and short windows); a header with the Z avatar, "ZENI", "Virtual concierge · Zion Events Place", a "How Zeni works" panel, "New conversation" and close; mist Zeni bubbles and deep-green guest bubbles; a typing indicator; cards; outlined and filled green buttons; and a rounded input with a green send button.

The panel is a native modal `<dialog>`: focus moves to the title, Tab stays inside, Escape closes the info panel or the dialog and focus returns to the launcher. The message list is `role="log"` with `aria-live="polite"`. Controls are at least 44 px, text at least 12 px, focus is visible and status never relies on color alone. Motion uses the shared tokens (320 ms panel transition, 180 ms message entry, a 40 ms button stagger); with reduced motion everything is static. Colors come from the `--chat-*` tokens in `styles/tokens.css`, which alias the ZENTRA palette; the CSS Module swaps them for the dark theme.

## Admin tools

`/admin/zeni` (`app/admin/(panel)/zeni/page.tsx`, `components/admin/ZeniPanel.tsx`, API `app/api/admin/zeni/route.ts`) is available to SUPERADMIN and ADMIN accounts. It shows the model status (key configured, model, on or off, this process's usage), the knowledge in use with counts, last-updated times and where staff edit it, unanswered questions grouped by wording with "Mark resolved" (audited), hand-off counts, and an "Ask Zeni" test console that runs one question in preview mode: nothing is stored, no inquiry is sent and nothing is logged as unanswered. The route uses the admin session, same-origin mutation checks, zod validation and a 20-per-minute test budget.

## Provisioning and verification

```powershell
npm run db:receptionist:check
node scripts/install-receptionist-schema.mjs --apply
npm run test:chatbot
npm run verify
node scripts/preview-chatbot.mjs
```

The installer checks by default. `--apply` creates only missing Zeni tables, then verifies their columns and row security; a remote database also needs `--allow-remote` after explicit approval. On Supabase, the same file can be run in the SQL editor.

The preview uses a disposable in-memory PostgreSQL on loopback port 3013 with demonstration data (one package and one confirmed event two weeks ahead). The model, email and other outbound services are switched off; stopping it discards everything.

Tests cover language detection, redaction, prompt contents, output validation, the Gemini client with a mocked `fetch` (success, timeout and retry, 5xx retry, 429 cooldown, disabled settings), the rate guard, routing and slots, booking and visit links and their parsers, the calendar projection, the HTTP handler against PGlite (publication rules, isolation, encryption, hand-off with outbox jobs, calendar cards, the unanswered log and its resolution, preview mode, the admin overview, recovery, expiry and failures). Real-browser, screen-reader and real-device checks, Filipino and Taglish quality review by native speakers, and evaluation of the model's answers are not established by these tests.
