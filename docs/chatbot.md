# Zeni, the virtual concierge

Zeni is the public website's virtual concierge for Zion Events Place. Since 25 November 2026 it follows the team's ZENTRA plan (`ZENTRA_MASTER_PROMPT.md`, sections 0.4 and 17 and Appendix B), adapted to this codebase: there are no client accounts, and nothing runs outside the application.

Zeni is **LLM-assisted information retrieval**. Server code routes each message, collects explicit details, retrieves Zion's published sources and checks the admin calendar. A language model (Google Gemini, free tier) then writes the reply from the published sources that match the question, and may add general event-planning advice that is labelled as such. Every reply has a deterministic answer underneath (**backup mode**: keyword matching), so Zeni keeps working without the model.

Zeni never reserves a date, creates or changes a booking, takes payment or confirms anything. It opens pre-filled pages instead, and staff confirm every booking.

## Pipeline for each message

| Step              | Where                                                                | What happens                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request guard     | `app/api/client/chatbot/route.ts`, `lib/chatbot/request.ts`          | Same-origin check, 8 KiB body and 600-character message limits, strict schema, process-local budget (120 requests/minute), `no-store` responses.                                                                                                                                                                                                                                                              |
| Session           | `services/chatbot/state-store.ts`, `lib/chatbot/session-security.ts` | Opaque HttpOnly, SameSite=Strict cookie (`__Host-` and Secure in production). Visitors never choose a conversation ID. State is AES-256-GCM encrypted and expires after 24 hours.                                                                                                                                                                                                                             |
| Language          | `lib/chatbot/language.ts`                                            | A word-list heuristic labels the message English, Filipino or Taglish. Messages without markers keep the previous language. Filipino and Taglish share the Taglish templates in `config/chatbot-receptionist.ts`.                                                                                                                                                                                             |
| Routing and slots | `lib/chatbot/intent.ts`, `lib/chatbot/slots.ts`                      | Intents (information, packages, pricing, policy, availability, booking, visit, staff, complaint, reschedule, cancel, small talk, scope and safety). Dates (ISO, "Oct 9", "Oktubre 9", "tomorrow", "next Saturday", Asia/Manila), time windows, guest counts. The calendar, booking form, visit page and staff hand-off are routes only when the visitor asks for them (see "Routing and search check" below). |
| Plan              | `lib/chatbot/receptionist.ts`                                        | A pure, testable plan: the reply, optional cards and links, an optional effect (calendar check or consented staff hand-off), an optional request to compose with the model, and an optional unanswered-question record.                                                                                                                                                                                       |
| Retrieval         | `lib/chatbot/retrieval.ts`, `services/chatbot/sources.ts`            | Keyword retrieval with English and Filipino synonyms over published sources only (see below), weighted by how rare each word is, with the lines of a long source that answer the question. Names, emails and references are removed from the question before searching.                                                                                                                                       |
| Effects           | `services/chatbot/receptionist.ts`                                   | Read-only calendar check and the calendar card (`services/orchestration/receptionist-calendar.ts`); the staff hand-off inquiry after explicit consent (`services/chatbot/escalation.ts`).                                                                                                                                                                                                                     |
| Model (optional)  | `services/chatbot/gemini.ts`, `lib/chatbot/llm-prompt.ts`            | For information questions and small talk (at most one call and one retry per message). Redacted input, strict instructions (`ZENI_SYSTEM_INSTRUCTIONS`, versioned), JSON output `{zion, general, covered, aboutZion, used}`: Zion's facts and general advice are kept apart (see "AI-written answers" below).                                                                                                 |
| Output validation | `lib/chatbot/llm-validation.ts`                                      | The Zion part: rejects empty or long text (over 700 characters), web addresses, site paths other than public pages, contact details, amounts or numbers not found in the sources, spelled-out amounts, placeholders and booking or availability claims. The general advice: no amounts of money, links, contact details, booking claims or sentences about Zion (600 characters at most).                     |
| Unanswered log    | `services/chatbot/gaps.ts`                                           | Redacted questions with no source, a source conflict, a model "not covered" answer, or a staff request right after a question. Logged once per conversation, grouped by their key words and labelled with a topic (`lib/chatbot/topics.ts`).                                                                                                                                                                  |

If the model is off, over its limit, slow, blocked, malformed or rejected by validation, Zeni is in **backup mode** and sends the deterministic answer: the published excerpt, its sources and the same buttons. Questions that no published source covers on its own get an honest "I don't have that yet", the topic chips and a staff offer in backup mode; with the model on they are sent to it (redacted) with the related published sources, so it can answer from them or give general advice.

### Answering before handing off (25 November 2026)

Zion's official chatbot knowledge base ("zion info") and FAQ define six help topics, kept in `config/zeni-topics.ts`: Payments & booking, Food & catering, Venue & setup, Planning & styling, Suppliers & corkage, and Changes & contacts. Each topic has keywords, a summary, follow-up questions and the contact for what Zeni cannot handle (payments, pricing and SOA: Sir Tim Soriano or the Zion Facebook page; planning: the Head Coordinator or the Zion group chat).

- **Welcome and chips:** the welcome offers the six topics and "Check a date". Tapping a topic, or sending only a topic's umbrella word ("payment", "food", "corkage"), shows that topic's summary with its follow-up questions and an "All FAQs" link.
- **Short questions are answered:** a short or unclear message ("lechon", "do kids eat free?") is searched like any question; Zeni asks what the guest is looking for only when nothing official covers it.
- **Payments:** payment questions are answered from the official FAQ with a **Talk to staff** button. Which methods are accepted ("Ano ang mode of payment?", "Do you accept GCash?") is answered from what the booking system offers now (`lib/chatbot/payment-methods.ts`, 27 November 2026): cash at the venue always, GCash and bank transfer while their account is set up in Settings > Online payments, and how the payment page takes them. The older built-in list ("Cash, Check, Card…") disagrees with other information and is never quoted; only if Settings cannot be read does the question get the payment schedule, Sir Tim Soriano or the Zion Facebook page, and a conflict log entry.
- **ZENTRA:** "What is ZENTRA?" is answered from a website source: the website and booking system of Zion Events Place, and what a guest can do on it.
- **Changes:** "Can we reschedule?" or "What if we cancel?" is answered from the FAQ with a staff button; "please move my booking" still starts the staff hand-off.
- **Ties:** among equally good matches, Zeni prefers a source whose title covers the question, then a direct FAQ answer over a long policy section, then the most specific title. Staff-managed FAQs come before the official FAQ, and the older built-in list comes last.
- **No repeats:** answers end with one of three closing lines in turn, an answer given earlier in the conversation opens with "Same as before:", and follow-up chips never lead back to the answer just given.

### Routing and search check (27 November 2026)

A bank of 7,113 real client questions in English and Tagalog (`outputs/zion-client-questions.csv`, git-ignored; re-run steps in `outputs/zion-client-questions-build/README.txt`) showed Zeni opening the calendar or booking form for questions that only mentioned a date or a booking, handing off to staff whenever a message said "staff", and answering 6% of English and 3% of Tagalog questions. The rules now work like this:

- **Calendar:** only for a date or the venue being free ("Is December 12 available?", "Available pa po ba ito?", "Are you still accepting bookings?"). "Available", "free" or "open" about a thing ("What food is available?", "Is parking free?") is an information question, and "bukas" before "po ba kayo" means open, not tomorrow.
- **Booking form:** only for starting a booking ("I want to book", "Paano po mag-book?", "Can we book a date in 2028?"). A question that mentions a booking ("What happens after we book?", "Is my booking confirmed?", "guest book", "book a Grab", "book a supplier") is searched instead.
- **Visit page:** for arranging a visit, not for a question that only mentions one ("Can we pay during our ocular?").
- **Staff hand-off:** for reaching a person ("Please connect me to staff", "Is there a human I can chat with?", "Paki-connect po ako sa staff", "Can I talk to Sir Tim?"), someone hurt at the venue, or two answers that disagree. A question about staff ("Can your staff help elderly guests?") is searched. Thanks after an event gets thanks.
- **Search:** rare words count more than common ones. A source must cover most of the question and be about its most specific word: that word is in its title or tags, or (for a policy, booklet or page, never an FAQ) one line holds it with most of the question. A longer question must also match its second most specific word, an FAQ must answer the question it is about, "how much" (but not "how much food") is answered only by a source with an amount, a question naming a package ("Zion Classic") is answered from that package, and only a question about the packages themselves ("Wedding packages", "How much is the Classic package?") is limited to package sources: "Are meals for suppliers included in the package?" searches everything. English plurals and verb endings, common Tagalog function words and synonyms are normalized the same way for questions and sources.
- **Passages:** a short policy or booklet section is shown as a list (a booklet section under its package and event, because each package differs); a long one shows only its matching lines. FAQ answers stay whole.

Measured with `zeni-eval.ts` (rules and search only, no model, no database): English answers 5.8% → 8.3% of questions, Tagalog 2.9% → 7.5%; questions outside dates and booking that got the calendar or booking form 262 → 113 (English); staff hand-offs outside the contact sections 162 → 62 (English); questions answered in English but not in Tagalog 260 → 211. Hand checks of answers (fit / partly / off topic): before, 20 / 18 / 22 of 60 English; after, 24 / 20 / 16 of 60 English and 16 / 8 / 6 of 30 Tagalog, all from samples not used for tuning. About 82% of questions still have no published answer: that is missing information, which the unanswered log collects for staff.

### AI-written answers, general advice and backup mode (27 November 2026)

With a key configured, the model writes the answer; keyword matching is the **backup mode** that answers whenever the model is off, over its limit, slow, blocked, or its answer fails validation. At most one model call (plus one retry after a network error, timeout or server error) is made per guest message.

- **Facts the model sees** (`candidateSources` in `lib/chatbot/retrieval.ts`): the strict match first, then up to six related published sources (one of the question's two most specific words, or a title sharing a question word). The model can combine them ("no hidden charges" from a booklet with the upgrades FAQ) and says which ones it used (`used`), so the reply's "From" links and photo cards show only those.
- **Two kinds of answers, kept apart** (`ZENI_SYSTEM_INSTRUCTIONS`, version `zeni-instructions-2026-11-27`): `zion` is what Zion offers or requires, from the facts only (amounts and numbers copied, digits or words checked against the sources; no yes or no on waivers, discounts or changes the facts do not state; a rule about one place or item is not applied to another). `general` is general planning advice, only for a general question (themes, program flow, what to prepare, how many tables, timelines), opening with "In general," or "Sa pangkalahatan po,". It never states money, names other venues or businesses, says anything about Zion, or contradicts a Zion rule in the facts. A general question reads the advice first, then Zion's part ("At Zion, …"). "Another venue" means another space or another date at Zion.
- **Checks** (`checkedAnswer` in `services/chatbot/gemini.ts`, `validateGeneralAdvice`): a failing Zion part keeps the backup answer; failing advice is dropped (a sentence about Zion is removed from it). Advice is also dropped when the guest asked about Zion and the facts do not answer it, so Zeni never answers a Zion question with what venues usually do.
- **What the guest sees** (`applyModelAnswer` in `services/chatbot/receptionist.ts`): when no source answered on its own, a covered answer or general advice replaces "I don't have that yet" with an answer, its sources and cards; otherwise the honest backup reply and the staff offer stay.
- **Unanswered log:** a question answered from the facts is not logged. A general planning question answered with advice is not logged, unless it is put to Zion ("you", "your", "dito", "pwede", "Can we…", "allowed"); a question about Zion the facts do not cover is logged as before (`no_source`, or `low_confidence` when the rules had an answer the model found insufficient).
- **Admin:** the AI card reads "Answers: Written by the AI" or "Backup mode", and the test console labels each reply ("Written by the AI from published sources", with "general advice" when added, or "Backup mode: … keyword matching answered").

Measured with `zeni-ai-eval.ts` on a fixed sample of 150 information questions from the question bank (preview mode, `gemini-3.5-flash-lite`). The first version (questions 1–58) answered 32 where the rules answered 4, but 14 of its answers had problems (advice where a Zion rule applied, a fact stretched to another situation, a missed package comparison); the fixes above followed. After them (questions 59–150, 60 English and 32 Tagalog): the rules answered 15 of 92 and the AI 43, or 28 more: 29 from the facts, 5 facts with general advice, 6 general advice, while 51 stayed honestly unanswered and logged and 1 malformed reply fell back to the rules. Hand check of the 40 answers the AI wrote: 19 fit, 12 partly, 5 general advice that fits, 4 problems (a rule stretched to a nearby case, or a plausible statement the facts do not make). The "From" link under each answer lets a guest check its source.

### Unusual and unrelated questions (27 November 2026)

Zeni replies to what the guest actually asked, every time; the topic chips may follow as a next
step but are never the whole reply. "can i bring dinosaur?" used to get only the menu ("Happy to
help! Tap a topic below…"): it matched no rule, and a message under five words that nothing
official covered went straight to the menu, without the model and without the unanswered log.

- **About Zion or the event**: answered from the published sources, as above.
- **Unusual event requests** (asking whether pets or animals, props or costumes, inflatables,
  fireworks, confetti, candles or the guest's own equipment are allowed; `lib/chatbot/unusual.ts`):
  the published sentence that names the item and states a rule is the answer, quoted on its own
  (for example the Terms: "Confetti, glitter … are prohibited unless approved in writing").
  Otherwise Zeni says it does not have that rule yet ("Wala pa po akong hawak na policy tungkol sa
  pagdadala ng alagang hayop…") and offers the team; the question goes to the admin **Unanswered**
  list so staff can add the rule. A question that only mentions an item ("Does the LED wall have
  sound?") is searched as usual; a package inclusion ("fireworks display") is not a rule about
  bringing one; an open-flame rule is not used for LED candles; Zion's own LED wall and generator
  are not outside equipment.
- **Short messages no rule places**: in backup mode "I'm not sure about that one. I can help with
  packages, dates, the venue and bookings, or connect you with our team." with the staff button and
  the topics; logged only when it asks whether something is allowed.
- **The model** answers these messages too (one to three sentences, in the guest's language) and
  says what kind of message it was (`scope`: `zion`, `playful`, `unrelated`, `rude`). A joke gets
  one friendly line and, when it has one, its sensible meaning ("A real dinosaur might not fit in
  our garden! If you mean dinosaur-themed decorations…"). Unrelated questions get one polite
  sentence and what Zeni can help with; rude messages a calm reply that steers back. These replies
  are checked (`validateSideReply`): no numbers, amounts, links, contacts, booking claims or rules,
  and a reply the facts do not cover may not say that anything is allowed or not
  (`claimsUnpublishedRule`). Playful, unrelated and rude messages are not logged as unanswered.
- **Backup mode** keeps the rules above: unrelated keywords (general knowledge, homework, coding,
  news, politics) get the one-sentence decline, and a short list of insults the calm reply.

The examples from the request are in `lib/chatbot/unusual.test.ts` (backup and model modes).
The older built-in FAQ list, used while no staff-managed FAQ exists, says pets are welcome if they
wear diapers; Zeni answers from it while it is in use. Zion should confirm or remove that answer.

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
- A request contains only: the versioned instructions, up to six public source excerpts, the redacted current question and at most the **last three redacted messages**. Redaction runs again inside `prepareComposeInput` as a second safeguard.
- Hand-off details (name, email, phone), calendar results and booking references never go to the model. Messages with passwords, card numbers or identity documents are answered with a privacy notice and are not stored or sent.
- Limits: redaction is a pattern guard, not universal personal-data detection. A name mentioned without an introduction ("my daughter Ana") or written in lowercase after "I'm" can pass through. The "How Zeni works" panel asks visitors not to share personal details and explains the model use.

## Published knowledge

- Location, email and visiting hours share `config/brand.ts`. Policies and terms use the public pages' configuration.
- Facility descriptions and photos share `config/public-facilities.ts`; event descriptions and photos share `config/event-package-pages.ts` (eligible only while packages are visible).
- FAQs use the currently published, visible, effective version in an active visible category. Hidden, archived, draft, future and expired versions are excluded. Until managed FAQs exist, the built-in answers in `config/public-faqs.ts` (`publicFaqs`) are used.
- Zion's official FAQ is always included while FAQs are visible (`lib/chatbot/faq-sources.ts`): the /faq page entries (`faqPageEntries`) plus Zeni-only follow-up questions from the same documents (`zeniExtraFaqs`), except a question a managed or built-in FAQ already answers. Each entry keeps the official wording for /faq and the casual wording Zion approved for the chatbot (`chatAnswer`), which Zeni uses, plus its help topic. The admin Zeni page counts these answers too.
- Package facts come only from `package_versions.snapshot_data` at `current_version` for active, visible packages and categories. Card prices ("Starts at …") come only from such a published version; the built-in package summaries in `config/chatbot.ts` never show a price on a card.
- The package booklets on the event pages (`config/package-booklets.ts`) are included while packages are visible (`bookletChatSources` in `config/chatbot.ts`): one source per booklet section (menu, styling, sound…) and one overview per package. Their rates are not repeated there: prices come from the package catalog, which `scripts/sync-package-catalog.ts` keeps in line with the booklets (one catalog package per published guest count, `config/package-catalog.ts`), so Zeni has one source for each price. While the catalog has no packages, Zeni uses the same booklet rates (`backupPackageSources`).
- The admin venue policy contributes one plain-language payment requirement only after a super administrator marks it reviewed. Unreviewed policy, cash instructions, contract text and staff identity are excluded.
- Conflicting published facts (FAQ answers, capacity figures, payment methods, deposit rules) are not resolved by Zeni: it gives only what is consistent, offers staff and logs the question as a conflict. Developer documents are not public knowledge.

### Payment guide (27 November 2026)

Zeni answers how to pay from what the booking system offers now (`paymentGuideSources` in `lib/chatbot/payment-methods.ts`, built from Settings > Online payments in `services/chatbot/sources.ts`). Cash is always offered; GCash and bank transfer while their account is set up. Six answers, in the order of [docs/booking-automation.md](booking-automation.md):

- **Which payment methods does Zion accept?**: the methods.
- **Where and how do I pay?**: once Zion holds a date, the "Your date is on hold" email (and the screen after the request) gives the amount, the deadline and the private payment page; online methods are paid to the account shown there and the receipt screenshot is uploaded on the same page; cash is paid at the venue.
- **Where do I send my proof of payment?** (online methods only): on the payment page, with the reference number, amount and date; staff verify it and the client is emailed either way.
- **Account details for payments** (online methods only): Zion's GCash and bank details are on the private payment page with the amount and deadline. Zeni never gives an account number: the public settings never carry it.
- **Do I get a receipt for each payment?**: every recorded payment gets a numbered acknowledgment receipt, downloadable from the payment page and linked from the emails; it is not an official receipt.
- **Can I pay in cash, and where?**: at Zion Events Place (the address in `config/brand.ts`), with an acknowledgment receipt.

A question with a payment word (pay, payment, bayad, magbayad, hulog, GCash, bank, cash, proof…) is ranked against the guide only (`reconciliationPlan` in `lib/chatbot/receptionist.ts`); a question about the accepted methods that no answer covers gets the methods. The guide stays out of the general search, so it never takes another question or changes how rare other questions' words look. Answers about the client's own payment carry a **Find my payment page** button (`/booking/pay`, `FIND_PAYMENT_PAGE_PATH`). Search reads "where" and "saan" as "location", so each answer's subject leaves them out and "Where are you located?" keeps the location. New search words: Filipino forms of send and upload (isend, isesend, ipadala, i-upload…), "ss" and "screen shot" for screenshot, "numero", "acct" and "hulog".

Check on the 7,113-question bank (rules only, English and Tagalog, the live order of knowledge with all three methods), against commit b4495e1: 36 of 14,226 answers changed. 27 questions without an answer now get the guide (where to upload the proof, paying cash at the venue, when the payment link comes, a lost link, receipts, and Filipino "ipapadala" questions such as sending styling pegs). 8 moved: "How can I pay?", "Paano po ako magbabayad?" and "how 2 pay" now get the steps instead of the methods or the payment schedule, "Where do I send the payment?" no longer gets the Photo & Video pegs answer, and two receipt questions get the receipt answer. 1 weak match was lost ("Is my date already secured while my reservation fee is still being verified?", previously the payment terms). Fixed on the way: the methods answer said "staff check it", which matched the filter for the older card-and-check list and hid it from the general search.

## Cards, buttons and links

- **Detail cards**: facility, published package or event page, with a photo from `public/images`, a short description, a "Starts at" price only from a published package version, and a link to the page.
- **Availability calendar card**: a month view of the booking window ([docs/booking-window.md](booking-window.md)): from today to the last bookable date (18 months ahead by default), one month at a time. The card carries the month it opens on; each other month loads when the guest opens it (`GET /api/client/chatbot/calendar?month=YYYY-MM`, months inside the window only, with a short loading state). Dates with a held or confirmed admin-calendar event are marked booked, days inside the minimum notice are marked too soon, in text as well as color, with a legend (Open to check, Booked, Too soon) and the limits in words ("Book at least 14 days ahead. You can book up to 18 months ahead (until May 2028)."). The next-month arrow stops only at the furthest month. Dates only: no event, client, payment or note is exposed. Choosing an open date runs the calendar check, and a typed or checked date opens the card on its month.
- **Calendar check** (`receptionist-calendar.ts`): a date with a time window checks that window; a date alone checks the whole Manila day. A date inside the minimum notice, or beyond the window, is not checked: Zeni says why ("…is less than 14 days away" or "bookings for … open on …") and offers the staff. Venue names are aliases of the one exclusive venue resource. A result is a timestamped snapshot, valid for five minutes, and never a hold.
- **Links** built by the server: "Book this date" / "Open the booking form" → `/booking?…&source=zeni`; "Schedule an ocular visit" → `/visit?date=…&source=zeni` (the visit page, [docs/visits.md](visits.md)); "Find my payment page" → `/booking/pay` under payment-guide answers; source links to the public page. "Talk to staff" starts the hand-off.
- **Suggested replies**: short, language-aware chips such as "Check a date", "Wedding packages" and "Schedule a visit".

### Pre-filled link contract

| Page       | Parameters                                                                                                                                                                                                                                                    | Parser                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `/booking` | `event` (wedding, debut, birthday, christening, christmas-party, gender-reveal), `package` (classic, signature, grand, custom), `date` (YYYY-MM-DD, today to three years ahead), `start` and `end` (HH:MM, start before end), `guests` (1–500), `source=zeni` | `app/booking/_components/bookingPrefill.ts` |
| `/visit`   | `date` (YYYY-MM-DD; preselected when that day has open visit times), `source=zeni` (saved as the visit source)                                                                                                                                                | `app/visit/page.tsx`                        |
| `/contact` | Earlier Zeni links: `topic=visit`, `date` (YYYY-MM-DD, today to one year ahead), `source=zeni`                                                                                                                                                                | `app/contact/_components/visitPrefill.ts`   |

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

**Greeting** (27 November 2026, from panel feedback that visitors did not notice the chatbot): about 2 seconds after the site opens, a small card beside the launcher says "Hi, I’m Zeni! Need something? Message us here." Choosing it opens the chat; × closes it and returns focus to the launcher. It shows once per visit (the tab's session, `zeni-greeting-seen` in `sessionStorage`), never while the chat is open, and goes away after 15 seconds unless the pointer or keyboard is on it. It never takes focus and is not announced: the launcher keeps its own accessible name, and the two greeting buttons are ordinary buttons with names. It fades up with the panel's spring, without motion when reduced motion is on, follows the dark theme, and sits above the event pages' bottom bar with the launcher. It replaces the earlier one-time "Questions? Ask Zeni" label (once per browser, 8 seconds, hidden from assistive technology). Copy: `chatbotReceptionist.greeting` in `config/chatbot-receptionist.ts`; code: `components/chatbot/ChatLauncher.tsx`.

The panel is a native modal `<dialog>`: focus moves to the title, Tab stays inside, Escape closes the info panel or the dialog and focus returns to the launcher. The message list is `role="log"` with `aria-live="polite"`. Controls are at least 44 px, text at least 12 px, focus is visible and status never relies on color alone. Motion (27 November 2026, at the owner's request): the panel grows out of the launcher with a soft spring (`--motion-slow`, `--motion-spring`), its header, conversation and message field follow in a short cascade, new messages rise in, and the launcher lifts under the pointer; on phones the sheet slides up. Closing is a quick fade. With reduced motion all of it is removed. Colors come from the `--chat-*` tokens in `styles/tokens.css`, which alias the ZENTRA palette; the CSS Module swaps them for the dark theme.

## Admin tools

`/admin/zeni` (`app/admin/(panel)/zeni/page.tsx`, `components/admin/ZeniPanel.tsx`, API `app/api/admin/zeni/route.ts`) is available to SUPERADMIN and ADMIN accounts. It shows the model status (key configured, model, on or off, this process's usage), the knowledge in use with counts, last-updated times and where staff edit it (including the package booklets), unanswered questions grouped by their key words (other wordings, including Filipino ones, are listed under "Also asked as") with a topic label and "Mark resolved" (audited), hand-off counts, and an "Ask Zeni" test console that runs one question in preview mode: nothing is stored, no inquiry is sent and nothing is logged as unanswered. The route uses the admin session, same-origin mutation checks, zod validation and a 20-per-minute test budget.

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
