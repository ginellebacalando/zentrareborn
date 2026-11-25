# Booking automation

The plan's rule for bookings is that **the system checks the details and staff only check the
payment** (and decide unusual requests). Phase 1 made that true for cash payments. Phase 2 adds
GCash and bank transfer screenshots, which staff check with **Verify payment**. Phase 3 adds
balance payments after confirmation, full-payment reminders and an acknowledgment receipt for
every recorded payment.

Code: `lib/admin/booking-rules.ts` (pure rules), `services/booking-requests.ts` (website requests),
`lib/admin/service.ts` (staff actions), `lib/admin/booking-automation.ts` (scheduled jobs, run by
`lib/automation/run.ts`), `lib/booking-occupancy.ts` (which bookings make a slot unavailable),
`components/admin/BookingDetail.tsx` and the Booking Automation card in
`components/admin/SystemSettingsForm.tsx`. Phase 2: `services/payment-proofs.ts` (payment page and
upload), `app/booking/pay/[token]/` (the client's payment page), `lib/payment-link.ts` (signed
links), `lib/payment-proof-file.ts` (file checks), `lib/admin/payment-proofs.ts` (what staff see),
`components/admin/PaymentProofReview.tsx` and the Online Payments card in Settings. Phase 3:
`lib/payment-receipts.ts` (acknowledgment numbers and the receipt PDF),
`app/booking/pay/[token]/receipts/[paymentId]/` and `app/api/admin/receipts/[id]/` (downloads).

## The flow

| Step                       | Who                              | What happens                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Booking page            | Client                           | The page already refuses past dates, taken dates, hours outside 08:00–23:30 and too many guests.                                                                                                                                                                                                                                                |
| 2. Approval                | **System**, or staff for reviews | An ordinary request is approved at once and **holds its date** until the payment deadline (approval `APPROVED`, `holdExpiresAt` set). The client gets "Your date is on hold" with the amount, the deadline and a link to their payment page; staff get "New booking waiting for payment" and a [Pending] calendar event.                        |
| 3. Review (only if needed) | Staff                            | A request goes to **Under review** when it is a custom proposal (no price yet), its package has no reservation fee, the policy needs no payment, the policy is not reviewed yet, or it has more guests than the Settings limit. **Approve request** holds the date; **Reject request** closes it.                                               |
| 4. Payment                 | Client, then staff               | The client pays cash at the venue, or pays by GCash or bank transfer and sends the screenshot on their payment page. Staff record cash in **Payments received**, or check the screenshot against Zion's own records and press **Verify payment**. When the payments reach the confirmation rule, the booking is **confirmed in the same step**. |
| 5. Missed deadline         | **System**                       | Every scheduled run (every 10 minutes) releases holds whose deadline passed **without any payment** and with **no screenshot waiting for review**: the booking is cancelled with the reason, the client gets "Payment deadline passed" and the staff calendar event is removed. A partly paid hold is left to staff.                            |
| 6. Reminder                | **System**                       | One reminder a day before the deadline, with the payment page link, skipped when the client heard about the deadline within the last 12 hours or a screenshot is waiting for review.                                                                                                                                                            |
| 7. Balance                 | Client, then staff               | After confirmation the same payment page shows the remaining balance and the full-payment date (Zion's terms: 14 days before the event). The client pays cash or sends a balance screenshot; staff verify it the same way. Reminders go out a week and a day before that date.                                                                  |
| 8. After the event         | **System**                       | From 07:00 Manila the morning after, a fully paid confirmed event becomes **Completed** (completion email). One with a balance stays confirmed and staff get one "Balance still due" email.                                                                                                                                                     |

Staff can still **Extend payment deadline** (a new deadline from now, never after the event
starts), **Cancel booking**, **Flag as suspicious** (a flagged request cannot be approved or
confirmed until **Clear flag**), edit a requested booking, and press **Confirm** for a booking that
needs no payment. Contact verification is no longer required: receiving the payment is what
secures a date.

The Bookings tabs follow the plan: **Under review** (`request`), **Waiting for payment**
(`pending`), **Confirmed** (`confirmed`, including completed events) and **Cancelled**
(`cancelled`: cancelled, rejected or expired).

## Online payments (phase 2)

**Settings → Online Payments** holds Zion's GCash account (name and number) and bank account (bank,
account name and account number). A method is offered only when all of its fields are filled in;
with neither, clients see the cash instructions only. The accounts are stored in the settings
JSON and shown only on payment pages; the public settings API never returns them, and the audit
log records only that they changed.

**The payment page** is `/booking/pay/<booking id>.<signature>`. The signature is an HMAC of the
booking id with `AUTH_SECRET`, so the link cannot be guessed or altered and needs no stored token.
It appears as a button and a plain link in "Your date is on hold", the deadline reminder,
"Payment deadline extended", "Payment screenshot not accepted", the reservation confirmation while
a balance remains and the balance reminders, and as "See how to pay" on the booking page right
after a request is held. The button reads "See how to pay or upload your payment" only while a
GCash or bank account is set up; otherwise it reads "See how to pay" and the page shows the cash
instructions, so no email promises an upload the page cannot take. The page is not indexed and
sends no referrer. It shows the booking, what to pay and by when, how to pay, the booking reference
to write in the transfer note, the upload form while a payment is due, and the payments received
with their receipts.

**Uploads** take one JPG, PNG, WebP or PDF up to 4 MB (large phone photos are scaled down in the
browser first). The server checks the file's first bytes, never its name or the browser's claim,
removes photo metadata (EXIF location and camera data) from JPEGs, and stores the file privately
in `zion_payment_proofs` (row security on, no Data API access). The client also gives the
method, the reference number, the amount (at most the balance) and the date paid (not in the
future, at most 60 days ago). A newer screenshot replaces one still waiting. Limits: 5 screenshots
per booking per day and 60 per hour overall; cross-site posts and a filled honeypot field are
refused. The client gets "Payment screenshot received"; staff get "Payment screenshot to verify"
with a link to Bookings, plus a bell notice and a line in the daily digest.

**While a screenshot waits for review** the date stays held, even past the deadline, and no
reminder is sent. The booking list shows "Screenshot to verify".

**Verify payment** (booking detail): staff see the image (or download the PDF), the client's
entries and warnings when the payment may not be new: the same reference sent for another booking
or already verified, the reference already recorded as a payment, or the same image sent before.
Staff tick "I found this payment in our records", may correct the amount, reference and time from
their records, and verify. The payment is recorded with its method (`GCASH` or `BANK_TRANSFER`)
and the receipt number `GCASH-<reference>` or `BANK-<reference>`. Receipt numbers are unique, so
one transfer can never pay for two bookings. When the payment meets the confirmation rule, the
booking is confirmed in the same step, exactly like cash. The client gets "Payment verified" with
the receipt (and the confirmation with its calendar invitation).

**Reject screenshot**: staff choose a reason (amount does not match, unclear, wrong account, not
in our records, already used, or another reason with a note) and may add a note for the client.
The client gets "Payment screenshot not accepted" with the reason and the payment page link. For a
held date the deadline moves to at least 24 hours from now (never after the event starts),
because it could not expire during the review. A screenshot on a closed or fully paid booking is
closed without emailing the client.

Staff decide every screenshot. Nothing approves or verifies a payment automatically, and no AI
reads the screenshots.

## Balance payments and receipts (phase 3)

**The balance.** Zion's published terms ask for full payment at least 14 days before the event.
_Settings → Booking Automation → Days before the event full payment is due_ (1 to 90, default 14)
sets that date: the end of the Manila day that many days before the event. After confirmation
the client's payment page shows the remaining balance and this date ("Now" once it has passed),
and takes a GCash or bank screenshot for the balance; staff verify or reject it exactly like the
reservation fee, and cash is recorded in **Payments received** as before. The booking detail shows
**Full payment due** (marked overdue once it passes) and keeps **Payment screenshots** visible
while a balance remains. The terms' earlier step (half of the balance 60 days before the event)
is not automated.

**Balance reminders** go to the client a week before the full-payment date and again the day
before, with the payment page link. They are skipped while a screenshot waits for review, and for
twelve hours after the client heard from us about a payment; each is sent once.

**Acknowledgment receipts.** Every recorded payment, cash or a verified transfer, gets an
acknowledgment number from a database counter (`ACK-<year>-<number>`, for example
`ACK-2026-000042`) and a one-page PDF receipt: Zion's details, who paid, the booking, what the
payment was for (reservation fee, balance or both), the method and reference, when it was received
and by whom, and the balance after it. Its footer says it is an acknowledgment of payment and not
an official receipt, which stays Zion's own tax document. Staff download it from
**Payments received** (a voided payment's receipt says VOIDED); the client downloads it from the
payment page, and the "Cash receipt recorded" and "Payment verified" emails link it. Downloads are
private, never cached and served as attachments.

## Rules

Walk-in bookings at the Front desk follow the same rules and prices ([docs/walk-ins.md](walk-ins.md)):
the booking page, its server and the walk-in page share `lib/booking-quote.ts` (the price of a
package for a guest count, and the date and time limits) and `websiteReviewReasons`.

- **Payment deadline:** _Settings → Booking Automation → Days to pay the reservation fee_ (1 to 14,
  default 3). The deadline is never after the event starts. New deadlines use the current value;
  existing ones stay until staff extend them.
- **Guest limit:** _Review bookings with more guests than_ (optional). Zion's documents give the
  capacity as both 120 and 130, so the value is for Zion to confirm.
- **Full payment:** _Days before the event full payment is due_ (default 14, from Zion's terms).
  It drives the payment page, the booking detail and the balance reminders.
- **Occupied slots:** a confirmed reservation or an approved request (held while the client pays)
  makes its slot unavailable for the booking page, Zeni's calendar and staff approval. Requests
  under review do not, so spam cannot block dates. An unpaid hold is released by the next run
  after its deadline unless a screenshot waits for review.
- **Concurrency:** saving a website request, approving and confirming take the same venue lock, so
  two clients cannot hold or confirm the same slot. An upload and a staff decision lock the same
  booking row, so staff always decide on the client's latest screenshot.

## Emails

Phase 1 client notices: `HOLD_EXTENDED` (Payment deadline extended), `HOLD_EXPIRED` (Payment
deadline passed) and `HOLD_REMINDER` (Payment deadline reminder). `REQUEST_RECEIVED` and
`REQUEST_APPROVED` include the amount and deadline when the date is held. Staff email:
`BALANCE_AFTER_EVENT`. The staff calendar gains a "Payment deadline passed" removal.

Phase 2 client notices: `PAYMENT_PROOF_RECEIVED` (Payment screenshot received), `PAYMENT_VERIFIED`
(Payment verified) and `PAYMENT_REJECTED` (Payment screenshot not accepted). Staff email:
`PAYMENT_PROOF_STAFF_ALERT` (Payment screenshot to verify).

Phase 3: `BALANCE_REMINDER` (Balance payment reminder). `CASH_RECEIPT` and `PAYMENT_VERIFIED` link
the acknowledgment receipt, and `RESERVATION_CONFIRMED` links the payment page while a balance
remains. See [docs/automation.md](automation.md) for the outbox, keys and delivery rules.

## Database

`prisma/booking-holds.sql` (phase 1) adds `zion_admin_bookings."holdExpiresAt"` (with an index) and
lets a custom proposal be saved with a total of 0 until staff quote it (before this, a "Custom
proposal" request from the booking page was refused by the database).

`prisma/payment-proofs.sql` (phase 2) adds `zion_admin_cash_payments."method"` (existing payments
stay `CASH`) and the private `zion_payment_proofs` table with row security on and no access for
the Supabase `anon` and `authenticated` roles.

`prisma/payment-receipts.sql` (phase 3) adds `zion_admin_cash_payments."acknowledgmentNumber"`
(unique) and the counter `zion_acknowledgment_number_seq`, closed to the Supabase roles. Payments
recorded before it get their numbers once, in the order they were recorded; no other value
changes.

All three are additive and idempotent:

```
npm run db:booking-holds:check                                # check only
npm run db:booking-holds:check -- --apply                     # local database
npm run db:booking-holds:check -- --apply --allow-remote      # hosted, after approval
npm run db:payment-proofs:check                               # check only
npm run db:payment-proofs:check -- --apply                    # local database
npm run db:payment-proofs:check -- --apply --allow-remote     # hosted, after approval
npm run db:payment-receipts:check                             # check only
npm run db:payment-receipts:check -- --apply                  # local database
npm run db:payment-receipts:check -- --apply --allow-remote   # hosted, after approval
```

Booking rules and payment accounts are stored in the existing settings JSON, so they need no
migration.

## Existing bookings

Requests already waiting before phase 1 stay **Under review**; approving one starts its deadline.
Requests that were approved earlier have no deadline: they keep holding their date until staff
record the payment, confirm, extend or cancel them. Their clients can use the payment page once
they receive an email with its link (for example after **Extend payment deadline**).

## Not yet

Client accounts and sign-in, the waitlist, the 60-day half-balance step in Zion's terms, and an AI
pre-check of payment screenshots. An AI never approves a booking or a payment.
