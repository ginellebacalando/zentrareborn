# Receptionist booking workflow artifacts

`receptionist-chatbot.v1.json` is the authored Workflow 1 receptionist draft. It follows the reference pattern of webhook entry, a central receptionist coordinator, bounded capabilities, and a structured response without copying dental prompts or tools. The production capability nodes are disabled documentation until their real dependencies exist. Its only executable path deliberately stops with `NOT_CONFIGURED`.

`receptionist-booking.v1.json` is the separate authored W1-to-W2 booking boundary. It is not Workflow 2 itself.

Read-only `availability_check` requests do not use n8n or the mutation bridge. The server dispatches them to `receptionist-calendar.ts`, which projects only `AVAILABLE` or `SLOT_UNAVAILABLE` from confirmed admin-calendar overlaps for one explicit Manila-time venue window. The projection never returns event records, client identity, notes, references, payments, or staff data. `new_booking`, `reschedule`, and `cancel` remain behind the signed, persisted, fail-closed W2 adapter.

Both artifacts are inactive source drafts. They are not evidence of publication or execution. Importing them leaves `active` set to `false`; activation before the required dependencies and acceptance tests are complete is prohibited.

The production workflow must implement the contract exported by:

- `services/orchestration/receptionist-booking.contract.ts`
- `services/orchestration/receptionist-booking.adapter.ts`

Required sequence:

1. Receive the exact request body over the approved HTTPS webhook.
2. Verify the request timestamp, exact-body HMAC, contract version, idempotency key, and correlation fields.
3. Claim a durable request lease before reading or changing an external system.
4. Route `availability_check`, `new_booking`, `reschedule`, or `cancel` without using the legacy inquiry workflow.
5. Use only authoritative calendar, booking, payment, or staff-review sources.
6. Persist the structured result against the same request fingerprint.
7. Return strict JSON correlated to the same request, conversation, turn, and state revision.
8. Sign the exact response body and timestamp. A successful HTTP response alone is not proof that a booking, hold, or payment completed.

Availability checks receive no client identity or contact details. Booking operations receive only the minimum validated fields. Raw transcripts, payment credentials, attachments, and arbitrary model output are outside this contract. Cash and bank transfer are the only currently approved payment-channel values. An attachment, OCR result, or model extraction cannot establish settled funds.

Before deployment, the operator must supply an authoritative Workflow 2 implementation, durable ledger, hold and retry rules, approved calendar/booking sources, bank-settlement evidence, human-escalation path, and separate request/response signing secrets through private runtime configuration. No secret or provider credential belongs in this artifact.
