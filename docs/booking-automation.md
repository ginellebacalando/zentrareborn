# Booking automation (phase 1)

The plan's rule for bookings is that **the system checks the details and staff only check the
payment** (and decide unusual requests). Phase 1 makes that true for cash payments; phase 2 adds
GCash and bank transfer proof uploads with a Verify payment screen.

Code: `lib/admin/booking-rules.ts` (pure rules), `services/booking-requests.ts` (website requests),
`lib/admin/service.ts` (staff actions), `lib/admin/booking-automation.ts` (scheduled jobs, run by
`lib/automation/run.ts`), `lib/booking-occupancy.ts` (which bookings make a slot unavailable),
`components/admin/BookingDetail.tsx` and the Booking Automation card in
`components/admin/SystemSettingsForm.tsx`.

## The flow

| Step                       | Who                              | What happens                                                                                                                                                                                                                                                                                      |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Booking page            | Client                           | The page already refuses past dates, taken dates, hours outside 08:00–23:30 and too many guests.                                                                                                                                                                                                  |
| 2. Approval                | **System**, or staff for reviews | An ordinary request is approved at once and **holds its date** until the payment deadline (approval `APPROVED`, `holdExpiresAt` set). The client gets "Your date is on hold" with the amount and deadline; staff get "New booking waiting for payment" and a [Pending] calendar event.            |
| 3. Review (only if needed) | Staff                            | A request goes to **Under review** when it is a custom proposal (no price yet), its package has no reservation fee, the policy needs no payment, the policy is not reviewed yet, or it has more guests than the Settings limit. **Approve request** holds the date; **Reject request** closes it. |
| 4. Payment                 | Staff                            | Staff record the cash in **Cash receipts**. When the payments reach the confirmation rule (the reservation fee, or the full amount under a full-payment policy), the booking is **confirmed in the same step**: confirmation email with calendar invitation, staff calendar update, reminders.    |
| 5. Missed deadline         | **System**                       | Every scheduled run (every 10 minutes) releases holds whose deadline passed **without any payment**: the booking is cancelled with the reason, the client gets "Payment deadline passed" and the staff calendar event is removed. A partly paid hold is left to staff.                            |
| 6. Reminder                | **System**                       | One reminder a day before the deadline, skipped when the client heard about the deadline within the last 12 hours.                                                                                                                                                                                |
| 7. After the event         | **System**                       | From 07:00 Manila the morning after, a fully paid confirmed event becomes **Completed** (completion email). One with a balance stays confirmed and staff get one "Balance still due" email.                                                                                                       |

Staff can still **Extend payment deadline** (a new deadline from now, never after the event
starts), **Cancel booking**, **Flag as suspicious** (a flagged request cannot be approved or
confirmed until **Clear flag**), edit a requested booking, and press **Confirm** for a booking that
needs no payment. Contact verification is no longer required: receiving the payment is what
secures a date.

The Bookings tabs follow the plan: **Under review** (`request`), **Waiting for payment**
(`pending`), **Confirmed** (`confirmed`, including completed events) and **Cancelled**
(`cancelled`: cancelled, rejected or expired).

## Rules

- **Payment deadline:** _Settings → Booking Automation → Days to pay the reservation fee_ (1 to 14,
  default 3). The deadline is never after the event starts. New deadlines use the current value;
  existing ones stay until staff extend them.
- **Guest limit:** _Review bookings with more guests than_ (optional). Zion's documents give the
  capacity as both 120 and 130, so the value is for Zion to confirm.
- **Occupied slots:** a confirmed reservation or an approved request (held while the client pays)
  makes its slot unavailable for the booking page, Zeni's calendar and staff approval. Requests
  under review do not, so spam cannot block dates. An unpaid hold is released by the next run
  after its deadline.
- **Concurrency:** saving a website request, approving and confirming take the same venue lock, so
  two clients cannot hold or confirm the same slot.

## Emails

New client notices: `HOLD_EXTENDED` (Payment deadline extended), `HOLD_EXPIRED` (Payment deadline
passed) and `HOLD_REMINDER` (Payment deadline reminder). `REQUEST_RECEIVED` and
`REQUEST_APPROVED` now include the amount and deadline when the date is held. New staff email:
`BALANCE_AFTER_EVENT`. The staff calendar gains a "Payment deadline passed" removal. See
[docs/automation.md](automation.md) for the outbox, keys and delivery rules.

## Database

`prisma/booking-holds.sql` adds `zion_admin_bookings."holdExpiresAt"` (with an index) and lets a
custom proposal be saved with a total of 0 until staff quote it (before this, a "Custom proposal"
request from the booking page was refused by the database). It is additive and idempotent:

```
npm run db:booking-holds:check                               # check only
npm run db:booking-holds:check -- --apply                    # local database
npm run db:booking-holds:check -- --apply --allow-remote     # hosted, after approval
```

Booking rules are stored in the existing settings JSON, so they need no migration.

## Existing bookings

Requests already waiting before phase 1 stay **Under review**; approving one starts its deadline.
Requests that were approved earlier have no deadline: they keep holding their date until staff
record the payment, confirm, extend or cancel them.

## Not in phase 1

GCash and bank transfer proof uploads with a Verify payment screen (phase 2), client accounts and
sign-in, the waitlist, and an AI pre-check of payment screenshots. An AI never approves a
booking or a payment.
