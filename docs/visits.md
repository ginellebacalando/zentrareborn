# Ocular visits and the Front desk

Visitors schedule an ocular visit on the website and get a confirmation email with a calendar
invitation right away; staff run the day from the admin **Front desk**. This covers plan section
16.1 (ocular visits) and 16.3 (returning clients: the client lookup with history); walk-in
bookings (16.2) are in [docs/walk-ins.md](walk-ins.md).

## For visitors

- **`/visit`** lists the days of the next 60 days that still have an open time, then that day's
  times, as native radio buttons. The visitor gives a name, email and mobile number, optionally the
  event type, event date, guests and a message, and agrees to the privacy notice. The visit is saved
  at once: the page shows the reference, the time, directions and a link to change it.
- **Email.** The confirmation attaches `invite.ics` and links the visitor's private page,
  `/visit/manage/<visit id>.<signature>`. Reminders follow the day before and on the morning.
- **`/visit/manage/<token>`** shows only that visit. While it is still ahead, the visitor can move
  it to another open time (the website's notice applies) or cancel it after a confirmation step;
  each change is emailed with a calendar update. A cancelled, completed or past visit shows its
  state and links to schedule a new one or book.
- **Entry points.** Zeni's "Schedule an ocular visit" opens `/visit?date=<the date being
discussed>&source=zeni` (the day is preselected when it has open times), the booking page intro
  ("Not ready yet? Schedule an ocular visit"), the home page's Available Dates section (beside
  "Start a booking"), and the Business Hours card on the Contact page.
  Earlier Zeni links to `/contact?topic=visit` still open the contact form with a visit message.
- The page follows the same on/off switch as inquiries and booking requests (Settings, client
  access); while paused it shows the contact details instead.

## Rules (Settings > Ocular Visits)

| Rule                    | Default                                                   | Limits                        |
| ----------------------- | --------------------------------------------------------- | ----------------------------- |
| Weekly hours            | Tuesday to Saturday 10:00 to 18:00, Sunday 14:00 to 18:00 | each open day fits one visit  |
| Length of each visit    | 60 minutes                                                | 30, 45, 60, 90 or 120 minutes |
| Visits at the same time | 1                                                         | 1 to 5                        |
| Hours of notice         | 12 (website only; the Front desk needs none)              | 0 to 72                       |
| Closed dates            | none                                                      | up to 60 dates                |

The defaults are the hours the website already publishes, with one visit at a time; Zion still has
to confirm them (plan section 27). Times start at the opening time and repeat every visit length
while a whole visit fits before closing. A time that overlaps a confirmed booking or a held date
(`lib/booking-occupancy.ts`) is never offered, whatever the capacity. The rules are saved with the
other settings, checked on save with the problem shown under its field, and recorded in the
activity log as "Visit hours or rules changed".

## For staff: the Front desk (`/admin/front-desk`)

Every staff role can use it. The page refreshes itself every minute.

- **Today**: the day's events at the venue (confirmed or held for payment) and every visit, with
  the actions its state allows: **Check in** (on the day), **Mark completed** (once checked in, or
  after the start time), **No-show** (after the start time) and **Start booking**; a scheduled
  visit's More (⋯) menu holds **Reschedule**, **Staff notes** (never sent to the visitor) and
  **Cancel visit** (with a reason for the activity log; the visitor gets the cancellation without
  it). Other visits show **Staff notes** as a button.
- **Earlier visits without an outcome**: still scheduled or checked in after their day.
- **Upcoming visits**: the next two weeks, by day.
- **Schedule a visit** for a caller or a walk-in who will come back: any open time, without the
  website's notice. The email is optional; without it only the staff calendars get the event. Staff
  confirm that the client agreed to share the details.
- **Client lookup** by email (any case), phone (matched on its last ten digits, so `0917 555 0101`
  and `+63 917 555 0101` are the same) or part of the name: the client's bookings and visits, and
  buttons to schedule a visit or start a walk-in booking with their details.
- **Start booking** opens the walk-in booking filled from the visit
  (`/admin/front-desk/walk-in?visit=<id>`, [docs/walk-ins.md](walk-ins.md)); when the visitor
  books, a checked-in visit is marked completed.

Every change is in the activity log under the module **Front desk**, with the visit id.

The admin **Calendar** shows the month's visits beside its events: a hollow square on each day
with a visit (the booking dots are round), an "Appointments" legend entry, and the appointments in
the month list with their purpose, status and time; each opens with the Front desk's actions.
Cancelled visits are left out; a booking status filter hides visits, and the search also matches a
visitor's name, email or reference (`readCalendarVisits` in `lib/admin/front-desk.ts`).

## Appointments: meetings with clients (28 November 2026)

Staff also schedule **appointments** that are not ocular visits: a **planning meeting**, a
**contract signing**, or **another meeting** with its own title ("Food tasting"). They are visits
with a purpose (`lib/appointments.ts`), so they share everything a visit has: the open times and
places (Settings > Ocular Visits; staff need no notice), the confirmation with `invite.ics`, the
reminders the day before and on the morning, the staff calendar copies, the manage link, the Front
desk's check-in, notes, reschedule and cancel, and the daily digest. Only staff schedule them; the
website only schedules ocular visits (a database check keeps it so).

- **Scheduling**: the Calendar's **Schedule** button, **Schedule on this day** in a chosen day's
  panel (the form opens on that day), or **Schedule appointment** on the Front desk. The form asks
  what it is for, a title for another meeting, and a place (empty means the venue; an online
  meeting can paste its link), then the client and the time like a visit.
- **Wording**: an ocular visit keeps every email and page as before. A meeting's emails, calendar
  invitation (summary "Planning meeting with Zion Events Place", location the place) and manage page
  name the meeting ("Your planning meeting is scheduled") and leave out the venue tour; a cancelled
  meeting does not offer "Schedule a new visit".
- **Changing or removing**: an appointment's chip opens it with the Front desk's own card (check in,
  reschedule, staff notes, cancel with a reason); the client gets the update or cancellation.
- **Reminders for staff**: besides the staff calendar copy, the bell shows "N appointments today"
  with the first one's time, new once each day; it opens the Calendar.

## Emails and calendars

| Job                                                       | To                                                    | When                                                                                                                                                               |
| --------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VISIT_SCHEDULED`, `VISIT_RESCHEDULED`, `VISIT_CANCELLED` | The visitor (when the visit has an email)             | With the change. `invite.ics` (the cancellation: `cancel.ics`) and the manage link. A confirmation not sent before the visit expires.                              |
| `VISIT_REMINDER_1D`, `VISIT_REMINDER_TODAY`               | The visitor                                           | Scheduled run from 07:00 Manila: the day before, and on the morning when the visit is at least an hour away. Not for a visit booked or moved in the last 12 hours. |
| `VISIT_STAFF_CALENDAR`, `VISIT_STAFF_CANCEL`              | Staff, and the inboxes whose calendars hold the visit | With every new or moved visit (`invite.ics`), and with a cancellation when a staff calendar holds the visit (`cancel.ics`). `Reply-To` is the visitor.             |

- The visitor's and the staff copies are one event: UID `visit-<id>@zion-events-place`, and the
  visit **revision** as `SEQUENCE`. The revision increases when the time changes and when the visit
  is cancelled, so every update replaces the earlier event.
- Job keys are `visit:<id>:<kind>:r<revision>`. A change skips the unsent emails of earlier
  revisions, and delivery skips a reminder or invitation whose visit moved or was cancelled since
  (`visitJobIrrelevance` in `lib/automation/visits.ts`); cancellations always go out.
- Staff calendar emails go to the staff inboxes of that moment plus the inboxes that already hold
  the event; a cancellation goes only to the inboxes that hold it, even if Settings changed since.
- The daily digest counts and lists today's visits.

## Data and privacy

- `zion_visits` (`prisma/visits.sql`, model `AdminVisit`): contact details, the time, status
  (`SCHEDULED`, `CHECKED_IN`, `COMPLETED`, `NO_SHOW`, `CANCELLED`), source (`WEBSITE`, `ZENI`,
  `STAFF`), the optional event details, staff notes, revision, consent time and outcome times. Row
  level security is on and the Supabase `anon` and `authenticated` roles have no access; a check
  constraint keeps status, source, times and guests valid.
- Manage links are signed, not stored: an HMAC of the visit id with `AUTH_SECRET`
  (`lib/signed-link.ts`, shared with the payment page). They are never indexed and never sent on as
  a referrer (`next.config.ts`).
- The public open-times endpoint (`GET /api/client/visits`) returns dates, times and places left,
  never who booked them.
- Abuse guards: a hidden honeypot field, cross-site requests refused, one upcoming visit per email
  (the message does not reveal its date), three website visits per email per day, thirty per hour
  site-wide, and five changes per visit per day from its manage link. Every change of time is
  serialized with the venue's booking holds and rechecked, so two visitors cannot take the last
  place.

## Install and operate

1. Install the table before deploying this code (the reminders and the digest read it):
   `npm run db:visits:check` checks, `npm run db:visits:check -- --apply` installs (a hosted
   database also needs `--allow-remote`). The SQL is additive and safe to run again.
2. Set the hours in Settings > Ocular Visits, and staff notification emails in Settings >
   Communications for the staff calendar copies.
3. Reminders run with the scheduled automation (see [automation](automation.md)); with the daily
   Vercel Cron at 08:00 Manila, the morning reminder reaches visits from 09:00 onward.

## Not included yet

- Signed-in client accounts that skip the form, and Turnstile on the visit page.
- Linking an appointment to the booking it is about, and times outside the visit hours for a
  meeting.
- A follow-up email after a no-show.

## Code

- Rules and vocabulary (browser-safe): `lib/visit-rules.ts`, `lib/visit-types.ts`
- Workflow (server): `lib/visits.ts`, `lib/visit-link.ts`, `lib/signed-link.ts`, `services/visits.ts`
- Routes: `app/visit/`, `app/visit/manage/[token]/`, `app/api/client/visits/` (GET open times,
  POST schedule), `app/api/client/visits/manage/`
- Admin: `lib/admin/front-desk.ts`, `components/admin/FrontDesk.tsx`,
  `components/admin/VisitRulesSettings.tsx`, `app/admin/(panel)/front-desk/`
- Emails: `lib/automation/visits.ts`, `lib/automation/visit-emails.ts`
- Tests: `lib/visit-rules.test.ts`, `lib/admin/visits.test.ts`
