# Optional client photos

Implemented 27 November 2026. It replaces Zion's manual process, where staff asked clients for a
picture during booking and kept it in an Excel file.

**The only purpose** is that staff know a client's face when they arrive for an ocular visit or
their event, and can welcome them by name without asking "Are you …?". It is not a bot check
(Turnstile, email checks and payment proof already do that), not proof of identity, and not face
recognition: no face matching of any kind, and photos are never sent to Gemini or any other AI
service. If staff are unsure at the venue, they ask for the booking reference.

The photo is optional. Booking requests and visit scheduling work exactly the same without it, and
nothing in this feature changes booking rules, statuses or payments.

## Where clients add a photo

Clients have no accounts (guest booking), so every place is a private page or link:

- **After a booking request** and **after scheduling an ocular visit**: an "Add your photo
  (optional)" step at the end of the confirmation (`components/client-photo/ClientPhotoCapture.tsx`).
- **The private payment page** (`/booking/pay/<token>`) and **the visit page**
  (`/visit/manage/<token>`), linked in their emails: add, change or remove the photo later.
- **The photo link** (`/photo/<token>`), sent when staff request a photo or a clearer one, and in
  the one reminder three days before the event or visit. It works for seven days.

The step explains why ("Add a photo so our team can recognize you and welcome you by name when you
arrive. Only Zion staff can see it. We delete it 30 days after your event, and you can remove it
anytime."; the number follows the retention setting), shows a separate unticked consent box ("I
agree that Zion staff may use this photo to recognize me when I arrive."), and saves nothing
without it. On phones "Take a selfie" opens the front camera; "Upload a photo" works everywhere.
The browser turns the photo upright, scales it to 1,600 px and re-encodes it as JPEG, so iPhone
(HEIC) photos work. A preview offers Retake and Use this photo, with tips (good light, no
sunglasses, masks or filters, only you). "Skip for now" is always there.

One photo is kept per client email address and reused for all of that client's bookings and visits.

## Where staff see photos

Photos appear only for roles with the `client-photos` action in `lib/admin/permissions.ts` (staff
who handle bookings, visits and the Front desk; today both Admin and Super admin). Other roles get
no photo data from the server at all.

- **Front desk, Today's arrivals** (the main place): today's events and ocular visits in time
  order, each with the photo (64 px), name, time, event and **Check in**. Checking in an event
  records only the arrival time (`zion_event_arrivals`); the booking's status never changes.
- **Booking page**: the photo beside the client's name in the header, and a **Photo** row in the
  Client panel next to the contact verification, with **Photo OK** and **Ask for a new one**.
- **Calendar**: the selected day's schedule (and Today and Coming up beside the month).
- **Dashboard**: the "Coming up at Zion" list. (The Today list in the redesign brief belongs to the
  dashboard redesign that was set aside, so the photos sit in the list the dashboard has.)
- **Front desk client lookup**: beside each booking and visit found.

Lists use 48 to 64 px photos; clicking one opens a larger view. Without a photo the initials show
with "No photo yet" and **Request photo**, which emails the client the photo link. Staff can also
remove a photo, or **take or upload one at the venue** (for example for a walk-in) after asking
the client and ticking the consent box.

## Privacy and security

- **Private storage**: the photo is kept in the private database table `zion_client_photos`
  (row-level security; the Supabase Data API has no access), like payment screenshots. It is shown
  only through `/api/client-photos/<token>`, a signed address the server makes for 15 to 30
  minutes (`lib/client-photo-link.ts`); an unsigned, changed or expired address is not found, and a
  changed or deleted photo makes earlier addresses stop working. Images are served inert and never
  cached.
- **Cleaned on the server** (`lib/client-photo-file.ts`): the real type is read from the file's
  first bytes (JPG, PNG or WebP; HEIC is explained), files over 10 MB and images too small to show
  a face are refused, and every photo is decoded and saved again by the server: turned upright,
  scaled to 800 px at most, re-encoded as JPEG and stripped of all metadata, including the location
  where it was taken.
- **No AI**: no photo or photo field ever reaches Gemini or any AI service, and there is no AI
  check of payment screenshots in this system. `lib/client-photos.test.ts` checks both.
- **Not in printouts or staff exports**: agreements, receipts, the Reports CSV and the settings
  export never include photos. The system has no client "download my data" (there are no client
  accounts); a client sees and can remove their own photo on their private pages.
- **Retention**: Settings → Privacy and retention, "Delete client photos after (days)", default 30
  (to confirm with Zion), counted from the day the client's last event or visit is completed or
  cancelled (or the photo was added, if later). The scheduled run (every 10 minutes on staging, with
  the daily Vercel cron as backup) deletes expired photos; there is no separate weekly job in this
  system. A photo the client removes, or one whose consent they withdraw, is deleted at once.
- **Activity log**: uploads, changes, deletions (by the client, by staff and by retention), reviews
  and photo requests are recorded under "Client photos", without the picture or the email address.

## Emails

Email only, because a text message cannot carry the private link (`lib/automation/client-photos.ts`):

| Event                   | When                                                                                                 | Can be switched off           |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------- |
| `CLIENT_PHOTO_REQUEST`  | Staff press Request photo                                                                            | No (staff sent it on purpose) |
| `CLIENT_PHOTO_RETAKE`   | Staff press Ask for a new one                                                                        | No                            |
| `CLIENT_PHOTO_REMINDER` | Once, three days before a confirmed event or a scheduled visit, from 7 a.m., while there is no photo | Yes (Automation page)         |

An email is not sent when the client has added a photo meanwhile (unless staff asked for a new
one) or the booking or visit has ended or was cancelled.

## Installing

Add the table before deploying code that uses it, with approval for the shared database:

```
npm run db:client-photos:check                                  # check only
npm run db:client-photos:check -- --apply                       # local database
npm run db:client-photos:check -- --apply --allow-remote        # staging, after approval
```

`prisma/client-photos.sql` is additive and idempotent: it creates `zion_client_photos` and
`zion_event_arrivals` with row-level security and changes no existing table or row. Until it is
installed, every page and form works as before and simply shows no photo step.

## Privacy notice section (ready to publish)

The public privacy page shows the notice published in the Developer Command Center (Content →
Privacy policy), and none is published yet. After Zion's review, add this section:

**Optional arrival photo**

- What we collect: a photo of you, only if you choose to add one, and the date you agreed to its
  use.
- Why: so our team can recognize you and welcome you by name when you arrive for an ocular visit
  or your event. It is not used to verify your identity, and we never use face recognition or send
  your photo to artificial intelligence services.
- Who can see it: only Zion staff who handle bookings, visits and the front desk. It is never
  public and is not included in printouts or exports.
- How long we keep it: until 30 days after your last event or visit with us is completed or
  cancelled. You can remove it, or withdraw your consent, anytime on your booking or visit page,
  and it is deleted right away.
- How we protect it: it is stored privately, cleaned of hidden data such as the location where it
  was taken, and shown only through short-lived private links.

## To confirm with Zion

- The retention period (default 30 days) and the privacy notice wording.
- Whether staff should also offer the photo step on walk-in bookings by default (today staff take
  it from the Front desk or the booking page when the client agrees).
