# Zion Events Place — private admin workspace

## Scope and preservation

Local development and production-start commands are pinned to port 3001. Open
`http://localhost:3001/admin`; local auth and public/developer origins use that port.

The staff panel is available at `/admin`. Its sidebar contains Dashboard,
Booking, Contract, Calendar, Inquiries, Payment, Services & Packages, Analytics,
and Team, in that order,
with System Logs immediately above Settings at the bottom. Logout is available only as
Sign out in the profile menu. The menu scrolls independently on short screens
so both bottom links remain visible. The notification bell and admin profile stay
at the upper right inside a fixed header, with a 10px gap between their
control groups (8px on mobile). The header shows the current page name only while
the desktop sidebar is collapsed or the mobile drawer is closed.
Settings appears only in the sidebar; the profile dropdown contains My Profile
and Sign out. The admin footer and its copyright/workspace/timezone/currency text
are removed.
The notification bell sits to the left of the admin account. Its panel
shows live summaries of pending requests, unanswered inquiries, flagged requests,
delivery issues, and owner policy review, with links to the relevant modules.
The bell's and the Messages envelope's numbers count only what came in since that
admin last opened them (see [Header numbers](#header-numbers--27-november-2026));
no fabricated notification history is shown. Updates refresh every minute
and when the bell is opened. The account control follows the old ZenTra design:
a flat taupe circular photo/initial avatar, separate round chevron control, and a
compact dropdown showing a larger avatar, truncated name and email, warm brown
role label, My Profile link, and a separated red Sign out action.
Both popovers support Escape, outside-click dismissal, and narrow screens.
The Profile page also follows the old layout with a branded identity card,
taupe avatar and role badge, contact details, and a separate security card.
It uses the current profile fields and save workflow; the account controls refresh
after an account detail change.
System Logs is a standalone sidebar destination at `/admin/logs`, immediately above
Settings, with its own active state. The old `/admin/settings/logs` bookmark redirects
to it after the existing access checks. Settings contains only its settings content,
without section tabs linking to Logs. The log activity filters, pagination, notification
outbox, and automation job history remain separate from the main settings forms.
Automation (`/admin/automation`) shows email and scheduler configuration, the staff notification
addresses in use (masked, with whether they come from Settings, `STAFF_NOTIFICATION_EMAIL` or the
sending account), delivery counts, recent emails with masked recipients, Retry for failed emails
and "Run due jobs now"; see [the automation guide](automation.md).
Only the current sidebar destination is selected. Inquiries
shows received business inquiries, Analytics shows real booking and cash aggregates,
and Team provides a read-only directory of administrator accounts.

The sidebar header follows the old ZenTra layout: a compact full organization logo,
the stacked name "Zion Events Place" and "Admin Panel", and an adjacent toggle.
The logo is 48px square, with balanced insets and spacing so the full name and
toggle remain clear; it is centered in the collapsed rail. The logo/brand remain in the sidebar.
Dashboard uses its original content gutters again, matching the other pages.
The mobile drawer retains its logo, with sufficient space for the separate menu/account controls.
The mobile menu trigger stays fixed in the header, with a clear surface behind it
even when page content scrolls underneath. Its Close control stays above the drawer.
Its 20px panel-and-arrow icon has no background, border, or button shadow, while
retaining a 44px click target. The divider slides and
the arrow rotates when opening or closing, with hover and press feedback.
On desktop, the toggle smoothly reduces the sidebar to an 80px rail showing
the logo, page icons, and Settings icon. Labels fade out; accessible names and hover
titles identify the links. In the compact rail, the 44px expand button sits over
the organization logo and appears when the pointer hovers over that logo.
The logo fades away during the reveal so the plain icon remains clear.
Keyboard focus also reveals it; devices without hover keep it visible for tapping.
The logo's dashboard link is hidden from keyboard and assistive navigation while
the expand button occupies its place. Expanded and mobile toggle behavior is retained.
The attached extension and its 3D/jelly effects are removed. Sidebar icons reuse the exact old ZenTra
PNG masks for Dashboard, Booking, Calendar, Inquiries, Analytics, and Settings,
and the same Flaticon glyphs for Contract, Payment, and Team.
The sidebar uses Pale Oak (`#E3CAA5` via `--palette-admin-oak`) in light mode, alongside the main
`#F5EFE1` page canvas, establishing a clear visual distinction between the navigation sidebar and the workspace background. The header uses a softly tinted inset surface, rounded card frame and restrained shadow. The selected nav row uses the canvas background (`--admin-surface-page`)
to bridge seamlessly into the main content area, with rounded left ends and inverse curves on the right.
The sidebar retains its rounded outer right corners.
Settings uses the same selection shape; compact rails keep the curves. Dark mode
uses `--palette-admin-night-card` (`#302622`) for the sidebar over the `--palette-admin-night` (`#211916`) canvas,
maintaining readable navigation text and clear surface separation in both themes.
The mobile dismissal backdrop blurs the underlying page so its text does not
compete with the open menu.
Existing labels, order, icons, and destinations remain in place.
The main heading and selected sidebar link identify the current page in both sidebar states;
the header adds the page name when the sidebar is collapsed.
The repeated "Zion Events Place" caption above admin page titles and on the login
page is removed; the organization branding remains in the sidebar.
The dashboard greets the signed-in administrator by name with Good morning,
Good afternoon, or Good evening in the configured system timezone, refreshing
every minute and when the window regains focus. A short purpose sentence below it
reads: "Track revenue, bookings, upcoming events, and pending inquiries in one place."
On mobile,
the full drawer, focus handling, and reduced-motion support still apply.

The current public client design, navigation, contact flow, published terms, services, and removed public features are preserved. Only the root chrome bridge hides the public header/background/footer inside `/admin`. No public booking form, online payment gateway, assistant, or public admin link was restored. Prior image organization and branding edits were not repeated or overwritten.

## Roles, team and access — 26 November 2026 (night)

The existing roles stay: **SUPERADMIN** (shown as Super admin) is the top role and **ADMIN** the
daily-work role; CLIENT never reaches the panel. No second role system was added. What each role
may open or do is defined once, in `lib/admin/permissions.ts` (`PAGE_ACCESS`, `ACTION_ACCESS`),
and both the interface and the server read it.

| Area                                                                                      | Admin | Super admin |
| ----------------------------------------------------------------------------------------- | ----- | ----------- |
| Dashboard, Bookings, Front desk, Calendar, Contracts, Inquiries, Live chat, Zeni, Reports | Yes   | Yes         |
| Payments: record cash, verify or reject payment screenshots                               | Yes   | Yes         |
| Packages: view                                                                            | Yes   | Yes         |
| Packages: create and edit categories, packages and prices                                 | No    | Yes         |
| My profile: name, contact number, password                                                | Yes   | Yes         |
| Team: invite admins, change roles, disable or enable accounts                             | No    | Yes         |
| Automation (switches, run due jobs, retry), Activity log, Settings                        | No    | Yes         |
| Void a receipt (refund correction), export data (Reports CSV, activity log CSV)           | No    | Yes         |

- **Hidden and enforced.** An Admin's sidebar, buttons and page sections leave out what the role
  cannot use (`AdminRoleContext.tsx`). The server checks every page (`lib/admin/page-access.ts`
  calls `forbidden()`, which shows "You don't have access" with HTTP 403; `experimental.
authInterrupts` in `next.config.ts`), every API section and operation
  (`assertSectionAccess`, `assertAccess` in `lib/admin/guards.ts`) and the dedicated routes
  (automation, settings export, notifications, Zeni, live chat, payment proofs, receipts). Blocked
  requests return 403.
- **Team page** (`TeamPanel.tsx`, `lib/admin/team.ts`): a super administrator invites by name,
  email and role. The invitation email (outbox event `TEAM_INVITATION`, always on) carries a link
  that works once, for 3 days, for that address (`/admin/invitation/<token>`, a hashed token of
  type INVITATION); the person sets a password of at least 12 characters there. Invitations can be
  resent. Roles change from the table after a confirmation; accounts can be disabled and enabled.
- **Guards.** Nobody changes their own role or disables themself; the last active super
  administrator can never be demoted or disabled (HTTP 409). A role change or disable ends that
  person's sessions at once, so the new access applies on their next request.
- **Audit.** Invitations, resent invitations, activations, role changes and account status changes
  are recorded in the Activity log (module Team).
- **Profile.** Admins keep managing their own profile and password from the profile menu.
  Two-factor sign-in exists only for the developer panel; adding it for admin accounts needs a
  schema change and is not part of this work.
- **Tests.** `lib/admin/rbac.test.ts` checks the permission table, that every super-administrator
  section and operation refuses an Admin, and the invitation, guards, session ending and audit in an
  isolated PostgreSQL database.

## Calm redesign — 26 November 2026

The admin now follows [the admin design system](admin-design.md): the calm layout of the Metis
template in the ZENTRA colours. This supersedes the look described in the 25 November section below
(filled green current page, teal KPI cards, uppercase labels, dark "This month" list).

- **Sidebar groups (routes unchanged):** Dashboard; Events: Bookings, Front desk, Calendar,
  Contracts, Payments; Clients: Inquiries, Live chat, Zeni; Business: Packages, Reports, Team;
  pinned footer: Automation, Activity log, Settings.
- **Page headers:** every page shows its title; descriptions that restated the page were removed.
- **Dashboard:** white KPI cards with icon tiles, one "Bookings this month" card with the four
  display statuses, then trends.
- **Bookings:** a highlighted banner with the requests that need a decision, status pills with
  counts, simplified cards, and table rows that open the booking on click.

## ZENTRA redesign — 25 November 2026

The admin follows the team's Figma frames (ADMIN / SUPERADMIN POV, BOOKING, CALENDAR, REPORT) inside the
existing left sidebar, which the team preferred over Figma's top tabs. This section supersedes the
color and header descriptions in the older sections below, which are kept as history.

- **Look:** white surfaces, deep green `#03422E` actions and active states, `#D9D9D9` hairlines, teal
  KPI cards and charts, uppercase letter-spaced labels; the header shows the ZENTRA wordmark with
  "Admin dashboard", a theme toggle, notifications, messages and the account menu. Tokens live in the
  admin block of `styles/tokens.css`; the dark theme uses the ZENTRA night palette.
- **Labels (routes unchanged):** Dashboard, Bookings, Contracts, Calendar, Inquiries, Live chat
  (`/admin/live-chat`), Payments, Packages
  (`/admin/services`), Zeni (`/admin/zeni`), Reports (`/admin/analytics`), Team; footer: Automation
  (`/admin/automation`), Activity log (`/admin/logs`), Settings.
- **Booking display status** (`lib/admin/dashboard-status.ts`): Request = requested and awaiting approval;
  Pending = approved, not yet confirmed; Confirmed = confirmed or completed; Cancelled = cancelled or
  rejected. Status always shows a text label with its color (yellow, blue, green, red).
- **Bookings:** status bar with counts and a filter, Table (default) / Cards toggle; each booking opens on
  its own page (`/admin/bookings/[reference]`, docs/admin-design.md "Booking page") with the client, event,
  payment summary and only the actions the state machine allows.
  **Edit details** (op `edit-booking`) is available for requested bookings without an issued or signed
  agreement and needs a reason. A changed email or phone sends the contact back to verification (a
  flagged contact stays flagged); changed schedule, package, guests, amounts, event type, payment rule or
  contact details return an approved request to pending. Edits are audited and send no email. Confirmed
  bookings are cancelled and re-created instead.
- **Calendar:** month grid with today as a solid green square, status dots, and a dark "This month" list.
- **Dashboard/Reports:** performance overview status cards, teal KPI cards with trend lines, bookings trend.

## Website booking requests and website activity — 25 November 2026

- **Booking requests from the public site** (`POST /api/client/booking-requests`,
  `services/booking-requests.ts`) are saved as admin bookings with status **Request** (approval pending,
  nothing reserved), created by `website` (`config/booking.ts`). Each one writes the bookings CREATE audit
  entry the dashboard reads (`sourceInquiryId: null`, `channel: website`), an in-app notification, and
  two outbox emails: the client acknowledgement (`REQUEST_RECEIVED`) and a staff alert
  (`BOOKING_REQUEST_STAFF_ALERT`, sent to the staff notification emails from Settings, else
  `STAFF_NOTIFICATION_EMAIL` or `SMTP_USER`). The server checks
  the date window, booked dates, times, guest count, published package, consent and a honeypot, and limits
  requests to three per email per day and thirty per hour. Website requests follow the "Client inquiries"
  on/off switch in Settings. Staff then approve, decline, edit or confirm them as usual.
- **Website activity** (dashboard, `components/admin/WebsiteActivity.tsx`, `lib/admin/website-activity.ts`,
  read through `/api/admin/website-activity`): the newest website booking requests, inquiries and Zeni
  hand-offs, testimonies awaiting review and questions Zeni could not answer, merged newest first (12
  items), with status, relative time and a link to the matching section. It refreshes every 60 seconds
  while the tab is visible and on focus, never moves keyboard focus, and returns no email addresses,
  phone numbers, messages or comments.

## Optional client photos — 27 November 2026

Clients may add a photo so staff recognize them when they arrive; it replaces the old practice
of keeping pictures in Excel. Staff see it in the Front desk's **Today's arrivals** (with Check in
for events and visits), on the booking page, in the Calendar's day schedule, in the dashboard's
"Coming up at Zion" and in the client lookup, and can request, review, take (with consent) or
remove it. Only roles with the `client-photos` action see photos. Photos are private, cleaned of
hidden data, never sent to AI, and deleted after the retention period in Settings → Privacy and
retention (default 30 days, to confirm with Zion). See [Client photos](client-photos.md).

## Header numbers — 27 November 2026

The bell's and the envelope's numbers used to count everything still open, so they never went
away. Now each counts only what is new to that admin:

- **Bell**: notices with something that arrived since this admin last opened the bell: a booking
  request, a payment screenshot, an inquiry or, for super administrators, an email whose delivery
  stopped (its last attempt counts). The policy review counts until the first look. Opening the
  bell clears the number and marks those notices **New** while the panel stays open; the panel
  reads the counts at that moment, so anything that arrived since the last refresh shows too.
  Confirmations, cancellations, payments, contract changes and flags are the team's own records:
  they stay in the list for 24 hours but never raise the number, so nobody's own work rings their
  bell.
- **Messages** (envelope): open inquiries received since this admin last opened Messages. Opening
  Inquiries any way (envelope, sidebar, a link) clears it, because the list loads fresh then. An
  inquiry that arrives while the page stays open keeps its number until the envelope is used,
  which reloads the list.
- **Mark all as read**: in the bell panel's footer while something is marked New; clears both
  numbers. Nothing has to be marked one by one.
- The lists do not change: pending requests and unanswered inquiries stay until the work is done.
  Each admin has their own numbers, so one person's look does not clear them for the others. A
  notice type turned off in Settings › Notifications leaves the list and the numbers.
- **Storage**: `zion_admin_notification_seen` (`prisma/admin-notification-seen.sql`), one row per
  admin with the times they last opened the bell and Messages, removed with the account. Install
  with `npm run db:notification-seen:check -- --apply` (`--allow-remote` for a hosted database).
  Until it is installed the header counts everything still open, as before.
- **Code**: the rule in `lib/admin/header-numbers.ts` (browser-safe, so a number clears at once),
  `lib/admin/notification-seen.ts`, `readNotificationSummary` in `lib/admin/service.ts`,
  `POST /api/admin/notifications/seen` (`bell`, `messages` or `all`; it replies with the summary
  as of the look) and `components/admin/AdminAccountControls.tsx`. Tests:
  `lib/admin/notification-seen.test.ts`.

## Contracts — 27 November 2026 (night)

The contract follows Zion's own (event details and inclusions, an acknowledgment of the payments,
the terms, the signatures) on the ZENTRA letterhead, as a page that prints or saves as PDF.

- **Where it goes**: nowhere outside the panel. It stays with its booking (Agreements tab, and the
  Contracts list) and is not emailed. Staff print it; the client signs the paper copy at Zion.
- **Steps** (booking page › Agreements): once the booking is **confirmed** (its reservation fee
  recorded), **Generate contract** saves version 1 as a draft. **Open contract** shows it to print
  or save as PDF. **Issue for signing** marks the checked draft final. After the client signs,
  **Record signature** saves who signed and where the signed copy is filed. A booking change after
  generating marks the contract as made "before the booking's latest change"; **Generate updated
  contract** saves the next version and earlier ones fold away under "Earlier versions".
- **What it shows**, frozen when generated so later edits never change a printed or signed copy:
  1. Event details: client, event, date and time, guests, package, venue, check-in and check-out
     (from the catalog package), email and phone.
  2. Package inclusions: the catalog package with the booking's package name (the booklet's parts
     and their points); a custom proposal says the inclusions are as agreed.
  3. Contract amount and payments: the price with the guests it covers and the fee per extra
     guest, every payment not voided (acknowledgment number, date, method, amount), total paid,
     balance and its due date (Settings › Booking automation; "immediately" when generated after
     it), and Zion's acknowledgment line.
  4. Terms and conditions: the reviewed venue policy's terms with its version, laid out as groups,
     numbered clauses and points (`termsOutline`); a policy saved without terms gives Zion's
     published Terms page instead.
  5. Signatures: Zion's signatory and the client, each with a line, the printed name and a date.
- **Signatory**: Settings › Contracts ("Signed for Zion by" and a title), stored in the system
  settings (`admin.contractSignatory`). Until it is changed, the name on Zion's own contract.
- **Page**: `/admin/contract/[id]` for everyone who may open Bookings, outside the panel frame so
  only the paper prints: A4, the contract number and "Page x of y" in each page's footer, and the
  same light paper in every theme. In the print window, Save as PDF downloads it; the file is
  named after the contract.
- **Storage**: the snapshot is JSON (`zentra-contract/1`) in the existing
  `zion_admin_contracts.body`, so nothing in the database changed. Contracts prepared before this
  keep their text and print as written.
- **Code**: `lib/admin/contract-document.ts` (snapshot type, reader, terms layout),
  `lib/admin/contract-snapshot.ts` (what generating reads), `create-contract` in
  `lib/admin/service.ts`, `app/admin/contract/[id]/` and `components/admin/BookingAgreements.tsx`.
  Tests: `lib/admin/contract-document.test.ts` and the contract steps in
  `lib/admin/integration.test.ts`.

## Front desk and ocular visits — 25 November 2026

- **Front desk** (`/admin/front-desk`, `app/admin/(panel)/front-desk/page.tsx`,
  `components/admin/FrontDesk.tsx`, `lib/admin/front-desk.ts`, any signed-in staff account; in the
  sidebar after Bookings): today's events and ocular visits, earlier visits without an outcome, the
  next two weeks of visits, **Schedule a visit** for a caller, and a **client lookup** by email,
  phone or name with the client's bookings and visits. Visit actions follow the state: check in on
  the day, mark completed, no-show after the start time, reschedule, notes (staff only), cancel with
  a reason, and **Start booking**, which opens the walk-in booking filled from the visit. Changes
  are logged under the module "Front desk"; the page
  refreshes every minute and keeps focus on the visit (or on the confirmation when the visit leaves
  the list).
- **Walk-in booking** (`/admin/front-desk/walk-in`, `components/admin/WalkInBooking.tsx`,
  `lib/admin/walk-in.ts`): four steps (client, event, consent, payment) with the website's packages,
  prices and rules; cash now confirms the booking when it meets the policy, otherwise the date is
  held or the request waits for review. Staff may approve an event above the guest limit with a
  logged reason. See [docs/walk-ins.md](walk-ins.md).
- **Calendar** (`components/admin/BookingCalendar.tsx`): the month's ocular visits appear beside
  the events, marked with a hollow square (the booking dots are round) and listed with their status;
  they are managed on the Front desk.
- **Settings > Ocular Visits** (`components/admin/VisitRulesSettings.tsx`): the weekly hours, the
  length of a visit, visits at the same time, the website's notice and closed dates, checked on save
  with the problem under its field.
- Visitors schedule on `/visit` and change or cancel through their private link. Emails, reminders,
  data and limits: [docs/visits.md](visits.md). **Database:** `prisma/visits.sql`;
  `npm run db:visits:check -- --apply` installs it (a hosted database also needs `--allow-remote`
  after approval).

## Live chat — 25 November 2026

When a visitor asks Zeni for a person, a staff member can join the same Zeni conversation and hand the
visitor back to Zeni afterwards. The visitor side and the rules are described in
[the Zeni guide](chatbot.md#live-chat-with-staff).

- **Live chat page** (`/admin/live-chat`, `app/admin/(panel)/live-chat/page.tsx`,
  `components/admin/LiveChatPanel.tsx`, API `app/api/admin/live-chat/route.ts`, any signed-in staff
  account): switch on **Available for live chat** to receive visitors; the hint says who else is
  available. The queue lists **Waiting** (oldest first, with how long they have waited), **In progress**
  (with who took it) and **Earlier this week**. A chat shows what the visitor told Zeni, every message
  and **Take this chat**. The staff member who takes it replies (Enter sends, Shift+Enter adds a line,
  four quick replies), can note what was agreed (staff only), then chooses **Return to Zeni** or
  **Close chat**. A chat can be taken once; other staff can read it but not reply.
- **Alerts on every admin page** (`components/admin/useLiveChatAlerts.ts`, `AdminShell.tsx`): the
  Live chat item shows the number of waiting visitors, the browser tab title gains "(n)", screen
  readers hear "A visitor is waiting in live chat.", and a short two-note chime plays unless **Sound
  alerts** is turned off on the Live chat page (remembered in that browser). The check runs every 15
  seconds and also keeps the staff member available; availability lapses 90 seconds after the last
  admin page check.
- **Timing** (`lib/chatbot/live-chat.ts`): a waiting chat nobody takes within 5 minutes is marked
  missed and the visitor is offered the email hand-off, which arrives in Inquiries; an active chat with
  no message for 20 minutes returns to Zeni.
- **Database:** `prisma/live-chat.sql`; `npm run db:live-chat:check` checks it and
  `npm run db:live-chat:check -- --apply` installs it (a hosted database also needs `--allow-remote`
  after approval).

## Admin color theme

Admin page controls use a 16px radius derived from the shared card token, scoped
to the content area. Buttons and fields retain their 44px targets, persistent
labels, visible focus and disabled states. Cards/filter/settings/report panels use
a restrained shadow from the approved admin ink role. Circular account controls,
the plain sidebar toggle and navigation curves keep their existing shapes.

The fixed admin header follows the user's rounded inset-container reference. It
sits 16px from the top/right/sidebar on desktop and 8px from the viewport edges on
mobile, with a 20px outer radius, 4px semantic card frame and softly tinted inner
surface. Existing account controls and collapsed-page identification remain; no
sample search/mail controls were added. Header heights remain 70px/62px.
Where supported, a separate background layer combines a 94% tint with 16px blur;
the opaque fallback uses the same semantic surface. Keeping the filter on that
layer preserves viewport positioning for mobile popovers. Main-content top spacing
is 110px desktop/94px mobile; scroll clearance is 102px/86px. Controls and opened
menus remain above page features. Mobile popovers and the drawer start at 78px,
with bounded heights and scrolling within the viewport.
The sidebar, drawer and dismissal backdrop remain above the header; native dialogs
keep their browser top layer and focus behavior. No recurring animation is added;
the existing reduced-motion guards also disable the header's sidebar-resize transition.

The four Dashboard cards show current-year secured contract sales, unresolved
inquiries without secured bookings, all future confirmed bookings, and all-time
confirmed/completed bookings. Each includes a dated comparison, numeric change
and direction. Pending growth describes review workload. Missing confirmation or
inquiry attribution history is disclosed rather than treated as a reliable zero.
See [the Dashboard KPI contract](dashboard-kpi-contract.md) for exact scopes.
The overview order and exact visible labels are Total Revenue, Total Bookings,
Upcoming Events, Pending Inquiries. Total Revenue uses Soft Peach (`#FFE1AF`,
`--admin-peach`) with dark ink in both themes. The other cards use white surfaces
(semantic dark surfaces in Evening Gala), muted labels, 24px semibold Inter totals,
small arrow/percentage pills. Comparison sentences and the native Comparison
details disclosure are removed from the visible overview.
Large sales totals (at least PHP 10,000) and changes use the existing compact
formatter. Exact PHP values, comparison dates and definitions remain in accessible
card names and visually hidden static content, with no invisible keyboard controls. Green pills indicate
increased sales/bookings or fewer unresolved inquiries; neutral pills describe
other changes. All directions also use arrows and signed numbers.
The Analytics module continues to report receipt-based cash income separately.

The user-approved palette is defined in `styles/tokens.css`: Ivory Mist (`#FFFBE9`),
Pale Oak (`#E3CAA5`), Soft Peach (`#FFE1AF`), Dusty Taupe (`#AD8B73`), and Dusty Rose
(`#B77466`). Admin components use the `--admin-*` semantic roles; their light/dark
switch is scoped by `data-admin-theme`, preserving the other surfaces' foundations.

The light page canvas uses `#F5EFE1` via `--palette-admin-canvas`; light cards carry
the longer forms, lists, and tables. The sidebar uses its own
`--admin-surface-sidebar` role: Pale Oak (`#E3CAA5`) in light mode and
warm charcoal card surface (`#302622`) in dark mode, ensuring visual separation from the page canvas in both themes.
Analytics summary cards use oak, peach, taupe, and rose in that order. The Dashboard
summary now follows the user's neutral card reference and reuses the existing
success palette for favourable badges. Oak/peach appear in section states, table headings, and notices; taupe
and rose are restrained accents for avatars, notifications, and state feedback.
Primary actions use a dark warm neutral with readable ivory text. All four summary
colors use dark ink rather than low-contrast white labels. Dark mode uses warm
charcoal surfaces with the same palette accents. Existing content and workflows
are retained; the reference charts and business figures are not demonstration data.

The design gate checks the admin's semantic text, focus, control-border, status,
and summary-card color pairs in both themes, alongside the existing shared checks.
Rendered blends, keyboard behavior, responsive layout, and theme states also need
contextual browser review; those checks are recorded in the design change log.

## Admin controls and page layout

The administrator pages share scoped controls, readable opaque placeholders,
44px control targets, visible focus, quieter secondary actions and spaced cards.
Control borders derive from the approved admin semantic palette; the existing
warm light/dark themes and fonts remain the foundation. Motion is limited to
brief control feedback, with reduced-motion rules covering pseudo-elements too.

Booking, payment, contract and calendar searches keep their existing scope.
Optional status/date filters sit in a keyboard-accessible disclosure with an
active count and a visible applied-filter summary. Booking forms separate client,
event and agreement details using fieldsets. Mobile booking registers use labeled
cards with independent approval, reservation and payment states. Team uses a
responsive directory. Receipts use readable cards; correction forms and secondary
agreement details can be expanded when needed. Payment/contract views open their
relevant booking detail section. Existing role and server validation remain in force.

Advanced Settings sections use native disclosures. Required owner policy review
remains prominent. Theme choices include a visible selected checkmark. Dashboard
and Analytics favor charts, short labels, totals, arrows and percentages. Their
explanatory paragraphs, comparison sentences and chart-data disclosures are removed
from view. Exact data tables and calculation definitions remain available to
assistive technology as static content; Analytics CSV export and data definitions
are preserved. Quality/error/loading notices remain visible. The all-time Analytics
breakdown uses labelled proportional bars rather than a text-heavy disclosure.

Catalog editors keep native modal semantics, visible labels, focus containment,
Escape/Cancel return focus, and a logical return target after a successful save.
Server errors retain values and receive focus at the top of the editor. Booking
review similarly focuses its heading and returns to the opener, with search as a
fallback when that opener is no longer present. No new booking, payment channel,
automatic approval, model or notification workflow is introduced by this UI change.

## Dashboard charts

The dashboard includes a grouped bar chart of booking requests and business inquiries,
an extruded donut/pie chart of current reservation statuses, and a cash-collection area
trend. Faceted bars, layered donut walls, and a shallow area extrusion provide the
requested 3D appearance using the existing warm palette. The charts use native SVG;
there is no external chart service or new rendering dependency.

The Chart period control switches the activity and cash charts between the last six
and twelve calendar months, including the current month through the response time.
Month boundaries use Asia/Manila. Requests use their recorded date; inquiries use
submission date; cash uses receipt date and excludes voided or future-dated receipts.
The reservation mix is explicitly all-time and reflects each request's current status.
Receipt-based cash remains distinct from Dashboard's annual secured-contract sales.

Update, 26 November 2026: the charts are drawn with Chart.js (see
[admin-design.md](admin-design.md), Charts), and the dashboard no longer shows the reservation mix;
Reports keeps the same all-time split as "Reservation status".

The authenticated dashboard response includes only aggregate chart values from
`lib/admin/dashboard.ts`. Missing months are zero-filled; empty charts show an honest
zero-data state. No sample values are inserted into the venue database. Every chart
has a static exact-value table available to assistive technology, an accessible summary,
and visible essential labels. There are no hidden focusable table-disclosure controls.
Charts reflow at 320px and use the existing light/dark roles. Depth is static, with no
automatic movement, rotation, or dependency on animation to read the data.

## Business analytics

Analytics includes weekly, monthly, quarterly, and yearly reports with a date
selector, previous/current/next period controls, aggregate CSV export, and an
income/booking trajectory indicator. It compares actual non-voided cash receipts
and newly secured bookings against the previous equivalent interval. Current
periods compare elapsed time; full historical periods compare calendar periods.
Dates and boundaries use Asia/Manila, with Monday weeks and calendar quarters.

The overview distinguishes selected-period cash income, all-time cash income,
current pending balances on secured bookings, approved prospective request value,
newly secured bookings, secured event dates, completed events, and current inquiry
cohort outcomes. Balances and inquiry outcomes are current snapshots, even when
viewing a past reporting period. Expenses are not recorded, so the indicator is
not a profit/loss result. Existing all-time reservation and event-type summaries
remain available below the new reports.

Faceted SVG event/conversion bars, a collection-progress donut, and an extruded
cash area chart reuse the dashboard chart primitives and approved warm palette.
Brief entry/period-change and hover depth effects honor the shared JavaScript
reduced-motion hook and CSS preference. Values remain visible without motion;
there is no recurring animation. Each chart includes an exact-value table.

Booking creation now stores a verified source inquiry id (or known direct origin)
in existing CREATE audit metadata. Historical names, emails, and editable notes
are never used to guess conversions. Tracking gaps make the overall conversion
rate unavailable, while verified counts remain visible. Missing dated confirmation
history similarly limits the combined trajectory. No database migration or public
intake module is introduced. See [the reporting contract](analytics-report-contract.md)
for exact definitions, date bases, and safeguards.

## Settings copied from old ZenTra

Services & Packages is placed immediately after Payment in the sidebar, using
the original services icon. Administrators can view current categories and
packages; super administrators can create and edit categories, pricing, visibility,
package details, and inclusions. New entries start hidden from clients. Saves are
validated, audited, checked for stale edits, and invalidate the relevant public
page cache. Package edits create version snapshots while preserving earlier
versions and unchanged inclusion identities. Private notes are excluded from
published snapshots. The page reads the existing catalog tables; it does not
seed, import, or modify records merely by opening the page. Existing bookings
retain their agreed details. Image fields accept existing local paths or HTTPS
URLs; no new upload provider or deletion feature was introduced.

Since 27 November 2026 the catalog holds the published rates of the package
booklets on the event pages (`config/package-booklets.ts`). The catalog prices one
guest count per package, so each published rate is its own package, for example
"Zion Classic (50 guests)" at ₱175,000 and "Zion Classic (100 guests)" at ₱199,000
(`config/package-catalog.ts`). Only the reservation fees the Terms publish are set
(Zion Classic ₱30,000, Zion Premium ₱40,000, Zion Ultimate ₱50,000); the other
packages have none, so their requests go to staff review. `scripts/sync-package-catalog.ts`
applies the booklets through the same catalog save (validation, a version for each
change, an audit entry, as a super administrator): a dry run by default, `--apply` to
save; packages not in the booklets are archived and hidden, never deleted. A new
local demo database runs it automatically (`npm run dev:local -- --sync-catalog`
updates an existing one). The booking page lists packages by guest count, then price,
and a tier that costs more for the entered guest count names the cheaper tier of the
same package. After a booklet change, run the sync again: a dry run shows what would
change.

Settings includes Appearance and theme, Session and security, Client website
controls, Communications, and Localization and data. Existing reservation/cash
policy and delivery information remain below these sections. Changes require an
explicit Save changes action by a super administrator; viewing the page or
previewing a theme never writes preferences. Unrelated settings JSON is preserved,
and concurrent stale saves are rejected.

Light mode and Dark mode preview the admin theme. Saved defaults and client
feature controls use the existing system_settings row and public settings reader.
Session timeouts apply at the next regular login; existing sessions and temporary
local preview access keep their expiry. Alert preferences filter attention items
and recent confirmation, cancellation, payment, and contract updates. Client
transaction emails are independent. Display dates and CSV exports use saved
localization; venue scheduling and contract timestamps remain in Manila time.
Language selection controls date formatting rather than translating the full UI.

Online Booking and Smart Assistant are unavailable, per the user's clarification.
Testimony/support admin alerts, authenticator enrollment, and destructive-action
password prompts are unavailable where their supporting modules or flows do not
exist. No missing modules are restored. CSV export downloads at most 10,000
activity records, scoped to the administrator's own records unless they are a
super administrator, with formula escaping, private response headers, and auditing.
Public settings responses never expose private admin/security preferences.

Communications also holds **Staff notification emails**: up to five addresses, separated by
commas, that receive staff alerts (new inquiries and website booking requests), the daily digest
and calendar events: every booking request appears at once as a "[Pending]" event, confirming it
turns that event into the reservation, and declining or cancelling removes it. Leaving the field
empty uses the server default (`STAFF_NOTIFICATION_EMAIL`, else the sending account `SMTP_USER`).
A changed list applies to the next email; an event already sent is updated or cancelled at the
inboxes that received it. The field has
a persistent label and help text; an invalid list keeps the typed text, opens Communications,
moves focus to the field and shows a persistent message (`role="alert"`, linked with
`aria-describedby`) until the list is corrected or saved again. The server applies the same rules
(`lib/admin/preferences-types.ts`), stores the list under `admin.staffNotifications`, and audits
only the number of addresses. Every administrator can read the list in Settings; only a super
administrator can change it. Automation shows the addresses in use, partly hidden. See
[staff addresses](automation.md#staff-addresses).

## Panel-feedback traceability

The three source PDFs were reviewed as project feedback, not as authorization for unrelated actions. This table records paraphrases, not verbatim quotations.

| Panel / feedback                                               | Admin implementation or scope boundary                                                                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cruz — form presentation and buttons                           | Clearly labeled forms, grouped actions, validation messages, loading states, and responsive controls.                                                                                       |
| Cruz — repeated breadcrumb/title                               | One page heading; no repeated module breadcrumb.                                                                                                                                            |
| Cruz — meaningful search                                       | Database-backed search by booking reference, client, email, event, or package; logs search activity descriptions.                                                                           |
| Cruz — demonstrate real automation                             | Transactional notice queue, conflict checks, contract preparation, and actual dispatch states; no fabricated success metric.                                                                |
| Cruz — explain contract generation                             | Versioned snapshots of a confirmed booking: event details, package inclusions, receipts, reviewed terms and both signatories, printed on the ZENTRA letterhead; review before issue.        |
| Cruz — reduce redundant UI                                     | Shared module shell and booking detail; distinct dashboard metrics and status labels.                                                                                                       |
| Cruz — calendar date filters                                   | Manila-time date range, month navigation, approval/reservation filters, and mobile agenda.                                                                                                  |
| Cruz — active vs client-visible services                       | Settings explains the distinction. Existing services and visibility controls are not changed by this private panel.                                                                         |
| Cruz — inquiry vs complaint/suggestion                         | Dashboard identifies existing business inquiries as inquiries, not reservations or support reports. The public form remains unchanged.                                                      |
| Villarama — real business flow                                 | Staff review, contact verification, approval, actual cash collection, confirmation, contract review, and completion.                                                                        |
| Villarama — process-driven UX                                  | Clear tentative/confirmed distinction and server-enforced safeguards with actionable error messages.                                                                                        |
| Villarama — dashboard improvement                              | Annual secured-contract sales, unresolved inquiries, upcoming/all-time secured bookings, numeric comparisons, policy review, and outbox states.                                             |
| Villarama — organization                                       | Eight consistent modules, scoped reusable UI, separate server workflows, and private data tables.                                                                                           |
| Villarama — actual automation health                           | Actual queued/accepted/review-required notices and automation job records, not a simulated health score.                                                                                    |
| Villarama — payment/downpayment reservation                    | Owner-reviewed deposit-required, full-payment-required, or no-payment-required confirmation policy; cash only.                                                                              |
| Villarama — scam/prank prevention                              | Staff-recorded verification, suspicious-request flags, restricted admin access, login throttling, and audit history.                                                                        |
| Marfil — standardized notifications                            | Shared templates state approval, reservation, payment, cash requirement, and venue instructions separately.                                                                                 |
| Marfil — clarify cash-only flow                                | Receipt number, amount, collection time, and staff note; no payment gateway or automatic paid state.                                                                                        |
| Marfil — no-payment timing/location                            | A no-payment-required confirmation option still requires owner-reviewed cash instructions explaining when/where payment is due. It does not mean the event is free.                         |
| Marfil — distinct statuses                                     | Approval, reservation, payment, verification, and contract status are independent. Approval never silently confirms or marks paid.                                                          |
| Rubric — authentication, authorization, privacy, secure coding | Server-side role/status/session checks; owner-only policy and voiding; CSRF/origin checks; strict validation; private RLS tables; password hashing; session revocation; no secret exposure. |

## Operating workflow

1. Sign in using an existing active ADMIN or SUPERADMIN account, with its email address or its username (`lib/admin/sign-in.ts`: emails match in lowercase; usernames match regardless of letter case, by plain equality, and only when exactly one account has that username). Failed attempts are limited per account, so the email and username share one limit. No live accounts or passwords were created/reset. Password-change-only accounts are restricted to Profile until the password is changed.
2. A SUPERADMIN reviews Settings, confirms the venue's cash instructions and agreement terms, chooses the reservation rule, and marks the policy reviewed. Unreviewed policy blocks confirmation and contract preparation.
3. Website requests follow the booking automation ([docs/booking-automation.md](booking-automation.md)): an ordinary request is approved by the system and holds its date until the payment deadline (Waiting for payment); a custom proposal, a package without a reservation fee, a no-payment policy or more guests than the Settings limit go to Under review. Staff-entered requests, optionally prefilled from an existing client inquiry, start Under review. An inquiry does not automatically reserve a date.
4. Approve request (or Reject request) for bookings under review. Approval holds the date until the payment deadline and is refused when another booking already holds or confirms the slot. Contact verification is optional; a request flagged as suspicious cannot be approved or confirmed until the flag is cleared. Approval remains separate from reservation confirmation.
5. Record only money actually received, with a unique receipt number: cash at the venue in Payments received, or a GCash or bank transfer with Verify payment after finding it in Zion's own records (the client's screenshot from their private payment page is shown in the booking with warnings for a reused reference or image; Reject screenshot asks the client for another one). Payments are stored in integer centavos with their method and cannot exceed the outstanding balance. When the payments reach the confirmation rule (the reservation fee, or the full amount), the reservation is confirmed in the same step. Extend payment deadline gives a client more time; an unpaid hold is released automatically when its deadline passes, unless a screenshot waits for review. Settings → Online Payments holds the GCash and bank accounts shown on payment pages. After confirmation the client can pay the balance the same way before the full-payment date (Settings, default 14 days before the event), with reminders a week and a day before it. Every recorded payment gets an acknowledgment number and a PDF acknowledgment receipt (not an official receipt), downloadable from Payments received and by the client.
6. Confirm by hand only when no payment is required (or a recorded payment did not confirm because the policy changed). Every confirmation checks approval, the reviewed current policy, the cash requirement and venue availability; transaction-scoped locks prevent overlapping confirmations and stale writes.
7. Prepare a versioned agreement, review its snapshot, and issue it. A physical signature is recorded only with signer and filed-document reference. Downloads are text agreements, not PDF exports, uploaded signed documents, or electronic signatures. Later booking changes make prior snapshots historical.
8. Completion requires a past confirmed event with its cash balance settled; the automation completes such events the morning after and alerts staff about ones with a balance. Cancellation retains history. Only a SUPERADMIN can void a cash receipt, with a reason; a confirmed reservation cannot lose required cash without cancellation first. Voiding is a ledger correction, not an actual refund transfer.

Changing policy does not rewrite public terms or existing agreements. Pending requests must be re-reviewed and re-approved under the current policy. New drafts are blocked if an older booking policy would mix with new terms; a confirmed older-policy booking needs the owner's review of an amendment rather than silently substituted terms.

Existing published terms provide Classic/Premium/Ultimate reservation fees of PHP 30,000 / 40,000 / 50,000. These were copied into the initial review draft, not treated as a substitute for venue approval. Staff must enter the actual agreed package, total, and fee. This is not a restored service-catalog management module.

## Database and access

Six additive tables were installed in the configured database with user approval: `zion_admin_bookings`, `zion_admin_cash_payments`, `zion_admin_contracts`, `zion_admin_policy`, `zion_admin_outbox`, and `zion_admin_rate_limits`. Existing tables/data were not removed, migrated, or rewritten. Old operational booking records were not imported; they are not fabricated as new admin data.

All six tables have RLS enabled and no direct grants to Supabase `anon` or `authenticated`. The server uses its private PostgreSQL connection only after admin authorization. Existing User, AccountSession, AuditLog, and Inquiry models are reused. `prisma/automation.sql` later extended `zion_admin_outbox` with delivery columns and added `zion_automation_state`, both additive and with the same RLS protection. Every request rechecks role, account status, password timestamp, and an active non-revoked database session. Sign-out/password change revokes sessions. Role changes are not exposed through Profile.

`prisma/admin.sql` is the additive schema; `prisma/admin.prisma` is its standalone generation source. `scripts/install-admin-schema.mjs` checks by default. Installation requires `--apply`, plus `--allow-remote` for a remote database; partial installations are refused. Do not use a full-schema reset or destructive Prisma push for this feature.

## Subsequent user-approved local reset — 8 October 2026

After the original additive installation, the user requested a fresh database. The local PostgreSQL database `ZenTra` was backed up, and 1,604 old records were cleared from 62 explicitly inventoried application tables, including old accounts, sessions, operational records, and published-content/catalog records. The 34 migration-history entries, table definitions, indexes, constraints, triggers, RLS policies, and grants were preserved. A fresh SUPERADMIN was created with a random temporary password and mandatory password change. Actual sign-in, Profile access, blocked operational access before the password change, and sign-out revocation were verified; the resulting new security logs are not old retained data.

The native PostgreSQL backup archive was checked for all 63 table-data entries and saved with a SHA-256 checksum under `C:/Users/jerom/Downloads/Zion-Database-Backups/database-reset-2026-10-08T04-21-27-995Z-61e739/`, outside the source repository. It is readable by the current Windows user and SYSTEM, not other ordinary users. `admin-login.txt` in that folder contains the private temporary login details; remove that file after changing the password. No password was printed in the tool output. No cloud storage files, local public images, or website code/design were removed; built-in static website defaults can still be displayed independently of database records.

The reset helper `scripts/reset-local-project-db.mjs` is inspection-only by default and fails closed for a remote host, a different database/port, changed table inventory, inherited tables, blobs, materialized views, or TRUNCATE triggers. Actual execution requires the exact full-reset confirmation flag and an explicit `--admin-email=...`. It creates/verifies the private archive first and resets data transactionally without DROP or CASCADE. Do not run it again merely to change a password.

## Deployment and real notifications

Temporary local access can be enabled for a development session with the server-only
`ADMIN_LOCAL_ACCESS_ENABLED`, `ADMIN_LOCAL_ACCESS_EMAIL`,
`ADMIN_LOCAL_ACCESS_TOKEN_HASH`, and `ADMIN_LOCAL_ACCESS_UNTIL` settings. A private
link carries a random access token in its URL fragment and signs in as the configured
existing administrator without changing their password. The usual database session,
role checks, password-change restrictions, audit logging, and sign-out revocation
still apply. This entry requires a local app origin and local PostgreSQL database;
it rejects production, preview, cross-site, and remotely forwarded requests. Local
sessions stop working when access is disabled or expires, and cannot carry over to
production. Keep the generated link private; set `ADMIN_LOCAL_ACCESS_ENABLED=false`
to restore password-only local sign-in immediately.

For a temporary password-free local preview, additionally set server-only
`ADMIN_LOCAL_ACCESS_AUTO_LOGIN=true` and `ADMIN_LOCAL_ACCESS_TOKEN` to the matching
private token. Visiting `/admin` on the configured loopback host then signs in
automatically through the credentials provider. Production, remote databases,
non-loopback hosts, cross-site requests, and remote forwarded requests cannot use
this entry. Existing sessions visiting `/admin` go directly to Dashboard.
Explicit sign-out uses `/admin?signed-out=1` to keep the session signed out;
visiting the plain `/admin` URL enables automatic entry again while configured.

- Keep `AUTH_SECRET` server-only and use a securely generated value of at least 32 bytes. A local secret was generated in the ignored `.env.local` without printing it. Set the approved production secret separately in the hosting environment; no deployment was performed.
- Set `AUTH_URL` to the exact HTTPS production origin, alongside the correct public app URL and existing private database configuration. Use HTTPS; never expose database credentials or service-role/API keys through `NEXT_PUBLIC_` variables.
- Email is delivered by the built-in automation through Gmail SMTP (Nodemailer and a Google App Password). Set server-only `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` and, optionally, `STAFF_NOTIFICATION_EMAIL` (the fallback while Settings → Communications has no staff notification emails), install `prisma/automation.sql` with `npm run db:automation:check -- --apply`, and schedule `/api/cron/automation` with `CRON_SECRET`. See [the automation guide](automation.md). No mail account was provisioned and no live emails were sent by this change.
- Notices are generated transactionally and remain QUEUED without mail configuration. Delivery is attempted right after each decision, by the scheduled run, by `npm run automation:run`, from Automation ("Run due jobs now") and, for a SUPERADMIN, from "Process queued notices" in Logs.
- Each notice is claimed atomically, so concurrent runs never send it twice. ACCEPTED means the mail server accepted it, not that the recipient read it, and it is never sent again. Temporary failures retry with exponential backoff; permanent rejections and exhausted attempts become REVIEW_REQUIRED, and a send interrupted mid-way is held as REVIEW_REQUIRED rather than resent automatically. Staff can retry failed notices from Automation after checking the error.
- Confirming a reservation attaches a calendar invitation (`invite.ics`); cancelling a confirmed reservation sends a cancellation update for the same calendar event. The staff notification addresses receive their own copy of the same event: a pending event as soon as a request arrives (`STAFF_CALENDAR_PENDING`), the confirmed event that replaces it (`STAFF_CALENDAR_REQUEST`) and, after a decline or cancellation, its removal (`STAFF_CALENDAR_CANCEL`); the client's notice and the booking history read by analytics are unchanged. Confirmed clients also receive reminders a week and a day before the event, and staff receive a daily digest.

## Verification and limitations

### Open shared reflow finding — 22 November 2026

The receptionist owner reported a root-font scaling check in which the document's
minimum width became 640px at a 32px root size, despite its fixed chat panel
remaining bounded. Source inspection confirms that `app/globals.css` applies
`min-width: var(--layout-min-width)` to `html`, while `styles/tokens.css` defines
that token as `20rem`; at a 32px root this resolves to 640px. The shared
`overflow-x: clip` rule can conceal overflow rather than establish reflow.

This remains an open shared-foundation finding affecting any panel using those
rules. The reported scaling check and this source inspection are not an
independent administrator-panel runtime test or a native 200% text/400% zoom pass.
Earlier 320px checks at the normal root size do not resolve it. Coordinate shared
source ownership and retest all affected panels before changing the foundation.
Only this admin documentation note was added; CSS, tokens and workflows remain
unchanged by this record.

`npm run verify` passed: client boundary, project hygiene, TypeScript, removed-public-feature boundary, all six automated admin tests, ESLint, and the production build. ESLint has one pre-existing unused-variable warning in the unrelated spreadsheet-tracker helper; no lint errors.

The isolated PostgreSQL integration test covers verification/approval, cash prerequisites, unique/stale receipt protection, overpayment, confirmed conflicts, owner-only voiding, contract issue/physical-signature states, real aggregates, audit persistence, private-table RLS, and mocked email acceptance/rejection. It never writes QA records into the configured database or contacts an email provider.

Browser verification covered all eight modules and the complete request → verify → approve → reject confirmation before cash → record cash → confirm → prepare agreement flow. Desktop month filtering and a 390px mobile agenda worked without horizontal page overflow. The browser reported no console errors. The saved preview contains disposable QA data, not a real booking or receipt.

For repeatable UI verification, run `node scripts/preview-admin.mjs`; it creates an in-memory PostgreSQL fixture and local-only preview at port 3011, with fake accounts and email disabled. While it is running, `node scripts/check-admin-preview.mjs` checks unauthenticated access, client-role denial, cross-site rejection, input validation, protected modules, and database session revocation. Stopping the preview discards only its disposable fixture.

Next.js and its matching ESLint configuration were updated to 16.3.8, with compatible security overrides for sharp/PostCSS and the MySQL tooling dependency. Nodemailer (now 10.5.0) was later adopted directly for the built-in SMTP automation; Auth.js credentials authentication still does not use its email-provider API.

The final dependency audit has zero critical advisories but still reports eight upstream high advisories in the ESLint glob/brace chain and Prisma config/deepmerge tooling. These were not hidden or fixed through an incompatible forced downgrade/major rewrite. They need follow-up before a production security sign-off. Email delivery, owner policy review, deployment settings, and any required historical booking migration are not claimed complete.
