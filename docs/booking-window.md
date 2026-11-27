# Booking window

How soon and how far ahead guests can book an event: one setting for the whole system (27 November
2026). The team plan (`ZENTRA_MASTER_PROMPT.md`, rule 5) suggests **14 days** of minimum notice and
**18 months** ahead. Both are defaults to confirm with Zion and can be changed in **Settings >
Booking window** (super administrators; the change is in the Activity log).

| Setting                      | Default | Allowed |
| ---------------------------- | ------- | ------- |
| Minimum notice (days)        | 14      | 1–180   |
| Furthest date (months ahead) | 18      | 1–36    |

## Where it applies

- **Booking page** (`app/booking/page.tsx`, `BookingRequestForm.tsx`): the date picker allows only the
  window, the field shows "Book at least 14 days ahead. You can book up to 18 months ahead (until
  May 2028).", and a link's date outside the window is ignored (`bookingPrefill.ts`).
- **The server that saves requests** (`services/booking-requests.ts`) and **walk-ins at the Front
  desk** (`lib/admin/walk-in.ts`): `bookingScheduleProblem` (`lib/booking-quote.ts`) refuses a date
  outside the window, with the same words.
- **Event package pages**: "Check dates" opens the booking page, which applies the window.
- **Zeni**: the calendar card covers the window, month by month; a typed date inside the notice
  period or beyond the window gets an explanation and the staff offer instead of a check
  ([docs/chatbot.md](chatbot.md)).

Staff bookings made in the admin Bookings page are not limited by the window, so staff can still
record a short-notice event. Ocular visits keep their own rules ([docs/visits.md](visits.md)). The
site has no separate public Availability page; the home page's "Available dates" section links to
Zeni and the booking page.

## How it works

`lib/booking-window.ts` holds the pure rules (browser-safe): the dates for today (`earliest`,
`latest`), a date's position (`too_soon`, `open`, `too_far`), when bookings for a far date open
(`bookingOpensOn`: 18 months earlier, or the 1st of the next month when that month is shorter),
and the sentences above. The setting is stored in `system_settings.settings.admin.bookingWindow`
(no migration) and read on the server with `readBookingWindow()` (`lib/admin/preferences.ts`); a
missing or invalid value falls back to the defaults.

## Why Zeni's calendar stopped at January 2027

The card was built for "today plus 60 days" (`CALENDAR_CARD_DAYS` in
`services/chatbot/receptionist.ts`) and its next-month arrow turned off at the month that range
ended in, without saying why. On 27 November 2026 that was 26 January 2027. The 60 days were
separate from the booking page's limits (tomorrow to two years ahead), and Zeni had no furthest
date at all for a typed date. Now every surface uses the one window above.
