# Zeni receptionist workflow

Zeni is the public website receptionist. The 22 November 2026 implementation follows the user-supplied `zion-receptionist-workflow.md` (971 lines; SHA-256 `c1c4ebfe9bbdfc515862531399d4d8412b2e5cc78025e328d8d11aa6559ef224`) and the user's subsequent source clarification. The document supplies product requirements; its sample prices, policies and successful booking dialogues are examples, not business facts or proof that an operation happened.

The application implements Workflow 1 in `lib/chatbot/` and `services/chatbot/` using deterministic intent routing, explicit field collection and published-source retrieval. No generative model is configured. Orchestrating buddy owns the typed operational contract, calendar projection, signed booking adapter and authored n8n artifacts in `services/orchestration/`.

## Conversation and operational boundaries

| Requirement             | Implemented behavior                                                                                                                                                                                                         |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One receptionist voice  | Courteous, transparent virtual identity; concise replies and one next question; English with selected Filipino lookup synonyms.                                                                                              |
| S0–S7 journey           | Welcome, discovery, grounded answer, published-option matching, soft invitation, consented handoff, verified result and respectful withdrawal.                                                                               |
| Intent routing          | Information, offerings, price, availability, new request, reschedule, cancellation, policy, comparison, objection, complaint and human requests; separate scope, identity, manipulation, abuse and sensitive-data handling.  |
| Discovery and memory    | Explicit name/contact, event, package, full date, venue, start/end time, guests and budget are retained. Missing fields are requested without repeating known facts. Conflicting details require confirmation.               |
| Matching and conversion | Recommendations must fit a published package's price and included guest count. No invented discounts, scarcity, competitor claims or first-message sales push. Declining stops the invitation.                               |
| Grounding               | Literal source facts and linked excerpts; no unsupported quote. Missing information and detected conflicts use staff review. Sources are rechecked before cached evidence is replayed.                                       |
| Availability            | A future date and explicit same-day Manila start/end window are checked against the admin calendar after permission. The result is a timestamped confirmed-conflict check, never a reservation.                              |
| Operational handoff     | Strict schema, minimized payload, server-derived request ID, immutable retries, durable ledger and correlated results. Availability carries no name, contact or transcript.                                                  |
| Outcomes                | Available, unavailable, held, pending payment, confirmed, missing information, manual review and error remain separate. Untrusted message hints are ignored. Only an authoritative matching result establishes confirmation. |
| Escalation              | Explicitly consented name/email and minimized context become one standard NEW staff inquiry, activity and notification. Commit precedes the success message; retrying the same turn creates no duplicate inquiry.            |
| Recovery                | Revision conflicts, active/interrupted turns, stale operational replies, expiry, storage errors and retries have recovery paths. A failed action retains its original action and turn identity.                              |

New booking, reschedule and cancellation remain **unavailable until an authoritative Workflow 2 is configured and verified**. The adapter fails closed without its enable flag, approved HTTPS endpoint, signing secrets and durable ledger. The local calendar capability works independently of n8n. Workflow 1 adds no payment upload, bank-settlement check, hold creation or private admin booking mutation.

The n8n Workflow 1 and booking-bridge artifacts are inactive drafts. The imported bridge is unpublished and unexecuted. Their presence is not an operational success claim. See [the orchestration contract and activation requirements](../services/orchestration/workflows/README.md).

## Approved knowledge

- Location, email and visiting hours share `config/brand.ts`. Policies and terms use existing public configuration.
- Facility descriptions/features share `config/public-facilities.ts` with the Facilities screen. Existing component exports, copy, ordering and icon mapping are preserved. Event descriptions share `config/event-package-pages.ts` and are eligible only while packages are visible. Descriptive category copy cannot supply a price.
- FAQs use the currently published, visible, effective version in an active visible category. Hidden, archived, draft, future and expired versions are excluded. Once managed FAQs exist, hiding them does not republish the static fallback.
- Package facts use only `package_versions.snapshot_data` at `current_version`, with active/visible package and category checks. Live draft fields, internal notes, private contracts and unpublished versions are excluded. Published rates are not personalized quotations or verified setup capacities.
- The admin policy projection selects only `reviewed`, `paymentRule` and `version`. A reviewed recognized payment-requirement enum becomes a bounded plain-language fact; staff must verify amounts and applicable terms. Unreviewed fallback policy, arbitrary cash instructions, private contract text and staff identity are excluded.
- Source hashes bind acknowledgements and handoff references to current facts. Changed package/terms references require acknowledgement again before a new request is sent.
- Public payment-method wording and some generic capacity figures need business reconciliation. Detected conflicts go to staff; Zeni does not choose an unsupported method or setup-specific capacity. Developer documents are not automatically public knowledge.

The user plans to supply separate offering files; they have **not yet been ingested**. The local package images inspected are category covers, not readable price schedules. The external brochure could not be retrieved for verification. No rates, deposit amounts or additional capacities were inferred.

Future entries should retain `kb_id`, category, title, approved content, audience, last-verified date and related IDs, plus approving source, public visibility, effective/expiry dates, applicable event/setup and public citation destination. Reconcile overlapping money/policy/capacity facts before publication. Package facts belong in the existing published package-version flow and FAQs in the FAQ-version flow. Supplied files can then be mapped to those public-safe entries. Private developer-feed publication is a separate permission boundary. No unrestricted upload or automatic document publication is enabled.

## Admin calendar projection

`services/orchestration/receptionist-calendar.ts` uses the current staff-confirmation overlap semantics:

```text
venue = "Zion Events Place"
reservation = "CONFIRMED"
startsAt < requestedEnd
endsAt > requestedStart
select id only -> boolean conflict
```

Selah Hall, Pavilion Garden and the pool conservatively alias one property-wide resource. Separate resource calendars, buffers, opening-hours rules, maintenance blocks and holds are not modeled by this query. Adjacent windows are allowed; requested, cancelled and completed entries do not block it. No private event/client/payment/note/reference/staff field is returned. Staff confirmation still rechecks under its existing transaction lock. A snapshot can become outdated and does not secure a slot.

## Session, privacy and retry contract

The same-origin `/api/client/chatbot` supports POST for turns, GET for this browser's saved summary/recovery command, and DELETE for forgetting memory. The opaque HttpOnly, SameSite=Strict cookie is separate from staff/developer authentication; production adds Secure and a `__Host-` name. Visitors cannot choose conversation IDs or obtain another visitor's state.

The two additive tables in `prisma/receptionist.sql` hold encrypted conversation envelopes and the encrypted request/result ledger. RLS and revoked anonymous/authenticated grants keep them server-only. AES-256-GCM uses record-bound authentication and a purpose-separated key derived from server-only `RECEPTIONIST_STATE_KEY`, or an at-least-32-byte `AUTH_SECRET` fallback. Key changes make old conversations unrecoverable. Conversation writes bypass Prisma's development query logger.

Saved details expire 24 hours after creation; resuming does not extend the deadline. Expired sessions cannot be read. Expired rows are purged on new conversation creation; physical deletion is opportunistic, not a timed-job guarantee. No full transcript is stored: bounded state contains explicit facts, redacted context, source references, limited reply receipts for idempotency and one encrypted interrupted command. Recognized credential/identity-document messages are replaced with a privacy sentinel before recovery storage. This pattern guard is not universal sensitive-data detection; visitors are instructed to share only requested name/contact details. Ordinary name/contact details serve the inquiry or booking request.

Browser bubbles retain 20 exchanges and clear on reload. Saved details resume until expiry. Forgetting memory clears this cookie, state and request ledger; it does **not** cancel bookings or erase submitted inquiries. Inquiries follow existing staff retention/review. Saving an inquiry establishes neither a reservation, a response deadline nor delivered email.

Each turn uses a revision check and durable lease. Effects run outside the short database claim/update operations. An interrupted turn resumes with its original ID and payload. Booking retries reuse an encrypted canonical request including its original timestamp; the ledger checks lease ownership, fingerprint and bounded attempts. Stale operational replays request a fresh check instead of asserting old availability.

Ordinary and restored summaries carry observation/expiry timestamps. Their effective freshness is the earlier of the operational deadline and five minutes after observation; stale summaries retain the historical status/reference but label the snapshot stale. Expiring a snapshot does not cancel a confirmed booking. Fresh availability uses another explicit check; existing holds, payments and confirmations require staff verification rather than another mutation. Business-information questions mentioning an email or phone cannot silently replace the visitor's contact details.

Requests are limited to 8 KiB and messages to 600 characters, with strict fields and same-origin checks. Responses are `no-store`. The browser timeout is 25 seconds; mutations get at most one bounded retry with the same identity. The inherited budget is 120 requests/minute per process. Multiple production instances need shared ingress controls; this is not a distributed limit.

## Provisioning and verification

```powershell
npm run db:receptionist:check
node scripts/install-receptionist-schema.mjs --apply
npm run test:chatbot
npm run verify
node scripts/preview-chatbot.mjs
```

The installer checks by default and applies only the two additive tables with `--apply`. Remote installation requires separately authorized `--allow-remote`; partial/incompatible schemas fail for review. Preserve a stable encryption key privately. No runtime credential belongs in source, screenshots or handoffs.

The preview uses disposable in-memory PostgreSQL on loopback port 3013, separate Next output and ephemeral keys. Its package prices and seeded events are demonstration data. External booking orchestration, outbound notification transports and developer access are disabled. Stopping it discards the fixture.

Tests cover routing, missing fields, ten-turn memory, explicit dates/times, correction/consent/terms changes, scope/privacy, source visibility, real admin overlap/adjacency, signatures/correlation/stale replay, real ledger leases, interrupted recovery, expiry, consented inbox deduplication, isolation and safe failures. Actual final gate/browser evidence and review limits are recorded in `docs/design-change-log.md`.

Remaining operational inputs include authoritative mutation implementation, hold policy, verified settlement evidence, approved service/payment instructions, signing configuration and the promised knowledge files. Full multilingual dialogue, model reasoning, blind persona evaluation, real-device/screen-reader evaluation and business KPI validation are not established by tests. No deployment or universal accessibility conformance is claimed.
