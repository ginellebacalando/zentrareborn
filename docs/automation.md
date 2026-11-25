# Built-in email automation

Zion Events Place sends its own emails. There is no external workflow service: the application
writes every notification to a database outbox, delivers it through Gmail SMTP with Nodemailer,
and runs reminders and a daily digest on a free scheduler (Vercel Cron, Supabase `pg_cron`, or
any machine that can run `npm run automation:run`).

Code: `lib/automation/` (server-only), `app/api/cron/automation/route.ts`,
`app/api/admin/automation/route.ts`, `app/admin/(panel)/automation/page.tsx` and
`components/admin/AutomationPanel.tsx`. Schema: `prisma/automation.sql`.

## How delivery works

1. **Outbox first.** The business change and its outbox row commit in the same database
   transaction (`zion_admin_outbox`). An inquiry can never exist without its notifications, and a
   rolled-back change never emails anyone. Each row has a unique `idempotencyKey`; enqueueing the
   same notification twice is a no-op (`INSERT … ON CONFLICT DO NOTHING`).
2. **Rendered once.** Subject, plain text, HTML and any calendar invitation are stored with the
   job, so a retry sends exactly the same message.
3. **Atomic claim.** A worker moves one due row from `QUEUED` to `PROCESSING` with a single
   `UPDATE … WHERE status='QUEUED' AND "nextAttemptAt" <= now RETURNING`. Concurrent runs (cron,
   `after()`, the admin button) can never send the same job twice.
4. **Result.**

   | Status            | Shown as | Meaning                                                                                                     |
   | ----------------- | -------- | ----------------------------------------------------------------------------------------------------------- |
   | `QUEUED`          | Waiting  | Saved; waiting for its next attempt, for mail settings, or for the daily limit. The reason is shown.        |
   | `PROCESSING`      | Sending  | A worker is sending it now.                                                                                 |
   | `ACCEPTED`        | Sent     | The mail server accepted it. It is never sent again. (Acceptance is not proof the recipient read it.)       |
   | `REVIEW_REQUIRED` | Failed   | Delivery stopped. Visible in the admin panel with a sanitized error and a **Retry** button.                 |
   | `EXPIRED`         | Skipped  | Deliberately not sent: no longer timely (old reminder or digest), superseded, or blocked by a safety limit. |

- **Retries:** temporary problems (timeouts, connection errors, 4xx replies) retry with
  exponential backoff of 2, 8, 32 and 128 minutes (capped at six hours), five attempts in total,
  then the job becomes `REVIEW_REQUIRED`.
- **Permanent rejections** (5xx replies, refused recipients) go straight to `REVIEW_REQUIRED`.
- **Sign-in problems** (wrong App Password) spend one attempt and stop the batch, so Gmail is not
  hammered with failed logins.
- **Gmail's daily quota:** the run stops at 450 accepted messages per rolling 24 hours (Gmail allows
  about 500) and continues later; a quota refusal from Gmail does not spend an attempt.
- **Interrupted sends:** a job still `PROCESSING` after ten minutes (for example a crashed
  function) may already have been delivered, so it becomes `REVIEW_REQUIRED` instead of being sent
  again automatically. Each message has a stable `Message-ID` per job.
- **Email not configured:** jobs stay `QUEUED` with the reason "Email is not configured"; nothing is
  reported as sent. They are delivered once `SMTP_USER` and `SMTP_PASSWORD` are set (time-limited
  jobs such as reminders and the digest expire instead of arriving late).
- **Retry from the admin panel** is allowed only for `REVIEW_REQUIRED` jobs. It gives the job three
  more attempts and tries once immediately. An `ACCEPTED` job cannot be retried.

## What is sent

| Job (`event`)                                                                                                                                                                                                               | To                                                          | Created                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Idempotency key                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `INQUIRY_STAFF_ALERT`                                                                                                                                                                                                       | Staff (see [Staff addresses](#staff-addresses))             | With the inquiry (contact form and booking page, via `lib/inquiry-service.ts`). Inquiries created elsewhere (the Zeni hand-off) are picked up by the next scheduled run.                                                                                                                                                                                                                                                                                                                                                                   | `inquiry:<inquiryId>:staff`                       |
| `INQUIRY_ACKNOWLEDGEMENT`                                                                                                                                                                                                   | The client                                                  | Same as above. Expires three days after the inquiry.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `inquiry:<inquiryId>:client`                      |
| `BOOKING_REQUEST_STAFF_ALERT`                                                                                                                                                                                               | Staff                                                       | With a booking request from the public booking page (`services/booking-requests.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `booking:<id>:BOOKING_REQUEST_STAFF_ALERT`        |
| `REQUEST_RECEIVED`, `REQUEST_APPROVED`, `REJECT`, `REVIEW_POLICY`, `RESERVATION_CONFIRMED`, `CANCEL`, `COMPLETE`, `CASH_RECEIPT`, `RECEIPT_VOIDED`, `HOLD_EXTENDED`, `HOLD_EXPIRED`, `PAYMENT_VERIFIED`, `PAYMENT_REJECTED` | The client                                                  | With the admin booking decision (`lib/admin/service.ts`) or the booking automation (`lib/admin/booking-automation.ts`, [docs/booking-automation.md](booking-automation.md)). A held date's notices state the amount and the payment deadline; `REQUEST_APPROVED`, `HOLD_EXTENDED` and `PAYMENT_REJECTED` link the client's private payment page while the date is held, and `PAYMENT_REJECTED` gives the staff reason. `RESERVATION_CONFIRMED` attaches `invite.ics`; cancelling a confirmed booking attaches a cancellation `cancel.ics`. | `booking:<id>:<event>:r<revision>`                |
| `EVENT_REMINDER_7D`                                                                                                                                                                                                         | The client                                                  | Scheduled run, five to seven days before a `CONFIRMED` event (not if it was confirmed in the last two days). Expires two days before the event.                                                                                                                                                                                                                                                                                                                                                                                            | `reminder:7d:<bookingId>`                         |
| `EVENT_REMINDER_1D`                                                                                                                                                                                                         | The client                                                  | Scheduled run on the day before the event (Manila calendar). Expires when the event starts.                                                                                                                                                                                                                                                                                                                                                                                                                                                | `reminder:1d:<bookingId>`                         |
| `HOLD_REMINDER`                                                                                                                                                                                                             | The client                                                  | Scheduled run, within 24 hours of a held date's payment deadline, unless the client heard about the deadline in the last 12 hours or a payment screenshot waits for review. Links the payment page. Expires at the deadline; skipped if the booking is no longer waiting for payment.                                                                                                                                                                                                                                                      | `hold-reminder:<bookingId>:<deadline>`            |
| `BALANCE_AFTER_EVENT`                                                                                                                                                                                                       | Staff                                                       | Scheduled run from 07:00 Manila the morning after a confirmed event that still has a balance (a fully paid one is completed instead). `Reply-To` is the client.                                                                                                                                                                                                                                                                                                                                                                            | `balance-after-event:<bookingId>`                 |
| `PAYMENT_PROOF_RECEIVED`                                                                                                                                                                                                    | The client                                                  | With a GCash or bank transfer screenshot from the client's payment page (`services/payment-proofs.ts`): what was received and that staff will verify it.                                                                                                                                                                                                                                                                                                                                                                                   | `payment-proof:<proofId>:client`                  |
| `PAYMENT_PROOF_STAFF_ALERT`                                                                                                                                                                                                 | Staff                                                       | Same as above: the method, amount, reference and date paid, with a link to Bookings. The screenshot itself is never attached. `Reply-To` is the client.                                                                                                                                                                                                                                                                                                                                                                                    | `payment-proof:<proofId>:staff`                   |
| `DAILY_DIGEST`                                                                                                                                                                                                              | Staff                                                       | First scheduled run after 07:00 Manila time. Today's and tomorrow's confirmed events, inquiries from the last 24 hours, requests under review, bookings waiting for payment and deadlines today, payment screenshots to verify, failed email count.                                                                                                                                                                                                                                                                                        | `digest:<YYYY-MM-DD>`                             |
| `STAFF_CALENDAR_PENDING`                                                                                                                                                                                                    | Staff and the inboxes holding the event, fixed when created | With every booking request (website or staff-entered), with an edit that changes a date or detail the event shows, and when a declined request is reviewed again, when a staff address resolves. Attaches the pending staff event (`invite.ics`, `STATUS:TENTATIVE`). Skipped if the request is no longer pending when it is sent.                                                                                                                                                                                                         | `booking:<id>:STAFF_CALENDAR_PENDING:r<revision>` |
| `STAFF_CALENDAR_REQUEST`                                                                                                                                                                                                    | Staff and the inboxes holding the event, fixed when created | With a reservation confirmation, when a staff address resolves. Attaches the staff copy of the confirmed event (`invite.ics`), which replaces the pending event. Skipped if the reservation is no longer confirmed when it is sent.                                                                                                                                                                                                                                                                                                        | `booking:<id>:STAFF_CALENDAR_REQUEST:r<revision>` |
| `STAFF_CALENDAR_CANCEL`                                                                                                                                                                                                     | The inboxes holding the event                               | With a declined request, a cancelled request or a cancelled reservation, when a staff calendar holds its pending or confirmed event. Attaches `cancel.ics`.                                                                                                                                                                                                                                                                                                                                                                                | `booking:<id>:STAFF_CALENDAR_CANCEL:r<revision>`  |

Reminders are prepared from 07:00 Manila time and are re-checked when sent: a reminder for a
booking that was cancelled meanwhile is skipped. Cancelling a confirmed booking also skips any
unsent confirmation, reminder or staff calendar email for it; confirming, declining or cancelling
a request skips its unsent pending event.

The staff calendar jobs use their own event names, so the `REQUEST_RECEIVED`,
`RESERVATION_CONFIRMED` and `CANCEL` rows that analytics, the dashboard and the notification bell
count stay one per decision. The Activity log lists them with the other automation jobs
(`AUTOMATION_ONLY_EVENTS`), not with the booking notices.

Abuse guards for the public form: at most three acknowledgements per address per day, and at most
40 individual staff alerts per day (further inquiries still appear in the admin inbox and the daily
digest). Acknowledgements never repeat the visitor's message, and greet by name only when the name
looks like a name. Staff alerts set `Reply-To` to the client so staff can answer directly.

Emails are simple branded HTML ("ZENTRA" over "Zion Events Place", deep green `#03422E` on white)
with a complete plain-text alternative. Colors live in `lib/automation/email-theme.ts`. Client
acknowledgements include the spam-folder notice from `lib/email-delivery.ts`.

### Calendar invitations

`lib/automation/ics.ts` writes RFC 5545 / RFC 5546 calendars: CRLF line endings, lines folded at 75
octets without splitting UTF-8 characters, escaped text, times in UTC (`…Z`), `DTSTAMP`, `SUMMARY`,
`DESCRIPTION`, `LOCATION` (the venue address from `config/brand.ts`), `ORGANIZER` (the venue's
contact address) and the client as `ATTENDEE`. The `UID` is stable per booking
(`booking-<id>@zion-events-place`). `SEQUENCE` is the booking revision, which increases with every
staff action, so a cancellation (`METHOD:CANCEL`, same `UID`, higher `SEQUENCE`) replaces the
confirmed event (`METHOD:REQUEST`). Nodemailer attaches it as `icalEvent`, which Gmail shows as an
invitation that can be added to the calendar.

The staff inboxes get their own copy of the same event (`STAFF_CALENDAR_PENDING`,
`STAFF_CALENDAR_REQUEST` and `STAFF_CALENDAR_CANCEL`): the same `UID`, `SEQUENCE` and `ORGANIZER`,
with each staff address as an `ATTENDEE` instead of the client. Its summary names the client and
the reference (for example "Wedding: Maria Santos (ZION-2026-…)") and its description lists the
client's contact details, package and guests. `Reply-To` is the client. The email links to the
matching Bookings view when the site's public address is known (`NEXT_PUBLIC_APP_URL`, `AUTH_URL`,
or on Vercel the production domain). The client's invitation is unchanged: clients get a calendar
invitation only when the reservation is confirmed.

Staff calendars see every booking request as soon as it arrives, so the owner sees requested
dates before deciding:

1. **Request.** The staff copy is a pending event: summary "[Pending] Wedding: Maria Santos
   (ZION-2026-…)", `STATUS:TENTATIVE` and `TRANSP:TRANSPARENT` (the time is not shown as busy). An
   edit that changes the date, time, client, contact, event, package or guests sends an update with
   the new revision, so the event moves in place.
2. **Confirmation.** The confirmed staff invitation reuses the `UID` with a higher `SEQUENCE`, so
   calendars replace the pending event with the reservation (`STATUS:CONFIRMED`,
   `TRANSP:OPAQUE`, no "[Pending]").
3. **Decline or cancellation.** A `METHOD:CANCEL` update removes the pending or confirmed event.
   Reviewing a declined request again sends a new pending event.

Because the attendees are written into the invitation, each staff invitation keeps the inboxes it
was created with. An update goes to the staff inboxes of that moment plus every inbox whose
calendar holds the event (`STAFF_RECIPIENT_LIMITS` still caps the list at 255 characters), and a
cancellation goes only to the inboxes holding the event, even if the staff list changed in
between. The holders come from the latest staff calendar email that was not skipped. An unsent
pending event or invitation that a newer change replaces is skipped, so it is neither sent late nor
counted as held; if nothing was ever sent, no staff cancellation follows. At delivery, a pending
event is skipped once its request is no longer pending, and a staff invitation is skipped once the
reservation is no longer confirmed, so neither puts a stale event back. A pending event for a
website request follows the daily limit of the staff alert it accompanies; over the limit, the
request appears in staff calendars when it is confirmed.

Requests created before this behaviour existed have no pending event; they appear when edited or
confirmed.

Calendar limits: Google Calendar adds an invitation by itself only for an address listed as an
`ATTENDEE`, and only as that account's "Add invitations to my calendar" setting allows; otherwise
the email shows the invitation with a button to add it. If a staff address is the organizer
address (`zioneventsplace@gmail.com`, `config/brand.ts`) or the sending account, Gmail may treat
the invitation as that account's own event and not as an invitation. Use a different staff inbox,
or check the result in that calendar.

## Setup

1. **Gmail App Password.** On the venue's Google account turn on 2-Step Verification, then open
   Google Account → Security → App passwords and create one (for example "Zion automation").
2. **Server environment** (never `NEXT_PUBLIC_`; see `.env.example`):

   | Variable                   | Value                                                                                                                                                                   |
   | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `SMTP_HOST`                | `smtp.gmail.com` (default)                                                                                                                                              |
   | `SMTP_PORT`                | `465` (default, implicit TLS); `587` uses STARTTLS                                                                                                                      |
   | `SMTP_USER`                | The full Gmail address                                                                                                                                                  |
   | `SMTP_PASSWORD`            | The 16-character App Password (spaces are ignored)                                                                                                                      |
   | `MAIL_FROM`                | `Zion Events Place <the same address>`; defaults to `SMTP_USER`                                                                                                         |
   | `STAFF_NOTIFICATION_EMAIL` | Fallback staff inboxes while Settings has none (comma-separated, up to five, 255 characters in total); defaults to `SMTP_USER`. See [Staff addresses](#staff-addresses) |
   | `CRON_SECRET`              | At least 32 random characters, for example `openssl rand -hex 32`                                                                                                       |
   | `NEXT_PUBLIC_APP_URL`      | Public origin for links in emails (optional; on Vercel the production domain is used when unset, so set it only for a custom domain)                                    |

3. **Database.** Install the admin schema first if needed (`npm run db:admin:check -- --apply`),
   then the automation schema:

   ```powershell
   npm run db:automation:check                       # check only
   npm run db:automation:check -- --apply            # local database
   npm run db:automation:check -- --apply --allow-remote   # Supabase, after approval
   ```

   `prisma/automation.sql` is additive and idempotent: it makes `zion_admin_outbox."bookingId"`
   nullable, adds `replyTo`, `html`, `calendar`, `calendarMethod`, `idempotencyKey` (unique),
   `maxAttempts`, `claimedAt` and `expiresAt`, adds a status check, creates the small
   `zion_automation_state` table, and enables row-level security with `anon`/`authenticated`
   access revoked. Existing rows and the booking history read by analytics are untouched. You can
   also paste the file into the Supabase SQL editor.

4. **Check.** Open `/admin/automation` (ADMIN or SUPERADMIN): it shows whether email and the cron
   secret are configured, and the staff addresses in use (partly hidden) with where they come from.
   `GET /api/health` reports the email and cron booleans plus queue and failure counts.

### Staff addresses

Staff alerts (`INQUIRY_STAFF_ALERT`, `BOOKING_REQUEST_STAFF_ALERT`), the daily digest and the staff
calendar invitations go to the first of these that has a valid address
(`lib/automation/recipients.ts`):

1. **Admin → Settings → Communications → Staff notification emails.** A super administrator enters
   up to five addresses separated by commas (255 characters in total). The browser and the server
   check them with the same rules as the outbox and the calendar writer (`lib/email-address.ts`).
   They are stored in `system_settings` under `admin.staffNotifications.emails`, are never part of
   the public settings, and the audit entry records only how many there are.
2. **`STAFF_NOTIFICATION_EMAIL`** on the server. The whole list must be valid; an invalid value
   stops staff email instead of falling back to the sending account.
3. **`SMTP_USER`**, the sending account.

A change applies to the next email. Staff alerts and the digest are addressed again when they are
sent, so ones still waiting go to the new list. A staff calendar invitation keeps the inboxes it
was created with (see [Calendar invitations](#calendar-invitations)). With no valid address, staff
alerts and the digest wait (rechecked hourly) and confirmations prepare no staff invitation.

## Scheduling

Any of these can run the automation; they can be combined safely because every step is
idempotent and every job is claimed atomically.

### Vercel Cron (daily)

`vercel.json` calls `/api/cron/automation` every day at 00:00 UTC (08:00 in Manila). The Hobby plan
allows one run per day and may start it any time within that hour. Add `CRON_SECRET` to the Vercel
project's environment variables; Vercel then sends `Authorization: Bearer <CRON_SECRET>`
automatically. With only the daily run, retries and Zeni hand-off notifications wait until the
next run (new inquiries and booking decisions are still sent immediately).

### Supabase `pg_cron` + `pg_net` (every 10 minutes)

Run once in the Supabase SQL editor. The URL and secret are read from Supabase Vault at run time,
so they never appear in the job definition. Use the same value as the app's `CRON_SECRET`.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store the endpoint and the secret in Vault (replace the placeholders).
select vault.create_secret('https://YOUR-DOMAIN/api/cron/automation', 'zentra_automation_url');
select vault.create_secret('PASTE-THE-CRON_SECRET-VALUE', 'zentra_cron_secret');

select cron.schedule(
  'zentra-automation',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'zentra_automation_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'zentra_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) as request_id;
  $$
);
```

Inspect with `select * from cron.job_run_details order by start_time desc limit 20;` and
`select * from net._http_response order by created desc limit 20;`. To rotate the secret, update
it in Vault (`vault.update_secret`) and in the app environment together. Remove the job with
`select cron.unschedule('zentra-automation');`.

### Command line

`npm run automation:run` performs one full run (prepare reminders/digest, pick up Zeni inquiries,
deliver due jobs) using `.env.local`, and prints counts only. Any scheduler that can run a command
(for example Windows Task Scheduler on an always-on computer) can call it.

### The cron endpoint

`GET` or `POST /api/cron/automation` with `Authorization: Bearer <CRON_SECRET>`. The comparison is
constant-time; without a configured secret (at least 32 characters) every request gets `401`. The
response contains counts only, never addresses or message content. Each run processes up to 40
jobs within about 45 seconds; anything left is handled by the next run.

## Admin and developer views

- **Admin → Automation** (`/admin/automation`, ADMIN and SUPERADMIN): configuration booleans, the
  staff addresses in use (masked, such as `o***@gmail.com`) and whether they come from Settings,
  `STAFF_NOTIFICATION_EMAIL` or the sending account, last scheduled run, counts by status, the 50
  most recent emails (type, masked recipient such as `j***@gmail.com`, status, attempts, next
  attempt, sanitized error), **Retry** for failed emails and **Run due jobs now**. Actions are
  audited under the Notifications module. The System Logs page keeps its notification outbox and
  lists automation jobs where the old workflow history was.
- **Admin → Settings → Communications:** the staff notification emails (see
  [Staff addresses](#staff-addresses)). Every administrator can read the list; only a super
  administrator can change it.
- **Developer Command Center → Automation:** read-only booleans and counts by status.
- **`/api/health`:** `emailConfigured`, `cronConfigured`, queued and failed counts. No personal data.

## Testing

`npm run test:automation` runs `lib/automation/ics.test.ts` (calendar output and a real Nodemailer
MIME render without a network) and `lib/automation/automation.test.ts` (an isolated PGlite database:
idempotency, atomic claims under concurrency, backoff, permanent/sign-in/quota failures,
interrupted and expired jobs, the daily limit, the "not configured" path, inquiry enqueue through the
public route without any HTTP call, the Zeni sweep, booking confirmation and cancellation
invitations for the client and the staff, the staff address order (Settings, then
`STAFF_NOTIFICATION_EMAIL`, then `SMTP_USER`), reminders, the digest, masking, health and cron
authorization). `npm run test:admin` covers saving, validating and auditing the staff notification
emails. Tests never contact a mail server. Preview harnesses blank all mail settings so they cannot
send real email.
