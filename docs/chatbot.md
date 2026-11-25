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

If the model is off, over its limit, slow, blocked, malformed or rejected by validation, Zeni sends the deterministic answer: the published excerpt, its sources and the same buttons. Questions that no published source covers get an honest "I don't have that yet", the topic chips and a staff offer; they are not sent to the model.

### Answering before handing off (25 November 2026)

Zion's official chatbot knowledge base ("zion info") and FAQ define six help topics, kept in `config/zeni-topics.ts`: Payments & booking, Food & catering, Venue & setup, Planning & styling, Suppliers & corkage, and Changes & contacts. Each topic has keywords, a summary, follow-up questions and the contact for what Zeni cannot handle (payments, pricing and SOA: Sir Tim Soriano or the Zion Facebook page; planning: the Head Coordinator or the Zion group chat).

- **Welcome and chips:** the welcome offers the six topics and "Check a date". Tapping a topic, or sending only a topic's umbrella word ("payment", "food", "corkage"), shows that topic's summary with its follow-up questions and an "All FAQs" link.
- **Short questions are answered:** a short or unclear message ("lechon", "do kids eat free?") is searched like any question; Zeni asks what the guest is looking for only when nothing official covers it.
- **Payments:** payment questions are answered from the official FAQ with a **Talk to staff** button. Because the older built-in list of payment methods ("Cash, Check, Card…") disagrees with other information, it is never quoted; asking which methods are accepted gives the official payment schedule, points to Sir Tim Soriano or the Zion Facebook page and logs the question as a conflict for staff.
- **Changes:** "Can we reschedule?" or "What if we cancel?" is answered from the FAQ with a staff button; "please move my booking" still starts the staff hand-off.
- **Ties:** among equally good matches, Zeni prefers a source whose title covers the question, then a direct FAQ answer over a long policy section, then the most specific title. Staff-managed FAQs come before the official FAQ, and the older built-in list comes last.
- **No repeats:** answers end with one of three closing lines in turn, an answer given earlier in the conversation opens with "Same as before:", and follow-up chips never lead back to the answer just given.

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
- FAQs use the currently published, visible, effective version in an active visible category. Hidden, archived, draft, future and expired versions are excluded. Until managed FAQs exist, the built-in answers in `config/public-faqs.ts` (`publicFaqs`) are used.
- Zion's official FAQ is always included while FAQs are visible (`lib/chatbot/faq-sources.ts`): the /faq page entries (`faqPageEntries`) plus Zeni-only follow-up questions from the same documents (`zeniExtraFaqs`), except a question a managed or built-in FAQ already answers. Each entry keeps the official wording for /faq and the casual wording Zion approved for the chatbot (`chatAnswer`), which Zeni uses, plus its help topic. The admin Zeni page counts these answers too.
- Package facts come only from `package_versions.snapshot_data` at `current_version` for active, visible packages and categories. Card prices ("Starts at …") come only from such a published version; the built-in package summaries in `config/chatbot.ts` never show a price on a card.
- The admin venue policy contributes one plain-language payment requirement only after a super administrator marks it reviewed. Unreviewed policy, cash instructions, contract text and staff identity are excluded.
- Conflicting published facts (FAQ answers, capacity figures, payment methods, deposit rules) are not resolved by Zeni: it gives only what is consistent, offers staff and logs the question as a conflict. Developer documents are not public knowledge.

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

When a staff member is available, "Talk to staff" opens a live chat first (next section). Otherwise "Talk to staff", complaints, special requests, and requests to reschedule or cancel a booking (questions about those rules are answered from the FAQ first) collect a name and an email (and keep a phone number if given), then ask for explicit consent. Only then does one standard `NEW` inquiry with source `zeni_receptionist`, an activity and a notification commit, together with the automation outbox jobs for the staff alert and the visitor acknowledgement (`lib/automation`). Retrying the same turn creates no duplicate. The summary for staff contains the redacted request, event details, any booking reference the visitor gave and the last calendar check; it never says a booking exists. An inquiry is not a reservation.

### Live chat with staff

When the visitor asks for a person ("Talk to staff", or a message with the `human` intent) and at least one staff member is available, Zeni puts the conversation in the live chat queue instead of starting the email hand-off (`services/chatbot/receptionist.ts`, `services/chatbot/live-chat.ts`). The visitor stays in the same Zeni window:

- **Waiting.** Zeni says a real person will reply in this chat. A banner under the header shows "Waiting for our staff to join…" (or how many visitors are ahead) with an **End chat** button, the text field becomes "Message our staff", and messages typed while waiting are kept for staff.
- **With staff.** A staff member takes the chat on `/admin/live-chat`. The visitor sees "<first name> from Zion Events Place joined the chat." and replies labelled "<first name> · Zion staff". Only the staff member's first name is shared.
- **Back to Zeni.** Staff choose **Return to Zeni** or **Close chat** when everything is settled, or the visitor chooses **End chat**; an active chat with no message for 20 minutes also returns. A note says Zeni is back, and Zeni answers again in the same window.
- **Nobody answers.** A chat nobody takes within 5 minutes is marked missed and the visitor is offered **Leave a message for our team**, which runs the email hand-off above. Asking again within 15 minutes of a missed chat goes straight to that hand-off. When nobody is available, Zeni says so and offers the email hand-off at once.

Staff count as available while their switch on `/admin/live-chat` is on and an admin page has checked in within 90 seconds; every admin page checks every 15 seconds through the sidebar badge. Staff see a short summary of what the visitor told Zeni (goal, event, dates, time, guests, package, venue, last question, concerns), never the full Zeni transcript, which stays in Zeni's encrypted memory.

`GET`/`POST`/`DELETE /api/client/chatbot/live` reads, sends to or ends the visitor's chat, found through the Zeni session cookie. Sending needs the website origin, at most 12 messages a minute and 600 characters each; text is kept plain (control characters removed, never rendered as HTML). `GET`/`POST /api/admin/live-chat` (admin session, same-origin mutations, zod validation) serves the inbox: a chat can be taken once, and only the staff member who took it can reply or finish it. The visitor window polls every 3 seconds while a chat is open and the tab is visible; the inbox refreshes every 5 seconds.

`prisma/live-chat.sql` is additive and idempotent: `zion_live_chats` (status `WAITING`, `ACTIVE`, `RETURNED`, `CLOSED` or `MISSED`; at most one open chat per conversation), `zion_live_chat_messages` and `zion_live_chat_staff`, with RLS enabled and `anon` / `authenticated` grants revoked.

## Session, storage and retry contract

`GET /api/client/chatbot` returns this browser's saved summary and any interrupted command; `POST` sends a turn; `DELETE` forgets the saved details (it does not cancel bookings or inquiries).

`prisma/receptionist.sql` is additive and idempotent:

- `zion_receptionist_conversations`: encrypted envelopes. The key is derived (HKDF, purpose-separated) from server-only `RECEPTIONIST_STATE_KEY`, or an at-least-32-byte `AUTH_SECRET`. Changing the key makes saved conversations unreadable. Expired rows are purged when new conversations start.
- `zion_zeni_gaps`: unanswered questions (redacted text up to 300 characters, a grouping hash, topic, language, reason `no_source` / `low_confidence` / `handoff` / `conflict`, `created_at`, `resolved_at`, `resolved_by`). Rows older than 180 days are deleted when new ones are written.
- RLS is enabled on both tables and all `anon` / `authenticated` grants are revoked. Writes use a separate `pg` pool that bypasses Prisma's development query logger.
- The earlier `zion_receptionist_requests` booking ledger is no longer created or used. Existing copies are untouched and can be dropped after review.

Saved state holds explicit facts, at most three redacted exchanges, logged-question hashes and up to ten reply receipts for idempotent retries. Conversations saved before this version still load: removed fields are ignored and retired statuses fall back to neutral values. Each turn uses a revision check and a durable lease; an interrupted turn can be retried with its original ID. A replayed calendar result older than five minutes is replaced by a request to check again.

## Interface

`components/chatbot/` is plain on purpose (user feedback, 25 November 2026: it should look made by a person, not "AI"): a solid deep-green circular launcher with the ZENTRA "Z" (accessible name "Chat with Zeni…"); a flat white panel with a hairline border above the launcher on desktop (a full-height sheet with safe areas on phones and short windows); a plain header with the Z avatar, "Zeni", "Zion Events Place", a "How Zeni works" panel, "New conversation" and close; simple rectangular bubbles with deep-green guest bubbles; static "Zeni is typing…" text; cards; outlined and filled green buttons; and a labelled text field with a green send button. During a live chat a status banner with **End chat** sits under the header, staff replies are outlined and labelled with the staff member's first name, and status notes are small centered text.

The panel is a native modal `<dialog>`: focus moves to the title, Tab stays inside, Escape closes the info panel or the dialog and focus returns to the launcher. The message list is `role="log"` with `aria-live="polite"`. Controls are at least 44 px, text at least 12 px, focus is visible and status never relies on color alone. The only motion is a short fade when the panel opens or closes and color changes on hover (`--motion-fast`); with reduced motion they are removed. Colors come from the `--chat-*` tokens in `styles/tokens.css`, which alias the ZENTRA palette; the CSS Module swaps them for the dark theme.

## Admin tools

`/admin/zeni` (`app/admin/(panel)/zeni/page.tsx`, `components/admin/ZeniPanel.tsx`, API `app/api/admin/zeni/route.ts`) is available to SUPERADMIN and ADMIN accounts. It shows the model status (key configured, model, on or off, this process's usage), the knowledge in use with counts, last-updated times and where staff edit it, unanswered questions grouped by wording with "Mark resolved" (audited), hand-off counts, and an "Ask Zeni" test console that runs one question in preview mode: nothing is stored, no inquiry is sent and nothing is logged as unanswered. The route uses the admin session, same-origin mutation checks, zod validation and a 20-per-minute test budget.

## Provisioning and verification

```powershell
npm run db:receptionist:check
node scripts/install-receptionist-schema.mjs --apply
npm run db:live-chat:check
npm run db:live-chat:check -- --apply
npm run test:chatbot
npm run verify
node scripts/preview-chatbot.mjs
```

Both installers check by default. `--apply` creates only missing tables (Zeni's, or the live chat tables), then verifies them and their row security; a remote database also needs `--allow-remote` after explicit approval. On Supabase, the same file can be run in the SQL editor.

The preview uses a disposable in-memory PostgreSQL on loopback port 3013 with demonstration data (one package and one confirmed event two weeks ahead). The model, email and other outbound services are switched off; stopping it discards everything.

Tests cover language detection, redaction, prompt contents, output validation, the Gemini client with a mocked `fetch` (success, timeout and retry, 5xx retry, 429 cooldown, disabled settings), the rate guard, routing and slots, booking and visit links and their parsers, the calendar projection, the HTTP handler against PGlite (publication rules, isolation, encryption, hand-off with outbox jobs, calendar cards, the unanswered log and its resolution, preview mode, the admin overview, recovery, expiry and failures). Real-browser, screen-reader and real-device checks, Filipino and Taglish quality review by native speakers, and evaluation of the model's answers are not established by these tests.
