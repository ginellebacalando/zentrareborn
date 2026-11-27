# Walk-in bookings at the Front desk

Staff book for a client who is at the desk, with the website's packages, prices and rules, record
how the client agreed to the terms, and take cash on the spot or leave the payment for later. This
is plan section 16.2; the visits and the Front desk itself are in [docs/visits.md](visits.md).

Open it from the Front desk: **Walk-in booking** in the header, **Start booking** on a visit, or
**Book for <client>** in the client lookup. The page is `/admin/front-desk/walk-in`; only record ids
travel in its address (`?visit=<id>`, `?booking=<id>`), never contact details.

## The four steps

1. **Client**: search a returning client by email, phone or name and copy their details, or type a
   new client's name, email and mobile number. From a visit or an earlier booking the details are
   already filled in.
2. **Event**: the published event types and packages (the same catalog as the booking page), the
   date, start and end, the number of guests, what the client asked about and notes for the team.
   The summary beside the form shows the price and what saving will do.
3. **Consent**: either "The client signed the printed consent form" (keep it with the booking
   papers), or "The client agreed on this screen": the client reads a short notice linking the
   Privacy Notice, Terms and Conditions and Event Policies, and ticks the box themselves.
4. **Payment and review**: cash received now (with the paper receipt number), or pay later.

## Same rules as the website

- **Price**: `packageQuote` in `lib/booking-quote.ts` is the one pricing engine for the booking
  page, its server and the Front desk: the package price plus each guest above the included guests
  at the package's per-guest fee; the reservation fee never exceeds the total.
- **Dates and times**: `bookingScheduleProblem` (same file): inside the booking window from
  Settings ([docs/booking-window.md](booking-window.md); by default 14 days to 18 months ahead),
  08:00 to 23:30, at least an hour, and 10 to 500 guests. A time held or confirmed for another
  booking is refused when saving.
- **Review**: the website's review rules (`websiteReviewReasons`). At the desk, staff may approve a
  larger event than the Settings guest limit themselves, with a reason of at least five characters
  that goes to the activity log. A custom proposal, a package without a reservation fee or an
  unreviewed venue policy still waits for a decision on Bookings, and takes no payment yet.

## What saving does

| Outcome       | When                                              | The client gets                                         |
| ------------- | ------------------------------------------------- | ------------------------------------------------------- |
| **Confirmed** | Cash now that meets the policy (fee or full)      | The confirmation with `invite.ics`, and the receipt     |
| **On hold**   | Approved, paid later or only part of the fee      | How much to pay and by when, with the payment page link |
| **Review**    | A reason above that staff did not or cannot clear | That the request was received                           |

- The booking is created by the staff member, marked as **verified** (met in person), and its
  notes record the walk-in, the consent and the time, the preferred payment and what the client
  asked about.
- Cash is recorded exactly like Record cash on Bookings: an acknowledgment number, a receipt PDF,
  and automatic confirmation when it meets the venue policy. A receipt number already recorded is
  refused and nothing is saved.
- A held date appears in the staff calendars as a pending event and a confirmed one as the
  reservation, as for website bookings.
- **GCash or bank transfer at the desk**: save with "Pay later", then open the client's payment page
  from the result and upload the transfer screenshot there; it waits for verification like any
  other. "Pay later" offers GCash and bank transfer only while that account is set up in Settings
  → Online payments, and the link appears then.
- **From a visit**: a checked-in visit is marked completed, and its staff notes name the booking.
- **Activity log**: a Bookings CREATE entry with `channel: walk-in`, the consent method and time and
  the source visit; an APPROVAL entry when staff approved at the desk; the payment and the automatic
  confirmation. The dashboard and reports count walk-ins with the other bookings.

## Not included yet

- An upload of the signed consent form (it stays on paper).
- Client accounts to "claim" the booking online (the client gets the emails and the payment page).
- A price for a custom proposal at the desk (it is saved for review; staff set the price with Edit
  details on Bookings).

## Code

- Shared rules (browser-safe): `lib/booking-quote.ts`, `walkInReview` in `lib/admin/booking-rules.ts`,
  `lib/walk-in-types.ts`
- Server: `lib/admin/walk-in.ts` (options, pre-fill, `createWalkInBooking`), dispatched by
  `lib/admin/front-desk.ts` (`walk-in-booking`)
- Page: `app/admin/(panel)/front-desk/walk-in/page.tsx`, `components/admin/WalkInBooking.tsx`
- Tests: `lib/booking-quote.test.ts`, `lib/admin/walk-in.test.ts`
