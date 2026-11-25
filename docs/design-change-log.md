# Design change log

## 25 November 2026 — Booking requests appear in the owner's calendar as pending events

User task: as the owner, see every booking that comes in on their own Google Calendar right away,
not only after the reservation is confirmed.

Affected screens and files:

- Staff calendar emails (`lib/automation/bookings.ts`, `templates.ts`, `ics.ts`,
  `booking-requests.ts`, `processor.ts`, `catalog.ts`; `lib/admin/service.ts`). Every booking
  request, from the website or entered by staff, sends the Staff notification emails a calendar
  event titled "[Pending] Birthdays: Client (ZION-…)", marked tentative and shown as free time,
  in an email "Pending request: Birthdays for Client, date". Editing the request's date or details
  moves the event; confirming turns the same event into the reservation (title without
  "[Pending]"); declining or cancelling removes it ("Request declined" or "Request cancelled"
  emails). Clients still get a calendar invitation only when their reservation is confirmed.
- Admin → Automation (Staff notifications item) and Admin → Settings → Communications (help text
  under Staff notification emails) now describe the pending events. Text only: tokens, type,
  layout and motion are unchanged.

Verification: `npm run test:automation` passed 30 tests, including new ones for the pending event
on a website request, a repeated enqueue, delivery, removal on decline, a stale pending event
skipped, a declined request reviewed again, an edit that moves the event, confirmation to the
current and the holding inboxes, cancellation, an unsent pending event skipped at confirmation, and
the TENTATIVE calendar format. `npm run verify` passed (chatbot 68, admin 23, automation 30,
developer 6, lint, build). Local preview: the Settings help text and the Automation item at
desktop width and 320 px, wrapping with no sideways scrolling.

Limitations: not yet tried with a real Google Calendar, because the live site cannot send email
until the Gmail App Password is added. Google Calendar's display of tentative, free-time events
and in-place updates relies on its standard invitation handling. The Automation text for a
configured staff address was not seen on screen (the local data has none). No screen-reader pass.
Each website request now sends staff two emails (the alert and the calendar event). Requests made
before this change get a pending event only when edited. The AGENTS.md hand-off to the team chats
could not be sent from this machine.

## 25 November 2026 — Mobile menu, compact footer, wider home page with subtle motion

User task: full mobile responsiveness with a menu button strictly at the left of the header on
phones and tablets only (never on desktop); remove duplicate booking buttons and contact details
repeated in the footer; a compact, professional footer; a wider home page with subtle transitions,
hover states and scroll reveals; settings ready for the Gemini key, email and calendar.

Affected screens and files:

- Header on every public page: `components/layout/MobileMenu.tsx` and `.module.css` (new),
  `GlobalHeader.tsx` and `.module.css`, `styles/tokens.css` (`--layout-header-offset` is one row
  below 64rem). Phones and tablets show one row: the menu button at the left (44px, `aria-expanded`,
  `aria-controls`), ZENTRA, then Book Now. The button opens a modal drawer from the left with the
  original items; Packages is a disclosure, open on package pages, and the current page is
  underlined. Escape, the close button, the backdrop, choosing a page or widening the window to
  desktop closes it, and focus returns to the button. The desktop header is unchanged and has no
  menu button. The header wordmark is 28px on phones (24px under 384px) and stays 36px from tablets
  up, as before.
- Footer (`components/layout/Footer.tsx` and `.module.css`): one band with the wordmark, the site
  links and the social links, then the legal row, about 156px tall at 1440px. The address, phone,
  email and Book now button are gone; they live in the home Contact section, the Contact page and
  the header. The legal links keep clear of Zeni's floating button. `SocialLinks.tsx` now uses the
  theme's action color (the icons were dark green on the dark theme) and says "opens in a new tab".
- Home: the hero's "Book now" became "See packages" and "Check a date" (scrolls to Available
  Dates), since Book Now is in the header. Sections use the new `--layout-wide-width` (96rem); the
  Archive photos run almost edge to edge on desktops; package cards are one, two or three columns;
  the booking steps form a 2×2 grid; the hero fills the first screen on desktops. Photos zoom
  slowly, card titles change color and the card arrow nudges on hover; FAQ questions and steps have
  hover states.
- Motion: `FadeIn` hides blocks that start below the fold and reveals them once (with `once` it
  previously never animated); the shared `.reveal` no longer blurs or scales; card grids follow in
  a short cascade; the hero text rises in for each slide; in-page links scroll smoothly while
  `data-scroll-behavior="smooth"` keeps route changes instant. New tokens: `--motion-reveal`,
  `--motion-stagger`. All of it is off under reduced motion, and content stays visible without
  script and when printed.
- Phone fixes: the package page titles ("THE … EXPERIENCE") and the Gallery title wrap instead of
  being cut off at 320px; Terms and Policies cards use less padding on phones; testimony ratings
  wrap below the name; headings break words longer than their line (`app/globals.css`).
- Setup: Admin → Zeni shows the steps to add `GEMINI_API_KEY` while it is missing; Admin →
  Automation gives the Vercel steps for Gmail; links in emails fall back to Vercel's production
  domain; the README has a go-live checklist.

Verification: local preview at 320, 768, 1024, 1280 and 1440px. An overflow scan of all 18 public
pages at 320px found no sideways scrolling or cut-off text after the fixes, except the Gallery note
below. The menu was operated by mouse and keyboard (Tab stays inside, Shift+Tab wraps; Escape, the
backdrop, a link and widening the window close it; focus returns to the button). Checked the dark
theme for the drawer and footer, footer links against Zeni's button, the scroll reveals and
cascade, the hero entrance and the smooth "Check a date" scroll. The full `npm run verify` result
is in the commit that adds this entry.

Limitations: reduced motion was not emulated; it was checked in the code (every new animation is
inside `prefers-reduced-motion: no-preference`, and `FadeIn` does not hide anything then). No
screen-reader pass; 200% text and 400% zoom were only approximated by the 320px checks. On phones
the Gallery's legacy swipe cards widen the layout by 7px while they animate in on load (the
component is unchanged). The softer shared reveal also applies on About, Gallery, Terms and
Policies. The AGENTS.md hand-off to the team chats could not be sent from this machine.

## 25 November 2026 — Staff notification emails in Settings, staff calendar invitations

User task: the owner wants booking calendar notifications in their own Gmail, with an admin setting
that names the address(es) that receive them and can be changed later.

Affected screens and files: Admin → Settings → Communications (`components/admin/SystemSettingsForm.tsx`,
`admin.module.css`): a "Staff notification emails" text field below the alert switches, with a
persistent label, help text and an inline error (`role="alert"`, `aria-invalid`, `aria-describedby`).
A bad list opens the section and moves focus to the field. Admin → Automation
(`components/admin/AutomationPanel.tsx` and `.module.css`): a third Setup item, "Staff notifications",
showing the partly hidden addresses and where they come from. Server: `lib/automation/recipients.ts`,
`lib/automation/bookings.ts` (staff calendar invitation and cancellation), `lib/admin/preferences.ts`.
Tokens only; no new colors, type sizes or motion.

Verification: local preview at desktop width and 320 px. An invalid list showed the message and
focused the field; two valid addresses saved in lower case; Automation listed them partly hidden and
wrapped at 320 px with no sideways scrolling. `npm run test:admin` (23) and `npm run test:automation`
(27) cover saving, validation, roles, the audit entry, the server default, and the staff invitation
and cancellation.

Limitations: no screen-reader pass; dark theme and 400% zoom not checked for the new field. Whether
Google Calendar adds the invitation automatically depends on the receiving account's "Add
invitations to my calendar" setting. The AGENTS.md hand-off to the team chats could not be sent from
this machine.

## 25 November 2026 — Zeni answers from Zion's official FAQ, with topic chips

User task: Zeni kept sending guests to staff and repeating itself; it should answer everything Zion's
official documents cover ("zion info" and the FAQ PDF), still answer payment questions while offering
the admin, and not repeat the same text.

Affected screens and files: the Zeni window on every public page. `config/zeni-topics.ts` (new: six
topics with keywords, summaries, follow-ups and contacts), `config/public-faqs.ts` (casual chatbot
wording and a topic for each official answer, plus 15 Zeni-only follow-up questions),
`lib/chatbot/faq-sources.ts` (new), `lib/chatbot/receptionist.ts`, `lib/chatbot/retrieval.ts`,
`lib/chatbot/conversation.ts`, `lib/chatbot/types.ts`, `config/chatbot-receptionist.ts` (English and
Taglish copy), `components/chatbot/Chatbot.tsx` (up to 7 chips), `services/chatbot/sources.ts`,
`services/chatbot/admin-overview.ts`, `docs/chatbot.md`.

- Welcome: "Hi! I'm Zeni from Zion Events Place. Tap a topic below for quick answers, or just type your
  question." with seven outlined chips (six topics and "Check a date"); they wrap at 320 px.
- Topic summaries are a short intro, one bulleted fact per line (the bubble keeps line breaks), and the
  contact line, followed by an "All FAQs" link, a Talk to staff button for payments and changes, and
  three follow-up chips. No new colors, type sizes or motion.

Verification: an 18-question probe against the local preview went from 7 good answers to 18 (short,
Taglish, payment, reschedule, cancel and "outside food" questions now answer from the official FAQ).
`npm run test:chatbot` passes with five new tests (the probe's questions, topic chips and umbrella words,
repeated questions, reschedule questions versus requests, and "never guess" for uncovered questions);
one test now expects the payment-methods question to give the official schedule with a staff option
instead of a bare hand-off, still never quoting the conflicting methods list. Checked at 320 px: the
welcome, the seven chips and a payments summary.

Limitations: without a Gemini key the answers are Zion's approved FAQ wording, chosen by keyword
matching; with a key the model rephrases them from the same sources. Capacity questions still go to
staff because the published figures differ (120 versus 130). Not checked with a screen reader.

## 25 November 2026 — Admin sign-in accepts a username

User task: sign in to the admin with a short name ("zentra.bsit.pup") instead of an email address.

Affected screen and files: the admin sign-in card (`components/admin/LoginForm.tsx`): the first field
is now "Email or username", a text field (`autocomplete="username"`, no auto-capitalization or spell
check) instead of an email field that rejected names without "@". Server: `lib/admin/sign-in.ts`
(new lookup) and `lib/admin/auth.ts` (failed attempts now limited per account). No layout, color or
type changes.

Verification: `lib/admin/integration.test.ts` checks email and username lookups in any letter case,
that `%` and `_` are not wildcards, and that a username shared by two accounts signs in no one. Local
preview: signed in with the username in different letter case and reached the dashboard. The full
`npm run verify` result is in the commit that adds this entry.

Limitations: no screen-reader pass of the changed label. The AGENTS.md hand-off to the team chats
could not be sent from this machine.

## 25 November 2026 — Closer free stand-in for the ZENTRA wordmark

User task: the shared Vercel preview showed a plain serif ZENTRA logo, so it looked as if the design
had not been pushed; use a free font that looks closer to the plan's Zenitha Classic.

Affected screens and files: the wordmark and "Z" monogram wherever Zenitha Classic is not installed
(the public header, the admin header, Zeni's launcher and avatar). `app/_fonts/index.ts`
(`cinzelDecorative` replaces `hedvig`), `app/_fonts/cinzel-decorative-bold.woff2` and
`cinzel-decorative-OFL.txt` (Fontsource latin subset, SIL OFL 1.1), `app/layout.tsx`,
`styles/tokens.css` (`--font-zion-brand`), `components/shared/ZentraWordmark.tsx`,
`scripts/install-licensed-fonts.mjs`, README and `docs/design-standard.md`. Hedvig Letters Serif's
file and license were removed. Machines with the licensed fonts are unchanged.

Choice: 28 free Google Fonts were set beside the real Zenitha Classic "ZENTRA" and "Z" at display
size. Cinzel Decorative Bold was the closest (swash Z and R, similar stroke weight). Its bold cut is
registered as weight 400, so the stack keeps Zenitha's single regular weight without synthetic bold.

Verification: local preview with the licensed fonts switched off in the browser. The wordmark renders
in Cinzel Decorative at 165 px wide (Zenitha: 163 px), so the header does not shift; at 320 px the
header has no horizontal scrolling; Zeni's launcher shows the swash Z. The full `npm run verify`
result is in the commit that adds this entry.

Limitations: it is still a stand-in (Zenitha's taller letters and joined NT differ), and the real
fonts need web licenses before the public launch. Not checked in the dark theme (only the typeface
changed, not colors). The AGENTS.md hand-off to the team chats could not be sent from this machine.

## 25 November 2026 — Live chat: Zeni hands visitors to real staff

User task: when a visitor asks Zeni for staff, the admin must really be notified; a staff member joins
the same Zeni conversation from a queue, chats with the visitor as a real person, and hands the visitor
back to Zeni once everything is settled; improve on the idea.

Affected screens and files:

- Zeni window (every public page): `components/chatbot/Chatbot.tsx`, `ChatMessage.tsx`
  (`StaffMessage`, `LiveNote`), `Chatbot.module.css`, `useLiveChat.ts`, `messageOrder.ts`, copy in
  `config/chatbot-receptionist.ts` (English and Taglish). A status banner under the header ("Waiting for
  our staff to join…", "You're chatting with Maria from Zion Events Place") with **End chat** beside the
  text; staff replies outlined in the action green and labelled "<first name> · Zion staff" (read once by
  screen readers); status notes as small centered muted text; the field label and placeholder become
  "Message our staff"; suggestion chips hide during a chat; **Leave a message for our team** after a
  missed chat. Zeni and staff messages form one timeline in arrival order, so later Zeni answers appear
  below the staff chat. A finished chat stays visible for 15 minutes. No new colors, fonts or motion.
- Admin: a **Live chat** page and sidebar item (Headset icon) with a count badge
  (`components/admin/LiveChatPanel.tsx` and `.module.css`, `useLiveChatAlerts.ts`, `AdminShell.tsx`,
  `navigation.ts`, `AdminNavIcon.tsx`, `admin.module.css` `.navCount`). Availability switch with a
  described hint, queue lists with status chips, a summary of what the visitor told Zeni, the message
  log (`role="log"`), composer with quick replies, a staff-only outcome note, **Return to Zeni** and
  **Close chat**; loading, empty, error and success notices; "(n)" in the tab title, a polite
  announcement and an optional chime on every admin page. Panel text rules are scoped under `.page` so
  the admin shell's `.root p` and `.root summary` defaults no longer add gaps or mute message text.
- Server and data: `services/chatbot/live-chat.ts`, `services/chatbot/receptionist.ts`,
  `app/api/client/chatbot/live/route.ts`, `app/api/admin/live-chat/route.ts`, `lib/chatbot/live-chat.ts`,
  `prisma/live-chat.sql`, `scripts/install-live-chat-schema.mjs` (`npm run db:live-chat:check`).
  `lib/chatbot/slots.ts`: a stated name ends with its sentence ("My name is Ana. Can I…" gives "Ana";
  "Ma. Cristina" and "Jr." stay whole), so staff see the visitor's name.

Verification (local preview, browser): the full flow at 1440 px (the user also tested it by hand) and with
the visitor at 320 px: hand-off, waiting banner, admin queue with sidebar badge "1", "(1)" title on
another admin page and the status announcement text, take, replies both ways, staff-only outcome, Return
to Zeni, a new Zeni answer placed below the staff chat, Close chat, the visitor's End chat, and a chat
nobody took marked missed with "Leave a message for our team". Keyboard: chats open with Enter; taking a
chat moves focus to the reply box; Enter sends; Close chat and Return to Zeni move focus to the chat
heading (3 px focus ring); End chat moves focus to the message field. Admin page at 320 px without
horizontal scrolling and in the dark theme; Zeni at 1280 px with 200% text keeps the banner and End
chat usable without overflow. `npm run test:chatbot` passes, including the PGlite flow test (queue,
claim once, only the claimer replies, return, missed then email hand-off, visitor end, finished chats
leaving the window, foreign origin refused) and the new name test; the full `npm run verify` result is in
the commit that adds this entry.

Limitations: not checked with a screen reader, by ear for the chime, on a real phone, or with two staff
signed in at once (covered only by the automated test). Polling means replies can take up to 3 seconds
to appear. The public header and hero overflow when 320 px width and 200% text are combined (beyond the
separate WCAG checks, and outside this change). The AGENTS.md hand-off to the team chats could not be
sent from this machine.

## 25 November 2026 — Booking requests that reach the admin, plain Zeni, website activity

User task: make the booking flow follow the team plan and actually work, make its page professional,
wide and easy to read with better icons, make Zeni look plain and human-made rather than "AI", and
let the admin see what visitors do on the site; adopt the plan's automation for these events.

Affected screens and files:

- Booking (`/booking`): `app/booking/page.tsx` (server-loaded catalog, availability and Zeni
  pre-fill), `app/booking/_components/BookingRequestForm.tsx`, `BookingRequest.module.css`,
  `booking-types.ts`, `bookingInitial.ts`; the old journey, mountain map, receipt and recommendation
  files were removed. Four steps (Event, Package, Your details, Review) with a numbered progress
  bar, photo cards for event types, the availability-aware date picker, half-hour time lists,
  published packages with prices and inclusions plus a custom-proposal option, optional extras,
  preferred payment method (nothing is paid online), policy consent, an error summary with links
  and inline errors, a sticky summary with a live estimate, and a confirmation with the reference.
  Lucide line icons only; no sparkle or decorative icons. New feedback tokens in
  `styles/tokens.css` (`--feedback-error-*`, `--feedback-success-*`).
- Booking requests: `POST /api/client/booking-requests` (`services/booking-requests.ts`,
  `config/booking.ts`) validates the request again on the server (date window, booked dates, times,
  guests, published package, consent, honeypot, per-email and hourly limits) and saves an admin
  booking with status Request (created by `website`), the bookings CREATE audit entry the dashboard
  reads, an in-app notice, a client acknowledgement and a staff alert
  (`lib/automation/booking-requests.ts`, new templates and the `BOOKING_REQUEST_STAFF_ALERT` event).
- Admin dashboard: a "Website activity" panel (`components/admin/WebsiteActivity.tsx`,
  `WebsiteActivity.module.css`, `lib/admin/website-activity*.ts`) lists website booking requests,
  inquiries and Zeni hand-offs, testimonies awaiting review and unanswered Zeni questions with status
  chips, relative times and links; loading, empty and error states; polite announcements only for new
  items; refresh every 60 seconds without moving focus.
- Zeni (`components/chatbot/*`): flat white panel with a hairline border, plain header, simple
  rectangular bubbles, outlined chips, a labelled text field, a solid launcher; no glow, breathing,
  slide-in or bouncing-dot animations. `lib/chatbot/slots.ts` no longer stores suggestion-chip
  text ("Schedule a visit") as the visitor's name.

Verification: browser review of the local preview at 1440 and 320 px; the full booking flow sent a
test request (reference shown, date then marked as requested); server checks refused a booked date,
a past date, missing consent and too few guests with clear messages; error summary and inline errors
shown on empty contact fields; Zeni opened in its new look; `npm run test:chatbot` 60/60 including a
new name-capture test. Full `npm run verify` results are in the commit that adds this entry.

Limitations: emails are only queued until Gmail SMTP is configured; Zeni keeps its built-in answers
until a Gemini key is added. Not checked with a screen reader, at 200% text scaling, in the dark
theme or on a real phone. The AGENTS.md hand-off to the team chats could not be sent from this
machine.

## 25 November 2026 — Public navigation: Figma header instead of the menu button

User task: make the public navigation look like the Figma header, with no burger menu, while keeping
the original menu's items exactly ("yung layout lang babaguhin": only the layout changes).

Affected screens and files: every public page. `components/layout/GlobalHeader.tsx` and
`GlobalHeader.module.css` (rewritten), `config/navigation.ts` and `lib/navigation.ts` (new; the
original items and labels), `components/layout/Footer.tsx` (same links, now from the shared config),
`components/layout/Navbar.tsx` and the `.navigation-dialog` styles (removed), `styles/tokens.css`
(header heights, `--type-wordmark-compact`), `app/globals.css` (scroll padding),
`components/home/HomeSections.module.css` (removed a second, now doubled scroll offset).

- Items unchanged: Home, Packages (Weddings, Debuts, Christening, Birthdays, Gender Reveal, Christmas
  Party), Gallery, About Us, Facilities, Testimonies, Contact Us, FAQ, and Book Now.
- Desktop (64rem and up): the centered ZENTRA wordmark with an outlined Book Now at the right, then
  the menu in a row between two hairlines. From 75rem the header condenses into one slim row after
  scrolling. Packages opens its event types in a panel under the row (disclosure button; Escape,
  outside click, moving focus away or navigating closes it and Escape returns focus).
- Tablets: the same two rows; the menu row fits on one line at common tablet widths.
- Phones (below 48rem): ZENTRA at the left (a centered wordmark would be pushed off-center by the
  full Book Now label), Book Now at the right, and the full menu in a row that scrolls sideways; the
  focus ring is drawn inside that row. The header slides away while scrolling down and returns on any
  scroll up, on keyboard focus, or while Packages is open.
- The header is fixed with a spacer that reserves its full height, so condensing or sliding it never
  shifts the page; `scroll-padding-top` keeps linked sections and focused elements clear of it.
- The current page is underlined as well as colored. Transitions stop with reduced motion.

Verification: browser review of the local preview at 1440, 1024, 820, 375, 360 and 320 px (no
horizontal page scroll; all eight items reachable; Packages opens, shows the current event type
underlined and closes with Escape; slim row after scrolling at 1440; phone header hides on scroll
down and returns on scroll up); keyboard order skip link, wordmark, Home, Packages, Gallery, About
Us…; `npm run verify` results are in the commit that adds this entry.

Limitations: not checked with a screen reader, with 200% text-only scaling, in the dark theme, or on a
real phone; reduced motion was reviewed in code, not emulated. The AGENTS.md hand-off to the team
chats could not be sent from this machine.

## 25 November 2026 — ZENTRA redesign (Figma), Zeni rebuild, admin redesign, n8n replaced

User task: run the system locally, redesign it to the team's Figma file ("New Zentra") while keeping the
old navigation menu, make Zeni professional and follow the team's chatbot plan (also on the admin side),
redesign the admin panel to the plan, remove n8n and replace it with built-in automation, and use the
plan's fonts.

Affected screens and files (public design):

- Foundations: `styles/tokens.css` (ZENTRA palette from Figma: white, deep green `#03422E`, `#D9D9D9`
  hairlines, teal, four booking-status hues; legacy palette names kept and re-valued), `styles/primitives.css`
  (wordmark/monogram, uppercase titles), `app/globals.css`, `app/_fonts/` (Archivo + Hedvig Letters Serif,
  SIL OFL), `app/layout.tsx` (optional local licensed-font stylesheet, ZENTRA title, theme colors),
  `docs/design-exceptions.json` (two metadata values swapped, same count).
- Header and footer: `components/layout/GlobalHeader.tsx` (white bar, centered ZENTRA wordmark; the team's
  existing menu kept with the same items and behavior, recolored), `Navbar.tsx` (colors only), `Footer.tsx`.
- Home in Figma order: `components/client/HeroSection.tsx` (accessible carousel: pause control, 7 s, swipe,
  no autoplay with reduced motion), `components/home/*` (The Archive, Events & Packages, Available Dates with
  "How booking works", Reviews, FAQ, Contact), `config/home.ts`.
- Inner pages: Figma-style photo banners (`CinematicPageHero`, `PackageHeroSection`, `SubpageHero`), white
  surfaces, booklet cover recolored, dark text removed from solid green fills across booking, FAQ, policies,
  terms, testimonies, gallery and the date picker.
- Brand: `components/shared/ZentraWordmark.tsx`, `ZentraMonogram.tsx`, `config/brand.ts` (`wordmark`,
  `siteTitle`). Venue documents (receipt, package booklet) keep the Zion Events Place logo.
- Removed unused legacy home components (features, partners, cinematic background, slideshow).

Verification (public design): `npm run check:design` (49 contrast checks), `check:client-boundary`,
`check:hygiene`, ESLint and Prettier on changed files; every public route returns 200 on the local
preview; visual review at 1440, 375 and 320 px (no horizontal scroll at 320 px); the kept menu opens,
lists the same items and closes with Escape.

Limitations: the AGENTS.md hand-off to the four team chats could not be sent from this machine (those chats
live on another computer); the licensed fonts are local-only until licenses are bought; dark mode on public
pages and 200%/400% zoom were not re-reviewed; screen-reader testing not done.

Zeni (receptionist chatbot):

- Figma "ZENI CHATBOT LOOK LIKE": round launcher with the serif "Z" monogram, white panel with a green
  border, "ZENI" header with "How Zeni works", rich cards (package/facility, availability calendar),
  action buttons (book this date, schedule an ocular visit, talk to staff) and suggestion chips.
- Plan behavior: English/Filipino/Taglish replies, optional Gemini phrasing grounded in published sources
  with redaction and validation, deterministic fallback, pre-filled booking and visit links, the n8n booking
  adapter removed, unanswered questions logged for staff, admin page `/admin/zeni`.

Admin panel:

- Figma visual language inside the kept left sidebar: ZENTRA "Admin dashboard" header, plural labels,
  status cards and booking cards in the four status hues, Cards/Table toggle, calendar with today in solid
  green and a dark "This month" panel, teal KPI cards; Edit details for open requests; dark theme re-tinted.

Automation (n8n removed): database outbox with retries and idempotency, Gmail SMTP, .ics invitations,
reminders and a daily digest, cron endpoint, admin page `/admin/automation`.

Booking page: the simulated date availability was replaced with real booked/inquired dates from the admin
calendar (`/api/client/availability`, dates only).

Verification (whole change): browser review of the public site, Zeni (Taglish answer, package card,
calendar card, date check, pre-filled booking link) and the admin (sign-in, dashboard, bookings confirm and
edit, calendar, reports, inquiries, settings, automation, Zeni, dark theme) on the local preview; automated
results are in the commit that adds this entry.

## 22 November 2026 — Zeni client chatbot design layout rebuild & greeting enhancements

User task: Rebuild the client chatbot (Zeni) matching the user-provided design layout mockup, enhance the greeting bubble layout, prevent glitch/vanishing caused by background objects, elevate the chatbot in front of the client panel, and apply `#FFE1AF` to the conversation canvas.
Affected files:

- `styles/tokens.css`: updated conversation canvas token to `#ffe1af` (`--palette-chat-canvas: #ffe1af`, matching approved `--palette-admin-peach`), added `--palette-chat-bubble: #c1b178`, `--palette-chat-pill: #fff5d3`, `--palette-chat-send: #ddcb8d`, `--palette-chat-border: #211610` and `--chat-*` semantic tokens.
- `components/chatbot/ChatLauncher.tsx`: fixed greeting bubble vanishing glitch by removing aggressive obstruction hiding triggered by page controls; layered launcher in front of client panel; streamlined greeting bubble to display solely the greeting text without extraneous badges or dismiss buttons.
- `components/chatbot/ChatLauncher.module.css`: elevated dock to `z-index: 999`; redesigned speech bubble with angled tail directed at Zeni mascot, centered greeting typography, `20px 20px 4px 20px` border radius, refined typography, smooth transitions, and elevated drop shadow.
- `components/chatbot/ChatAvatar.tsx`: upgraded avatar containers with circular dark border frames (`1.5px solid var(--chat-border)`), framing Zeni's portrait and visitor icon.
- `components/chatbot/ChatMessage.tsx`: rebuilt message turns to align with layout specifications. Assistant turns display "Zeni" top-left, circular avatar on left, and olive-gold bubble with high-contrast dark ink text. Visitor turns display "You" top-right, olive-gold bubble, and circular avatar on the right. Typing indicator renders as an olive-gold pill with animated dots.
- `components/chatbot/Chatbot.tsx`: rebuilt header with avatar, serif "Zeni" title, "Virtual Receptionist" subtitle, options menu, and close button. Integrated quick suggestion pills ("About Us", "Packages", "FAQ", "Visiting Hours", "Prices"). Rebuilt bottom composer with circular greeting smiley button, elongated pill input field, and circular gold send button with paper-airplane icon.
- `components/chatbot/Chatbot.module.css`: elevated dialog to `z-index: 10000` (in front of all panel elements); updated `.dialog`, `.conversation`, and `.composer` backgrounds to `var(--chat-surface-page)` (`#FFE1AF`); full responsive styling with 28px border-radius, olive-gold bubbles `#c1b178`, cream pills `#fff5d3`, touch targets >= 44px, and reduced-motion support.

Verification:

- `npm run check:design`: passed with 49 palette/semantic contrast checks; WCAG 2.2 AA text contrast > 7.5:1.
- `npm run check:client-boundary`: passed across 800 files.
- `npm run check:hygiene`: passed.
- `npx tsc --noEmit`: passed with 0 errors.
- `npm run test:chatbot`: 54/54 tests passed.
- `npm run lint`: passed with 0 warnings.

## 22 November 2026 — Zeni receptionist workflow and operational boundaries

User task: thoroughly review the supplied 971-line receptionist workflow and
implement it with Orchestrating buddy. The user's clarification makes the admin
calendar authoritative for schedule checks, the published client/admin information
authoritative for business facts, and separate future offering files an additional
reviewed knowledge input. Sample prices, policies and successful dialogues in the
specification were treated as examples rather than factual instructions.

Receptionist owns the conversation/state/source/API implementation in lib/chatbot,
services/chatbot and app/api/client/chatbot; the additive prisma/receptionist.sql,
installer, focused tests, public facility-data extraction and workflow documents.
Orchestrating buddy owns the strict request/result contract, signed adapter,
calendar/dispatch and inactive workflow drafts (since removed). Client owns the separately requested
chat presentation/compact geometry and its entry below. Admin/client/developer and
Design Checker confirmed no overlapping reservation before the shared schema,
package command and architecture-document changes. The launcher, supplied assets,
Footer, shared tokens, staff authentication, private admin workflows and developer
knowledge-feed permissions were preserved.

Visible/behavioral scope: S0–S7 conversation stages, intent/scope/identity routing,
explicit missing-field collection, remembered details, confirmed corrections,
published-option matching, respectful withdrawal, separate terms and sending
permission, source disclosures, timestamped property-wide calendar checks, consented
staff intake, revision conflicts, interrupted-turn recovery and stable retries.
The Client-owned native modal, initial reverse Tab, Escape/focus return, composer
keyboard/IME handling, avatars, pending bubble, outside-pointer dismissal, compact
size and contextual Forget action remain integrated. Public palettes, type and
spacing reuse existing tokens; no competing visual foundation was introduced.

Privacy/outcome contract: opaque HttpOnly cookie and AES-GCM encrypted state are
separate from staff/developer identity. Saved details expire after 24 hours without
sliding extension; browser bubbles retain 20 exchanges and clear on reload. Expired
rows are physically purged on new-session creation, not by a promised timed job.
Forget removes this session/ledger and does not cancel bookings or erase submitted
inquiries. Recognized credential/identity-document attempts are withheld before
pending-command storage. This pattern guard is not universal sensitive-data detection.

Availability loads only an id marker for strict CONFIRMED overlaps on the one
Zion Events Place resource. Public hall/garden/pool IDs conservatively alias it;
adjacent intervals remain allowed. No client, note, payment, reference or staff
record is disclosed. A clear calendar result is advisory and timestamped, not a
hold or reservation. Booking/reschedule/cancel mutations remain disabled behind
the signed, persisted adapter until an authoritative W2 exists. No external workflow
was activated or executed. No settlement, hold or confirmation was manufactured.
Consented escalation commits one normal NEW inquiry, activity and notification
before reporting staff-intake success; it promises neither a booking nor email
delivery or a response deadline.

Published FAQ/package-version visibility guards remain. Public category/facility
copy shares website configuration; only recognized reviewed paymentRule metadata
is projected from admin policy. Private instructions/contracts/staff identities
and developer documents are excluded. The actual local database had zero published
package records and zero reviewed policies at the readiness check. Future offering
files have not been ingested; unverified rates/capacities remain staff questions.

Concrete findings and corrections:

- Design Checker found that an information question mentioning the venue email
  could replace the visitor contact. Capture now requires an explicit own-contact
  statement, self-identification, standalone contact or a non-question contact-field
  answer. Pure and committed-inquiry regressions preserve the visitor email/phone.
- Restored operational status lacked freshness. Observation/expiry metadata and a
  stale projection now accompany summaries and receipt replays. Effective freshness
  is the earlier of the result deadline and observation plus five minutes; historical
  confirmed status/reference is retained without implying cancellation. Fresh checks
  and staff verification do not silently resubmit a mutation.
- The primary hours reply omitted Sunday and appointment-only while citing all
  facts in a collapsed source. The complete short visits fact set is now in the
  primary reply, with a regression and final desktop/mobile dark frames.
- The expanded-text fixture exposed a collapsed transcript and hidden outer
  overflow. Client corrected its owned CSS: nonzero transcript track, actual outer
  scrolling, nested scroll chaining and bounded mobile decorative/close geometry.
  The final 32px-root test measured a 227px transcript, 502/1095px outer height/scroll,
  auto overflow and 270/270px width. A verified non-textarea inner DIV wheel target
  moved outer scroll 467 to 0 and exposed the header. The earlier horizontal-only
  result and programmatic focus access were not sufficient and are superseded.

Design Checker closed the contact/freshness/hours findings by read-only source and
regression-assertion inspection; it did not independently execute our test suite.
Final source/artifact re-review also closed the panel enlarged-text clipping and
rendered hours findings. Design Checker independently inspected the corrected CSS,
six layout records, non-textarea wheel receipt, final frames and gate receipts,
and matched all 41 recorded source hashes. It did not independently replay the
browser or run a duplicate gate. The scoped findings are closed within those
boundaries; the central whole-page reflow finding remains open.

Actually executed checks before the final gate: strict TypeScript and focused lint;
53 combined chatbot/orchestration tests before the hours regression, then all 21
conversation tests including that regression; real default-query fixture overlap
and adjacency, no private-event leakage, encrypted state/ledger/RLS/isolation,
consented intake deduplication, interrupted recovery, stale GET/replay and safe
failure paths. The local-only additive installer created and checked two private
tables; no existing records were changed. A live localhost:3001 greeting returned
200 and its anonymous test memory was erased; no live inquiry or booking was created.

Final compact-UI browser checks used only localhost:3013 disposable PostgreSQL and
ephemeral keys. The actual visitor flow passed: explicit calendar consent, advisory
result, own-summary reload, committed staff inquiry, venue-email question preserving
visitor contact, and a forced network failure followed by the same action/turn-ID
retry. Initial reverse Tab, multiline draft across Escape/reopen and a 600-character
draft at 320px passed. The separate stricter layout pass checked light/dark, stable
32px-root text, actual outer-wheel access, 320x200 composer access and static labelled
typing under emulated reduced motion. The corrected hours facts appeared before
source expansion. Logs/receipts: outputs/receptionist-browser.log,
receptionist-browser-checks.json, receptionist-layout-browser.log and
receptionist-layout-checks.json. An early attempt encountered a development reload;
an immediate font override also reset before measurement. Stable source/style
replays and explicit geometry/user-scroll checks replaced those intermediate results.

Evidence: C:/Users/jerom/.codex/visualizations/2026/11/22/01a1e870-2dee-7d41-a2bf-e588153feaff/.
Final frames include workflow-empty-desktop.jpg, workflow-calendar-desktop.jpg,
workflow-restored-desktop.jpg, workflow-inquiry-success.jpg, workflow-network-error.jpg,
workflow-mobile-light.jpg, workflow-mobile-dark.jpg, workflow-text-200.jpg,
workflow-reflow-short.jpg and workflow-hours-{mobile,desktop}-dark.jpg. The diagnostic
text-200 frame records the finding, not the accepted correction. All inquiry/price
data in browser evidence belongs to the disposable demonstration fixture.

Full integrated npm run format and unchanged npm run verify passed exit 0. Logs:
outputs/receptionist-workflow-final-format.log and
outputs/receptionist-workflow-final-verify.log. Actual gate: 49 design-foundation
checks, 798-file public boundary, architecture/hygiene, strict TypeScript, 75 passing
tests (54 chatbot/orchestration, 15 administrator, 6 developer), zero-warning lint
and production build. The original gate process survived the interrupted chat;
Client observed its exit and the receptionist owner independently recovered its
exit-0 receipt and inspected the logs. Process-local 768MB heap, one-core affinity,
CIRCLE_NODE_TOTAL=2 and isolated Next output limited memory pressure; all required
checks remained unchanged and the command restored its runtime settings.

Client stopped its disposable preview and restored only validated generated
TypeScript metadata. Both tsconfig.json and next-env.d.ts exactly match the
receptionist's pre-gate snapshots. All 41 recorded application/source hashes match
the pre-gate receipt; all six preserved launcher/Footer/config/asset hashes match
their baseline. Client also checked its five UI hashes and post-cleanup formatting,
types and diff whitespace. The receptionist's post-cleanup global format check
passed. No workflow application change followed its passing gate; subsequent
user-requested launcher refinements are separately owned work.

Limits: 32px-root user CSS is text-scaling emulation, not an OS preference or actual
400% browser zoom. The 320x200 viewport establishes short-height reflow only. The
full page expands to 640px under the shared 20rem minimum; that separate foundation
finding remains open in the central entry below. Screen readers, real devices and
virtual keyboards, nonzero safe areas, every route/contrast blend, forced real
timeout, hidden-tab transitions and real W2 settlement/confirmation were not
established by this review. Operational status variants are contract-tested with
fixtures, not proof of a deployed booking/payment service. No model, future-file
knowledge publication, business KPI/persona acceptance, deployment or universal
accessibility conformance is claimed.

## 22 November 2026 — Open shared root-font reflow finding

Status: open. The standing design/engineering task covers the current application
and future changes. This entry centralizes the shared finding; it records no
application fix or accessibility-conformance pass.

Source: app/globals.css applies min-width: var(--layout-min-width) to html and
overflow-x: clip to html/body. styles/tokens.css defines that minimum as 20rem.
At a 32px root font the minimum resolves to 640px, despite the 100% maximum width.
Clipping excess width does not make the page content reflow into a 320px viewport.
These shared rules can affect public, administrator and developer surfaces where
they apply. No shared CSS, tokens or exception inventory was changed for this record.

Evidence and limits: the receptionist owner reported the public-page root-font
fixture and document width; Design Checker and the admin owner independently
inspected the shared source. Early immediate font overrides could reset during
development rendering, so those snapshots do not establish stable scaling. The
later stable 32px-root observation and source arithmetic establish this finding.
They are not native 200% text/400% browser zoom, real-device or independent
administrator/developer runtime passes. Normal-root 320px checks do not close it.
The admin-side scope and limits are also recorded in [admin-panel.md](admin-panel.md).

A separate confirmed chat-panel defect at the same enlarged root collapsed its
transcript and clipped its oversized header/composer. Client owns that scoped CSS
correction; the receptionist owner owns its stable-scale/user-scroll retest and
integrated evidence/gate. A saved panel correction, bounded panel width or
programmatic focus access does not close this shared whole-document finding.

Coordination: all four existing panel owners were notified. Admin recorded its
source-only limitation; Client and Receptionist agreed to a brief shared-log hold
for this central entry, preserving their feature records. Design Checker owns the
central finding record. Ownership of a future shared-source correction must be
coordinated before edits, with affected public/admin/developer reflow, supported
themes, keyboard/focus, menus/dialogs and relevant state checks. The design standard
and unchanged verification gate remain applicable; no exception or suppression
authorizes acceptance of this defect.

Validation: the focused Prettier write/check passed. A comparison with normalized
line endings confirmed that all preceding feature/history entries were preserved.
No duplicate application tests, browser session, preview or integrated gate was run.

## 21 November 2026 — Dashboard purpose, Revenue emphasis and inset header

User task: add one short purpose sentence below the greeting; present the cards in
the exact order/case Total Revenue, Total Bookings, Upcoming Events, Pending
Inquiries; use #FFE1AF for Revenue; and rebuild the admin header container using
the supplied rounded inset reference. The reference concerns the container, not its
sample search, mail or account content. Admin panel developer confirmed no overlap
and handed this source scope to Design Checker before edits.

Scope: components/admin/DashboardGreeting.tsx, DashboardKpis.tsx,
DashboardKpis.module.css and admin.module.css; docs/admin-panel.md,
dashboard-kpi-contract.md and this record. AdminShell.tsx is unchanged in the final
implementation. Aggregate/report definitions, workflows, APIs, chart cleanup,
Analytics Current snapshot labels, sidebar identity and other panels are retained.
No shared token or dependency changes were needed.

The purpose sentence reads: "Track revenue, bookings, upcoming events, and pending
inquiries in one place." It uses 16px body text and wraps naturally. Revenue uses
the existing --admin-peach token (#FFE1AF) with --admin-on-color dark ink in both
themes, including its quality notices. Its annual/YTD secured-contract definition
is retained, independently of Analytics receipt-based income. Exact accessible
names, static definitions, arrows/percentage badges and warning states remain.

The fixed header now sits 16px from the top/right/sidebar on desktop and 8px from
the viewport edges on mobile. A 20px rounded outer frame surrounds a softly tinted
surface with a 4px semantic card border. Existing account controls and the
collapsed/closed-drawer page indicator retain their behavior. A separate background
pseudo-element applies the optional 94% tint and 16px blur, keeping mobile fixed
popovers relative to the viewport. The fallback surface is opaque. Main-content
top spacing is 110px desktop/94px mobile, and viewport scroll clearance is
102px/86px. The collapsed header moves left with the rail while its right-side
controls remain fixed. Popovers and mobile navigation start below the inset bar.
Existing reduced-motion guards cover the finite resize transition.

Browser checks: actual 1280px desktop and 320×568 layouts were inspected. The
expanded desktop header measured x296/y16/height70; collapsed x96. Mobile measured
x8/y8/height62. Services & Packages fit on two readable mobile lines. Revenue
computed as rgb(255,225,175) with rgb(33,22,16) text. All four mobile cards were
288px wide with equal 286px client/scroll widths, and document width stayed 320px.
The purpose sentence fit its 288px column. Profile/notification keyboard opening,
visible Tab focus, Escape return and profile-link hit testing passed. Mobile
profile and notification panels started at y78 and stayed within the viewport.
The 280px drawer started at y78, retained the 48px logo, made main/header inert,
wrapped Tab from Settings to Close sidebar and restored focus on Escape. The native
category dialog stayed modal above the header at desktop and 288px mobile width;
Escape restored its opener without saving. While Settings scrolled 648px, header
y16 and bell y29 remained fixed, with the background blur inspected visually.
Loading and zero-data layouts were observed; real records/preferences were not saved.

Dark appearance was exercised through a temporary local AdminShell theme override
to avoid another memory-heavy preview server or a saved preference change. The
original file was restored byte-for-byte before final validation (matching SHA256
D29E61A3B2299702E1658E603A164D0B7517B8390450002E3EB1A9835E2C707B). This verified
dark Dashboard/header/drawer appearance, not the persistent theme-save workflow.
The restored light Dashboard was checked with all four final labels, no alerts,
expanded sidebar and closed menus. Temporary browser tabs/viewport overrides were
cleaned up. A disconnected browser session was recovered through the supported
browser inventory; no application server was restarted for these checks.

Evidence: C:/Users/jerom/.codex/visualizations/2026/11/21/01a1e7c9-e34b-7a63-9beb-e82e9a11736e/
admin-inset-dashboard-desktop-light.jpg, admin-inset-dashboard-mobile-light.jpg,
admin-inset-dashboard-desktop-dark.jpg, admin-inset-dashboard-mobile-dark.jpg and
admin-inset-scrolled-dark.jpg. The final light desktop image uses the exact final
labels and supersedes the earlier Sales/revenue wording.

Validation: npm run format passed, followed by the complete unchanged npm run verify
gate (exit 0): formatting, 49 palette/semantic contrast checks, client boundaries
across 731 files, architecture/filesystem hygiene, TypeScript, all 28 application
tests (7 chatbot, 15 admin, 6 developer), zero-warning ESLint and the isolated
production build. Logs: outputs/admin-inset-format.log and
outputs/admin-inset-verify-serial.log. The first full run failed during parallel
PGlite database startup with Array buffer allocation failed, before the affected
assertions. The successful retry used a 768 MB Node heap and one-core affinity on
the gate parent only, serializing Node's default test workers. Its original affinity
was restored afterward; unrelated applications were not stopped or modified. Build
page generation still used Next's configured workers. No scripts, checks, assertions
or lint/type/contrast rules were weakened. A scratch TypeScript backup was renamed
to plain text after the type checker picked it up. Generated admin-preview type
metadata was removed afterward without replacing unrelated configuration.

Post-cleanup npm run format:check and npm run typecheck passed (exit 0; log:
outputs/admin-inset-final-checks.log). tsconfig.json and next-env.d.ts match their
pre-build snapshots. The completed scope, evidence, actual checks and review limits
were sent to the existing Admin panel developer chat. This is a verified handoff,
not a completed independent peer review. The Client panel developer was notified
that the gate finished; its separate chatbot source work was preserved.

Limits: native 200% text scaling/400% zoom, runtime reduced-motion emulation, a
browser without backdrop-filter, assistive technologies/real devices, and populated
or missing-history/error variants were not manually re-exercised in this change.
No universal accessibility conformance or independent peer-review claim is made.

## 20 November 2026 — Compact Dashboard cards from the user's reference

User task: replace the tall colored Dashboard summary layout with the attached
four-card reference. This supersedes the previous summary-card presentation, while
retaining the approved sales, pending inquiry and booking definitions. Admin panel
developer confirmed no overlapping work and assigned Design Checker ownership of
DashboardKpis.tsx, DashboardKpis.module.css and related documentation before edits.

Scope: components/admin/DashboardKpis.tsx and DashboardKpis.module.css;
docs/admin-panel.md, dashboard-kpi-contract.md and this entry. The fixed header,
sidebar, charts, workflows, services, aggregate logic and other panels are retained.
Shared tokens and palettes were reused without changes. No new dependencies or
styling-only tests were added.

Presentation: four neutral cards with thin, softly blended borders and no shadow,
14px muted labels, 24px semibold Inter totals, compact arrow/percentage pills and
short right-aligned signed comparisons. The separate visible section heading,
colored fills, serif totals, dividers and long inline descriptions are removed.
The region retains its accessible heading. Exact values, monetary changes and
scope remain in card names. The native Comparison details disclosure also shows
dates and timestamps, with 14px wrapping text. Incomplete-history
warnings remain visible on affected cards. Existing success colors indicate rising
sales/bookings or fewer unresolved inquiries; other trends use neutral pills.
Words, arrows and signed values preserve meaning independently of color. Evening
Gala uses its semantic dark card and text roles, with existing dark success tokens.
No animation was added.

Browser verification: actual 1280px desktop, 900px intermediate layout and 320×568
mobile were checked using fictional records in the disposable in-memory preview.
The populated cards were approximately 120.4px tall; four columns became two at
900px and one at 320px. The 320px document and 288px cards had no horizontal
overflow. Light and dark renderings retained readable labels, totals, badges and
comparisons. The PHP20.722M fixture displayed PHP20.7M and +PHP5.7M / 38.1%; its
exact PHP20,722,000 total and PHP5,722,000 change were verified in the expanded
mobile disclosure and accessible name. All cards and the disclosure were reached
by Tab with visible focus in both themes. Enter opened the disclosure and followed
Pending inquiries to Inquiries. The fixed header remained above scrolled content.
Loading and live zero-data labels were checked. Stopping only the disposable
server and pressing Refresh produced an alert, retained the successful summary
and enabled retry. Sample theme settings were saved only in the fictional preview;
no live records or preferences were changed. Temporary tabs and viewport overrides
were cleaned up and the preview was stopped.

Evidence: C:/Users/jerom/.codex/visualizations/2026/11/20/01a1e7c9-e34b-7a63-9beb-e82e9a11736e/
dashboard-reference-desktop-light.jpg, dashboard-reference-desktop-dark.jpg,
dashboard-reference-mobile-light.jpg, dashboard-reference-mobile-dark.jpg,
dashboard-reference-details-mobile.jpg, dashboard-reference-live-zero.jpg and
dashboard-reference-refresh-error.jpg. The details image was replaced with a
settled capture showing the exact values after scrolling.

Targeted TypeScript and all 49 design foundation checks passed. The reused success
badge text pairs have calculated opaque contrast ratios of 6.44:1 in light mode
and 9.51:1 in dark mode. npm run format and full npm run verify passed with exit
code 0: formatting, 49 design foundation checks, client boundaries/hygiene, strict
TypeScript, all 28 tests (7 chatbot / 15 admin / 6 developer), zero-warning lint and
the optimized production build. Log: outputs/dashboard-reference-verify.log. No
application source changed after the full gate. Only generated preview type paths
were restored, preserving unrelated TypeScript configuration.

After cleanup, repository format:check and typecheck passed with exit code 0
(outputs/dashboard-reference-final-checks.log). Admin panel developer received the
verified scope, definition-preservation notes, screenshots, checks and limits, and
was handed back source ownership. This notice does not constitute independent
peer review or deployment.

Limits: native 200% text scaling/400% zoom, runtime reduced-motion emulation,
assistive technologies, real devices and populated incomplete-history/new-baseline
browser variants remain unverified. Existing aggregate tests cover empty data and
history gaps; source guards preserve the corresponding UI warnings. No universal
accessibility or independent peer-review claim is made.

## 20 November 2026 — Dashboard business overview and numeric trajectories

User task: replace Awaiting review, Upcoming reservations, Cash received and
Flagged requests with Total sales, Pending inquiries, Upcoming bookings and Total
bookings, each with business direction and numeric change. The user explicitly
selected secured contract value for sales, then clarified current-year accumulated
sales and inquiries not yet secured/settled. Design Checker coordinated ownership
with Admin panel developer before editing; that owner handed over this Dashboard
scope and retained unrelated admin work. Shared foundations and other panels did
not change.

Scope: components/admin/AdminWorkspace.tsx, DashboardKpis.tsx,
DashboardKpis.module.css and types.ts; lib/admin/service.ts,
dashboard-kpis.ts, dashboard-kpi-types.ts and dashboard.test.ts;
docs/admin-panel.md, dashboard-kpi-contract.md and this entry. Query logic is
server-only, presentation is extracted into one feature component, and public API
boundaries, schema, booking/payment workflows and Analytics cash reports remain
unchanged. Existing unrelated local work is preserved.

Annual sales use current confirmed/completed contract values by first recorded
confirmation, compared with the preceding equal-elapsed YTD period in Manila.
Pending is the current unresolved inquiry count excluding closed/spam and verified
secured links. Its trend compares currently unresolved YTD intake cohorts, labelled
as workload. Upcoming includes all future confirmed starts, with next-30-day versus
previous-30-day booked-date activity. Total bookings is all-time secured count, with
newly secured YTD comparison. Absolute changes, percentages, arrows and words make
direction readable without color. Missing dates suppress annual totals/comparisons;
missing origin tracking makes pending an explicit upper bound. No guessed dates or
identity matching are used. See dashboard-kpi-contract.md for the complete contract.

Design: retained Inter/Playfair, oak/peach/taupe/rose and semantic tokens. Secondary
text is at least 14px. Large amounts include compact and exact PHP values, with
natural group breaks. Shared subgrid rows align labels, values, scope and comparison
sections; layout becomes two columns below 1150px and one below 780px. A native
keyboard disclosure explains dates and definitions. All four cards remain links
with exact accessible names. A sampled contrast inheritance issue was corrected
by explicitly applying dark on-color ink to descriptions. No motion was added.

Browser verification: actual 1280px desktop and 320×568 layouts were inspected in
light and dark using a disposable in-memory database and fictional records.
Populated sample annual sales PHP 20,722,000 versus PHP 15,000,000 rendered
+PHP 5,722,000 / 38.1%; pending 3 with +1 unresolved; upcoming 2 and total bookings
5 each showed their distinct −1 / 33.3% activity comparisons. Desktop card heights
and comparison tops matched. Mobile document width was 320px; each card was 288px
wide with no internal horizontal overflow and 14px minimum supporting text.
Tab reached all four cards and the disclosure; focus outlines were visible in
both themes. Enter opened the disclosure and activated Upcoming bookings, which
reached Venue calendar. Loading was observed. Live zero data showed 0/0% without
false growth. Stopping only the disposable server and pressing Refresh produced
an alert, kept the last successful overview and enabled retry. The temporary
viewport and tabs were cleaned up. Only fictional preview settings were saved to
exercise dark mode; no live business records or preferences were changed.

Evidence: C:/Users/jerom/.codex/visualizations/2026/11/20/01a1e7c9-e34b-7a63-9beb-e82e9a11736e/
dashboard-kpis-desktop-light.jpg, dashboard-kpis-mobile-light.jpg,
dashboard-kpis-desktop-dark.jpg, dashboard-kpis-mobile-dark.jpg,
dashboard-kpis-live-zero.jpg and dashboard-kpis-refresh-error.jpg.

Isolated full-schema aggregate assertions passed for empty data, Manila year
boundaries, duplicate confirmations, declined comparisons, future records,
closed/spam inquiries, cancelled/requested bookings, verified inquiry attribution,
and missing confirmation/origin history. Targeted TypeScript and 49 foundation
design checks also passed. Full npm run format and npm run verify completed with
exit code 0: formatting, 49 design checks, client boundaries, project hygiene,
strict TypeScript, all 28 tests (7 chatbot / 15 admin / 6 developer), zero-warning
ESLint and optimized production build. Log: outputs/dashboard-kpis-verify.log.
The disposable preview was stopped and only its generated type paths were
restored; unrelated TypeScript configuration was preserved.

Final repository format:check and typecheck both passed with exit code 0 after
that cleanup (outputs/dashboard-kpis-final-checks.log). No application source
changed after the full gate. Admin panel developer received the verified
implementation handoff, evidence paths, definitions and review limits. Sending
that handoff is coordination, not independent peer review or deployment.

Limits: actual 200% text scaling/400% native zoom, runtime reduced-motion emulation,
screen readers, real devices and missing-history/zero-baseline populated browser
fixtures were not manually exercised. The new component has no animation; existing
motion guards remain. Aggregate tests do not establish historical accounting
snapshots or universal accessibility conformance. The handoff distinguishes these
completed checks from remaining evaluation work.

## 20 November 2026 — Admin sidebar and background palette enhancement

User task: implement an enhancement between the sidebar and the admin background by adjusting their color palette to make them different and have a clear distinction from each other.

Affected files: `styles/tokens.css`, `components/admin/admin.module.css`, `scripts/check-design-system.mjs`, `docs/admin-panel.md`, and `docs/design-change-log.md`.

Implementation:

- Updated the light `--admin-surface-sidebar` token to use Pale Oak (`var(--palette-admin-oak)`, `#E3CAA5`), giving the sidebar a distinct, warm, and natural surface that clearly separates from the `#F5EFE1` canvas background (contrast ratio 1.38:1 in luminance, with distinct warm golden-oak saturation versus pale canvas).
- Updated dark mode `--admin-surface-sidebar` to use the warm charcoal card surface (`var(--palette-admin-night-card)`, `#302622`) over the `--palette-admin-night` (`#211916`) canvas, maintaining surface separation in both themes.
- Updated `--sidebar-selected` in `components/admin/admin.module.css` to use `var(--admin-surface-page)` so the active nav item smoothly merges into the canvas with concave inverse curves (`.active::before`, `.active::after`), seamlessly connecting the active navigation destination with the workspace surface.
- Added explicit sidebar text contrast checks in `scripts/check-design-system.mjs` for `--admin-ink` (11.17:1 in light, 13.14:1 in dark) and `--admin-muted` (4.60:1 in light, 8.62:1 in dark) on `--admin-surface-sidebar`, expanding verified contrast checks from 45 to 49.
- Preserved existing layout geometry, 80px rail collapsing, responsive mobile drawer, keyboard accessibility, 44px touch targets, and all business workflows.

Validation:

- `npm run format:check` passed.
- `npm run check:design` passed all 49 contrast checks with zero new design exceptions.
- `npm run check:client-boundary` passed across 595 files.
- `npm run check:hygiene` passed.
- `npm run typecheck` passed with 0 errors.
- `npm run test:admin` passed all 15 tests.
- `npm run lint` passed with 0 warnings.
- Production build verified.

Review limits: Real assistive devices, actual 200% text scaling / 400% browser zoom, and live client database operations remain separate review obligations. The enhancement focuses on the surface palette distinction between the sidebar and admin background.

## 19 November 2026 — All-panel design coordination and admin color audit

User tasks: check the admin color combination and make design coordination mandatory with the existing admin, client, receptionist, and developer work chats after panel updates or enhancements.

Admin color review: the approved warm palette is cohesive. The existing 45 design checks passed. Sampled rendered text in light Settings/Booking and the unsaved dark Settings preview passed the applicable text thresholds. The light theme was restored, no settings were saved, and the review ended on Dashboard. Main ink/page contrast is 15.43:1; primary label/fill 13.14:1; ink/taupe 5.66:1; ink/rose 4.80:1. Muted text on oak is 4.60:1 and should not be faded further.

Open findings: the booking search placeholder uses 50% ink over white, approximately 3.39:1, below the 4.5:1 normal-text target. An explicit muted placeholder color at full opacity is recommended. The taupe border is 3.13:1 against white but 2.73:1 against the cream page around filter/date fields; control boundaries need stronger contrast against their actual adjacent surfaces. Keep the approved taupe fill and consider a separate darker control-border role. Decorative boundaries are not automatically subject to the same requirement. The review did not change application colors or fix these findings; they were sent to the administrator work chat as recommendations.

Coordination: all four existing work chats received the user's standing-rule notice. AGENTS.md now records their verified titles/IDs, source-ownership notices before shared edits, and verified handoffs after affected-panel updates. The design standard and PR checklist match this process. Approved panel-specific palettes and unrelated active implementation work must be preserved. The administrator chat's separately authorized chart work is outside this documentation change.

Validation and limits: the color gate passed; only the sampled screens/states were visually reviewed. This is not an exhaustive rendered-contrast, screen-reader, zoom, real-device, or populated-business-state audit. Focused documentation formatting and diff checks passed. The full `npm run verify` attempt stopped at formatting findings in `lib/admin/dashboard.ts` and `lib/admin/service.ts`, under the administrator chat's active chart implementation. Its owner was notified, those source files were left under its ownership, and no current full-suite pass is claimed. Evidence: `C:/Users/jerom/.codex/visualizations/2026/11/17/01a1e7c9-e34b-7a63-9beb-e82e9a11736e/admin-color-review-2026-11-19.jpg`.

## 17 November 2026 — Shared foundations and mandatory quality gates

User task: make the current system and all future enhancements visually consistent, accessible, and maintainable; coordinate changes with admin panel dev.

Implemented:

- Shared semantic palette, self-hosted licensed fonts, type scale, spacing, motion, focus, and responsive foundations across public/admin/developer styling.
- Readable homepage content on initial render; native modal public navigation and gallery viewer; pause controls for automatic heroes/video; reduced-motion fallbacks; readable non-animated statistics.
- Persistent contact labels, native selects, and validation messages that remain until corrected.
- Consistent source formatting, accessibility lint, a no-new-style-exceptions check, contrast token checks, CI workflow, review template, and governing repository instructions.
- Preservation of unrelated local work and preview artifacts. Local ignored screenshots no longer incorrectly fail repository hygiene.

Validation results are recorded after execution below. Styling literals were migrated into the approved palette; `design-exceptions.json` is now restricted to browser metadata and the independent root-error fallback. Small pixel/rem text declarations are rejected. Complete rendered-contrast, screen-reader, zoom, and authenticated-workflow evaluation remains a separate review obligation; the implementation is not a WCAG/ISO certification.

Coordination: initial notice acknowledged by admin panel dev (`01a1b015-4221-74e3-9436-578e8066c855`); verified implementation handoff sent after checks, including ongoing requirements and review limits.

Verified results:

- `npm run verify` passed: formatting, design, public boundary, hygiene, strict types, all 10 admin and 6 developer tests, zero-warning lint, and production build.
- After the last carousel refinement, formatting, focused lint, all 21 palette/semantic contrast checks, and the production build passed again. The standalone error reference color was subsequently aligned to the readable muted palette and rechecked by the design gate.
- Negative probes confirmed the design gate rejects an additional RGBA shadow literal and `text-[0.7rem]`. Temporary probe files were removed.
- Browser review: public About/Contact and the disposable admin dashboard; 320px public/admin layouts had no horizontal page overflow. Contact controls rendered at 16px. Verified visible labels, persistent validation errors, native selects, carousel pause/resume, navigation Tab/Shift+Tab containment, Escape, and trigger focus restoration. The mobile admin toggle measured 44px wide at x=16px.
- The disposable admin preview used only a temporary test database and fixture account; its server was stopped and added preview type paths removed. Existing user preview files were preserved.
- Evidence: `C:/Users/jerom/.codex/visualizations/2026/11/17/01a1e7c9-e34b-7a63-9beb-e82e9a11736e/design-review.jpg`.

Review limits: no exhaustive screen-reader, real-device, 200% text-size/400% zoom, live reduced-motion emulation, all-theme, or authenticated developer-workflow review was performed. Selected opaque color pairs were tested; gradients, photographs, blended surfaces, and every component state still require contextual review. Branch protection must be configured by the repository owner to make the included CI job mandatory for merging. These limits do not exempt future changes from the documented process.

## 17 November 2026 — Public visitor chatbot

User task: serve as the chatbot co-developer and make it function for its purpose. The user confirmed a public website assistant for visitor questions, authorizing this new feature after the legacy Smart Assistant was removed.

Affected screens/files: public-page Ask Zion launcher and dialog (`app/layout.tsx`, `components/chatbot/`); public chatbot endpoint and request/retrieval/source modules (`app/api/client/chatbot/`, `lib/chatbot/`, `services/chatbot/`); shared public FAQ data and FAQ page (`config/public-faqs.ts`, `app/faq/`); shared visiting hours and Contact rendering (`config/brand.ts`, `config/chatbot.ts`, `app/contact/page.tsx`); isolated preview output configuration and script (`next.config.ts`, `scripts/preview-chatbot.mjs`); test command and documentation (`package.json`, `README.md`, `docs/architecture.md`, `docs/developer-panel.md`, `docs/chatbot.md`). Existing unrelated local work was preserved. No token palette or legacy-exception inventory was changed.

Implemented: exact published source excerpts and citations, bounded previous-question context, conservative matching, staff contact for unsupported/live operational questions, in-memory chat/clear, persistent failures and preserved input for retry, request limits and same-origin validation, maintenance/visibility guards, and published FAQ/package snapshot isolation. Public FAQs now use the same published version as their chatbot citation, with the original static FAQ fallback only before managed FAQ records exist. Visiting-hour text is shared with Contact. UTC scheduling avoids early publication when the database session uses Manila time. Native dialog behavior includes initial focus, keyboard containment, Escape, restored launcher focus, and a sticky close header. The launcher is disabled until hydration makes its handlers ready.

Checked in an isolated in-memory PostgreSQL preview with demonstration package data and outbound integrations disabled:

- Seven chatbot tests passed, covering common questions, exact evidence, follow-up prices, refusal/handoff, bounded requests, process budget, published versus draft data, future/expired/hidden FAQs, hidden packages/categories, settings, and safe failure responses.
- Headless installed Chrome review passed on desktop and at 320 CSS px in light/dark themes, with no horizontal page or dialog overflow. Native modal/background inertness, Tab/Shift+Tab wrapping, Escape, trigger focus restoration, and visible input focus were checked.
- Success, empty-chat, empty/invalid input, unknown-answer, staff handoff, loading, disabled controls, simulated HTTP 503, simulated offline failure, retained input, and successful retry were checked through the UI. The public launcher was absent from admin/developer routes.
- 200% root text-size review preserved horizontal reflow and reachable controls; 320 CSS px provides the layout width used for 400% reflow assessment on a 1280px desktop. Reduced-motion preference was emulated and the chatbot introduces no animated effects.
- Screenshots are in `C:/Users/jerom/.codex/visualizations/2026/11/17/01a1e870-2dee-7d41-a2bf-e588153feaff/`: `chatbot-desktop-light.png`, `chatbot-desktop-dark.png`, `chatbot-mobile-light.png`, `chatbot-mobile-dark.png`, and `chatbot-text-200.png`.
- Read-only readiness check against the currently configured database: maintenance is off, FAQ/package visibility is on, and eligible sources total six FAQ answers, 25 policy/terms sections, two venue sources, one contact source, and **zero published package snapshots**. Package-specific prices therefore require approved catalog publication; the demonstration preview price was never written to the real database. Public site brochures were not transcribed into unverified structured prices.

Full quality gate: `npm run format` and `npm run verify` passed, including formatting, all 45 contrast/token checks, boundary and hygiene checks, strict TypeScript, all 23 chatbot/admin/developer tests, zero-warning lint, and the optimized production build with `/api/client/chatbot`. The deliberate database-failure test logs its expected fixture error and passes. The disposable preview was stopped and its generated TypeScript include entries were removed.

Coordination: notice was sent to the existing admin panel dev chat before shared integration edits; the verified implementation handoff was sent to `01a1b015-4221-74e3-9436-578e8066c855`, including affected files, shared rules, results, the empty published package catalog, and remaining review/production limits.

Limits: native browser 400% zoom, real mobile/virtual-keyboard behavior, screen-reader announcement quality, representative visitor evaluation, deployed proxy/origin behavior, and production load were not manually verified. The chatbot is an extractive first version with limited synonyms and previous-question context; it does not use a generative model, live staff connection, booking calendar, or payment processor. Business owners must review published source accuracy and contradictions. The 120/minute budget is per process and needs a shared ingress control in scaled production. No production deployment or real venue database migration was performed. See `docs/chatbot.md` for the operational/source contract.

## 17 November 2026 — Client media overlay cleanup

User task: remove the visible playback wording, including "Video paused", and the pause/play icons from the client frontend.

Affected files: `components/client/AutoplayVenueVideo.tsx`, `components/client/CinematicHeroBackground.tsx`, `components/client/SubpageHero.tsx`, and the new client-local `MediaPlaybackControl.tsx` / `MediaPlaybackControl.module.css`. Affected screens: the homepage hero and venue videos, and public page-header slideshows.

Implemented:

- Removed persistent playback labels, paused-video messages, and slideshow pause/play icons. Slide navigation dots remain available.
- Reused one text-only playback control that is visually hidden until focused. Keyboard and screen-reader users retain playback controls; normal pointer/touch viewing has no persistent playback overlay, as requested.
- Preserved existing autoplay, explicit pause state, hidden-tab handling, and reduced-motion behavior. Shared tokens, primitives, administrator screens, and backend workflows were not edited for this change.

Verified results:

- `npm run format` and `npm run verify` passed, including formatting, 21 contrast token checks, architecture/boundary checks, strict types, all 10 admin and 6 developer tests, zero-warning lint, and the production build. The build used the existing isolated output setting to preserve the running development server.
- Browser review covered Home and About at desktop and 320px widths, with no horizontal page overflow. Unfocused playback controls were clipped to 1px, with no playback icons. Screenshots confirmed that playback wording and icons do not appear during ordinary viewing.
- Tab navigation revealed the text controls and their focus indicators. Enter paused and resumed the homepage background video; Enter paused a venue video. Focusing the slideshow control paused rotation. The normal slideshow and slide dots remained visible.
- Evidence: `C:/Users/jerom/.codex/visualizations/2026/11/17/01a1e86c-a06e-7563-ba02-c4eef00d1662/client-playback-overlays-removed.jpg` and `client-mobile-media.jpg` in the same directory.

Review limits: checks used the default light theme and a desktop browser. Real devices, full screen-reader evaluation, 200% text scaling, actual 400% zoom, alternate themes, live reduced-motion emulation, blocked-autoplay fallback, and every public route were not manually tested. Playback text intentionally appears while its control has keyboard focus. This is not a complete accessibility conformance evaluation.

Coordination: the initial scope notice and the verification handoff were sent to admin panel dev (`01a1b015-4221-74e3-9436-578e8066c855`), including affected files, results, and review limits.

## 17 November 2026 — Admin warm palette and balanced color distribution

User task: apply Ivory Mist, Pale Oak, Soft Peach, Dusty Taupe, and Dusty Rose throughout the admin panel, using the supplied dashboard image as a reference for balanced color distribution.

Affected: shared token definitions (admin-scoped roles only), admin shell theme scope, the admin CSS Module, the design contrast gate, and admin documentation. The transparent header/sidebar, existing contents, menu order, typography foundations, controls, and operational workflows are retained.

Implementation: ivory canvas and light content surfaces; oak/peach/taupe/rose summary cards; coordinated form, table, calendar, catalog, profile, notification, modal, and status colors; warm charcoal dark mode. Dark text on the exact taupe/rose swatches provides readable labels. The gate adds 24 admin light/dark contrast checks to the existing 21 checks without expanding the runtime exception inventory.

Browser review: all primary admin destinations plus Profile and both Settings sections were opened at desktop and 320px in the light theme, with no horizontal document overflow. Dark preview checks covered the dashboard, main settings, calendar, list pages, catalog, notification panel, collapsed sidebar, and a 320px dashboard/dialog. Exact rendered summary swatches were confirmed in both themes. The dark skip link retains readable card/ink roles. Keyboard focus revealed the compact sidebar toggle and Enter expanded it. The isolated test database covered sign-in/loading, empty catalog, saved category feedback, duplicate-slug error feedback, and editor focus/Escape. No live business records or saved appearance/security settings were changed. The temporary preview was stopped after review.

Review limits: actual 200% text scaling / 400% browser zoom, live reduced-motion emulation, screen-reader evaluation, real devices, every populated business state, and every blended-surface contrast pair remain unverified. Existing reduced-motion CSS remains in place; this update adds no motion. Catalog dialog focus return to its opener was not reliable in the browser review; full dialog Tab containment and focus restoration need separate interaction remediation. Those workflows were not changed by this color-only task.

Verification: `npm run format` and `npm run verify` passed, including 45 palette/semantic contrast checks, public/architecture/hygiene checks, strict types, all 7 chatbot / 10 admin / 6 developer tests, zero-warning lint, and the optimized production build. The build used the existing isolated admin output setting to preserve the development server. Admin scrollbars now use taupe rather than inheriting the public gold thumb. The temporary generated type paths were removed after verification; the final format check and type check also passed. A newly added, ignored chatbot-readiness scratch script needed its environment assignment expressed with Object.assign for the strict Node types; its behavior and all application workflows were retained. Evidence: `outputs/admin-warm-palette-dashboard.jpg`, `outputs/admin-warm-palette-mobile.jpg`, and `outputs/admin-warm-palette-dark.jpg`.

Coordination: this is the admin panel dev chat named in AGENTS.md. Its shared-foundation notice and review handoff are recorded here and in this entry; no other chat was created or messaged.

## 19 November 2026 — Admin background refinement

User task: change the admin background shown in the supplied dashboard screenshot to #F5EFE1.

Affected files: styles/tokens.css and docs/admin-panel.md. Added an admin canvas token and connected the existing light page-surface role to it. The transparent header and sidebar share that canvas. The original ivory swatch and dark canvas retain their existing roles.

Verification: `npm run format` and `npm run verify` passed, including 45 contrast checks, strict types, all existing tests, zero-warning lint, and the production build. The existing isolated build output preserved the running development server.

Browser review: the light dashboard renders `rgb(245, 239, 225)` (#F5EFE1); the header and sidebar remain transparent over it. Desktop and 320px dashboard layouts showed no horizontal page overflow. Keyboard navigation revealed the sidebar toggle's visible focus indicator. The 320px Settings dark preview retained its existing `rgb(33, 25, 22)` canvas; previewing Light Mode restored the new light canvas. No settings were saved. Evidence: `outputs/admin-canvas-f5efe1.jpg`.

Review limits: actual 200% text scaling / 400% zoom, live reduced-motion emulation, screen-reader evaluation, real devices, and full populated/error/success business workflows were not retested for this surface-color change. The existing empty dashboard and theme preview were reviewed. Shared-foundation scope and results are recorded in this admin panel dev chat.

## 19 November 2026 — Restore the separate sidebar color

User task: restore the sidebar to its previous color while keeping the new admin background.

Affected files: styles/tokens.css, components/admin/admin.module.css, and docs/admin-panel.md. Added a semantic sidebar surface role using the existing #FFFBE9 ivory swatch in light mode and the existing warm charcoal in dark mode. The sidebar consumes that role in both expanded and compact states. The main light page canvas remains #F5EFE1.

Verification: `npm run format` and `npm run verify` passed, including 45 contrast checks, strict types, all 7 chatbot / 10 admin / 6 developer tests, zero-warning lint, and the optimized production build. The existing isolated build output preserved the development server.

Browser review: the expanded and 80px compact sidebar render `rgb(255, 251, 233)` (#FFFBE9), while the main canvas remains `rgb(245, 239, 225)` (#F5EFE1). The top header remains transparent. At 320px, the open sidebar retains the ivory color with no horizontal page overflow. Keyboard focus revealed the compact toggle; Enter expanded it. Escape closed the mobile menu and restored focus to its toggle. The dark Settings preview retained the existing warm charcoal sidebar and canvas. No settings were saved. Evidence: `outputs/admin-sidebar-restored-ivory.jpg`.

Review limits: actual 200% text scaling / 400% zoom, live reduced-motion emulation, screen-reader evaluation, real devices, and full populated/error/success business workflows were not retested for this sidebar surface change. Existing empty dashboard and theme-preview states were reviewed. Shared-foundation scope and verification handoff are recorded in this admin panel dev chat.

## 19 November 2026 — Dashboard charts with depth

User task: add dashboard pie, bar, and related charts with a 3D appearance using the supplied references. The user also authorized ongoing coordination with Design Checker after every admin update or enhancement.

Scope: dedicated DashboardCharts component/CSS; dashboard aggregate, shared response types and chart geometry; dashboard integration; aggregate/geometry tests and admin test command; admin documentation. The admin-specific standing coordination rule was recorded in AGENTS.md, then Design Checker extended the wider panel coordination guidance under its own source ownership. No palette tokens, business workflows, live saved settings, or real venue records were changed.

Implementation: grouped monthly booking/inquiry bars; an all-time current-reservation donut; a monthly non-voided cash area trend; 6/12-month selector; exact-value tables; labelled empty states. Extrusion and shading provide static depth. Queries return twelve Manila calendar-month buckets, use explicit UTC-offset bounds to avoid database-session timezone errors, exclude future-dated activity/receipts, and reject unsafe cash totals. The existing all-time cash card retains its separate scope.

Verification: `npm run format` and `npm run verify` passed, including 45 design contrast checks, boundaries/hygiene, strict types, 7 chatbot / 12 admin / 6 developer tests, zero-warning lint, and the optimized production build. New tests cover Manila boundaries with a Manila-configured database session, zero-filled months, current reservation counts, future-dated activity, voided receipts, privacy of aggregate values, and empty/single-slice/large-value chart geometry. The isolated build output preserved the running development server.

Browser review: desktop and 320px chart layouts in light/dark themes; the 6/12-month control; keyboard disclosure toggling and visible focus; readable data tables; populated test figures and live empty states. The corrected tables wrap inside the cards, with all three expanded 12-month tables fitting the 320px page without horizontal overflow. Compact month labels stay on one line. Stopping the temporary preview and refreshing produced an announced fetch error. The authenticated live dashboard currently has no chart activity; no demonstration records were inserted into it. Populated screenshots use an in-memory test database only, now stopped. Theme saves occurred only in that disposable preview.

Evidence: `outputs/dashboard-charts-populated-preview.jpg`, `outputs/dashboard-cash-chart-preview.jpg`, and `outputs/dashboard-charts-dark.jpg` show temporary test figures. `outputs/dashboard-charts-live-empty.jpg` and `outputs/dashboard-charts-mobile.jpg` show the live zero-data state.

Review limits: actual 200% text scaling / 400% browser zoom, live reduced-motion emulation, screen readers, real devices/virtual keyboards, recovery after an outage, and every populated workflow were not manually verified. The charts add no automatic movement or chart animation. The earlier booking placeholder/control-border audit findings and catalog dialog focus-return issue remain outside this chart task. The completed chart handoff was sent to Design Checker (01a1e7c9-e34b-7a63-9beb-e82e9a11736e), including source scope, verified results, screenshots, and review limits. An implementation notice and source ownership agreement were exchanged earlier. Design Checker completed its independent read-only review with no blocking findings. It independently checked source/evidence, 45 design checks, live period switching, keyboard disclosures/focus, and 320px reflow. Its populated/dark review relied on the isolated fixture screenshots; the broader review limits above still apply. One non-blocking finding requested an explicit all-time subtitle.

## 19 November 2026 — Chart scope clarification after review

Applied Design Checker's scoped P3 recommendation in components/admin/DashboardCharts.tsx: the visible reservation subtitle now reads "All-time · current reservation status". Monthly filtering and all aggregate behavior are unchanged. This clarifies the existing donut scope next to the 6/12-month control.

Follow-up verification: npm run format and npm run verify passed (45 design checks; 7 chatbot / 12 admin / 6 developer tests; strict types; zero-warning lint; production build). The all-time subtitle was visible with the 12-month selection and at 320px with no page overflow. The default six-month view and viewport were restored. This copy-only follow-up used the existing light live zero-data view; the broader accessibility/theme review limits above remain. Evidence: outputs/dashboard-chart-scope-clarified.jpg. The resolution and completed verification were sent to Design Checker.

## 19 November 2026 — Business analytics and period reports

User task: add overall income, pending balances, a clear business trajectory, inquiry-to-solid-booking conversion, and booking/event reports for weeks, months, quarters, and years, with animated 3D-style charts. The user explicitly selected income and confirmed bookings as the comparison basis and required ongoing Design Checker coordination.

Affected scope: components/admin/AnalyticsOverview.tsx and its CSS Module, AnalyticsCharts.tsx, ChartPrimitives.tsx, DashboardCharts.tsx, AdminWorkspace.tsx, AdminOverviewSections.tsx, Forms.tsx and types.ts; lib/admin/analytics.ts, analytics-types.ts, analytics-period.ts, analytics-math.ts and analytics-export.ts; the admin service, analytics and workflow integration tests; the admin test command and reporting documentation. No shared palette/font tokens, public UI, schema migration, authentication policy, or booking confirmation/payment safeguards were changed by this analytics enhancement. Existing all-time reservation and event-type summaries remain below the new reports. Dashboard drawing/disclosure primitives are reused; its charts retain static depth.

Implemented: Manila calendar period/date controls; explicit selected and comparison ranges; equivalent elapsed comparisons for current periods; income/booking trajectory states with zero-baseline and missing-history handling; selected cash income and all-time cash totals; current secured balances, collection progress, past-event unpaid balances, approved prospective request value and overpayment flags; first-confirmation counts, secured event dates, completed/upcoming events and distinct inquiry cohort outcomes. Cash excludes voided and future receipts. Conversion uses verified source inquiry ids persisted in existing CREATE audit metadata, including known direct requests; names/emails/editable notes never establish lineage. Historical tracking gaps produce unavailable rates rather than invented conversions. Balances and inquiry outcomes are clearly current snapshots, including in historical reports. Expenses are not recorded, so no profit/loss is claimed.

Visuals and interactions: the approved ivory/oak/peach/taupe/rose palette, Inter/Playfair typography and shared geometry/motion tokens; extruded area, donut and bar charts; exact-value native disclosure tables; aggregate-only UTF-8 CSV with PHP units, dates, quality notes and spreadsheet text-cell escaping. Entry/period-change and hover depth effects are finite (320ms, one iteration), with static essential content and both JavaScript/CSS reduced-motion guards. Period navigation retains keyboard focus while a report refreshes. Exports are disabled while updating or after an update failure; the last successful report remains explicitly dated and labelled on failure.

Automated checks: npm run format completed; the full npm run verify passed formatting, all 45 design foundation checks, architecture/public boundaries and hygiene, strict types, all 7 chatbot / 15 admin / 6 developer tests, and zero-warning lint. The optimized production build also completed successfully on 19 November. New isolated tests cover Manila/weekly/monthly/quarterly/yearly boundaries, leap/short-prior months, single-bucket periods, elapsed comparisons, trajectory states, no prior activity, voided/future receipts, balance clamping/overpayments, deduplicated confirmation events and inquiry conversion, untracked origins/undated confirmation history, CSV values/privacy/escaping, and validated inquiry-prefill/create attribution with rollback on invalid origin. Test records remain in disposable in-memory PostgreSQL databases.

Browser review: desktop and 320px light/dark Analytics; weekly/monthly/quarterly/yearly switching, previous/current periods and exact comparison dates; positive and declining trajectory fixtures; live empty state; initial loading, CSV success and refresh failure with a retained report and disabled export. All five exact-value tables were expanded by keyboard on a 12-month report at 320px, with page width 320px and no table/page overflow; disclosure and previous-period focus outlines were visible. The previous-period trigger retained focus after its refresh. The downloaded weekly CSV matched the displayed income/counts and was moved to ignored outputs. Current browser motion preference was no-preference; computed chart motion was 0.32 seconds and one iteration. Live reduced-motion preference switching was not emulated. The temporary populated preview was stopped, viewport overrides reset, and the live light Analytics page left open on port 3001. No demonstration bookings, receipts, inquiries, or saved theme preferences were written to the real venue database.

Evidence (fictional preview figures): outputs/analytics-3d-charts-preview.jpg, analytics-3d-bars-dark.jpg, analytics-desktop-dark.jpg, analytics-mobile-dark.jpg, and analytics-mobile-tables.jpg. Live zero-data evidence: outputs/analytics-live-empty.jpg. Aggregate export check: outputs/analytics-verified-week.csv. The older analytics-populated-overview.jpg was captured before compact KPI formatting and is not final evidence.

Limits: actual 200% text scaling / 400% browser zoom, live reduced-motion emulation, screen readers, real devices/virtual keyboards, every blended contrast pair, recovery after an outage, and human evaluation remain unverified. Incomplete-attribution/undated-history/overpayment cases were covered by isolated automated tests, not manual populated UI fixtures. Past reports show current record outcomes and balances rather than frozen historical snapshots. Existing unrelated booking placeholder/control-border and catalog-dialog focus-return findings remain separate.

Coordination: Design Checker received the scope and reporting contract in advance and agreed to read-only review without overlapping source edits. Completed scope/evidence handoff was sent on 20 November; independent read-only review is pending. A fresh npm run format and npm run verify completed on 20 November with exit code 0, including the optimized production build (outputs/analytics-final-verify.log). Build-generated preview type includes were then removed; final formatting/type-check results are recorded in outputs/analytics-housekeeping.log. The browser evidence above is from 19 November, not a fresh 20 November live evaluation. No adviser suggestions are being implemented from the subsequent read-only audit request.

## 20 November 2026 — Admin controls and page hierarchy

User task: modernize buttons, placeholders, boxes and layouts across admin pages while keeping the interface elegant, clear, spacious, functional and focused on essential content. This is a new direct user request, separate from the earlier read-only adviser audit and completed Analytics implementation.

Source ownership: admin panel developer notified Design Checker before edits. Design Checker explicitly confirmed admin ownership of components/admin styling, forms/page composition and focused dialog fixes, and remained read-only. No shared token/primitives files or other panel surfaces were edited by this design task.

Affected source: components/admin/admin.module.css; AdminWorkspace.tsx; Forms.tsx; BookingDetail.tsx; AdminOverviewSections.tsx; ServicesPackages.tsx; CatalogEditor.tsx; SystemSettingsForm.tsx; AnalyticsOverview.tsx and its CSS Module; new AdminBadge.tsx and MobileBookingRegister.tsx. Documentation: docs/admin-panel.md and this record. Existing unrelated local work and earlier Analytics source were preserved.

Implemented: consistent token-based controls/cards/spacing and opaque input hints; stronger semantic control boundaries; quieter refresh actions and clear primary buttons; optional search filters with active counts, applied scopes and result status; client/event/agreement form fieldsets and first-field focus; labeled mobile registers and team cards; readable receipt cards with expandable correction forms; contextual receipt/agreement sections; collapsible advanced Settings and all-time Analytics details; an explicit theme-selection checkmark and compact switch track inside a 44px target. Essential data/actions remain reachable. Server workflows, role permissions, independent business statuses, cash/confirmation guards, Analytics definitions and export protections were not changed.

Interaction fixes: booking reviews focus their heading, scroll into view without animation and return to their opener (search is the fallback). Catalog uses the existing shared focus-containment helper; Escape/Cancel and successful category-save focus return were manually verified, including the fallback after the original empty-category trigger disappeared. Duplicate-slug failure retains the typed name/slug, focuses its persistent alert and returns the editor scroll to the top. Native sticky editor header/actions remain usable at 320px. Contextual receipt corrections preserve the original reason/confirmation flow and role guards.

Browser checks on 20 November: all twelve admin screens (Dashboard, Booking, Contract, Calendar, Inquiries, Payment, Services & Packages, Analytics, Team, Settings, System Logs, Profile) were visited with populated disposable fixtures at desktop (1280px viewport) and 320px in light/dark themes. Document width did not exceed the viewport. Representative forms, records, receipts, dialogs, Settings, profile, calendar and directory layouts were visually inspected. All five expanded yearly Analytics data tables fit 320px (about 254px table width). Search was tested with zero matches and a specific reference; results were announced. Native keyboard disclosures, visible focus, booking-open/close focus, new-request first focus, modal forward/reverse Tab, Escape, Cancel, successful category save and duplicate-slug error were exercised. A dark package editor also retained focus containment and Escape return. Advanced Settings were expanded at 320px without overflow. Theme saves and one hidden-from-clients category creation occurred only in the disposable database. No real venue records or saved preferences were changed.

Rendered contrast checks: placeholder opacity was 1, with 16px input text. Placeholder contrast was 7.28:1 in light mode and 9.30:1 in dark mode. Derived field borders measured 3.93:1 against a light card / 3.43:1 against the light canvas, and 5.91:1 against a dark card / 6.93:1 against the dark canvas. These are measured pairs, not a full WCAG conformance claim. The approved palette/fonts remain in use; no competing colors or font family was introduced.

States/evidence: initial loading, real empty bookings, populated records, search-empty feedback, catalog save success/disabled controls, persistent server validation, and report refresh failure were checked. The stopped-preview report kept its visible dates/last successful data and disabled CSV export. The preview was stopped, temporary viewport overrides reset and the live light Booking page left open on port 3001. Switching between test/live localhost ports generated development JWT secret-mismatch notices; normal authorized local entry restored the main session. Authentication settings/code were not modified, and an empty console was not claimed.

Screenshots: outputs/admin-refinement-live-bookings.jpg and admin-refinement-live-form.jpg show the live empty-data view. Fictional fixture evidence: admin-refinement-bookings-light.jpg, admin-refinement-booking-mobile.jpg, admin-refinement-form-mobile.jpg, admin-refinement-receipts-mobile.jpg, admin-refinement-dialog-mobile.jpg, admin-refinement-booking-dark-mobile.jpg, admin-refinement-settings-dark.jpg, admin-refinement-team-dark.jpg and the per-screen admin-refinement-*-light.jpg files. The report failure is in admin-refinement-report-error.jpg. Populated figures/names are temporary test fixtures, not live business data.

Verification: focused TypeScript/lint checks passed during implementation. npm run format and npm run verify completed on 20 November with exit code 0: formatting, all 45 foundation checks, boundaries/hygiene, strict TypeScript, 7 chatbot / 15 admin / 6 developer tests, zero-warning lint and optimized production build. Evidence: outputs/admin-refinement-verify.log. The isolated build preserved the running development server; only its temporary admin-preview type includes/imports were restored afterward. Final formatting/type-check evidence is in outputs/admin-refinement-final-checks.log. No new implementation-mirroring tests were added for reversible styling; existing domain, workflow, report and privacy tests remain required.

Limits: actual 200% text scaling / 400% browser zoom, live reduced-motion emulation, screen readers, real devices/virtual keyboards, every blended contrast pair and all mutations/edge states were not manually verified. Reduced motion was checked in source; the new JavaScript focus scroll is instantaneous. Package-save pagination/fallback focus, every financial/contract mutation and outage recovery were not manually exercised. No outbound notifications, contracts, real payments, authentication changes or adviser-plan implementations were performed.

Design Checker completed an independent scoped read-only review on 20 November: sampled Booking controls resolved the earlier placeholder/control-border findings; native dialog keyboard/Escape/Cancel, search/filter feedback and mobile yearly data disclosures were independently checked. Its own 45 design assertions passed, and it inspected the successful 28-test/lint/build/final-check logs. It reported one P2: content overlapped the transparent sticky mobile header. Populated/dark and category-save/error cases relied on the supplied fixture evidence. Its review retains the stated zoom, motion, assistive-technology, real-device and workflow limits; it is not universal conformance or broad adviser/workflow approval.

## 20 November 2026 — Sticky admin header follow-up

Design Checker finding: at 320px, scrolled Analytics summary content could show through the transparent sticky header and overlap the page title/account controls. The supplied receipt screenshot showed the same problem. Admin panel developer owns this scoped correction; Design Checker remains read-only.

Changed components/admin/admin.module.css only: the sticky topbar now uses the opaque approved admin page-surface token in both themes. Admin documents with an actual topbar reserve 96px of scroll clearance using shared spacing/header tokens; the booking detail margin is reduced to the normal spacing token to avoid adding the old header offset twice. Login/public surfaces, business behavior and shared tokens are unchanged.

Targeted browser checks: a disposable preview on 127.0.0.1 kept its cookies separate from the live localhost session. At 320px, all five yearly Analytics tables were keyboard-expanded in light and dark themes. Header background resolved to rgb(245,239,225) and rgb(33,25,22), respectively, with no content bleed. The sticky header ended at y=62; the focused report disclosure remained at y=559–603. Reverse Tab in light mode put the prior disclosure at y=448–492. The page width stayed 320px. The mobile dark sidebar logo/navigation remained below the header, and Escape restored its toggle. Opening a booking focused its heading at y=158–185; closing returned to the record control at y=445–495, both clear of the header. Viewport overrides were reset and the temporary preview was stopped. No real settings/data or authentication changes were made.

Evidence: outputs/admin-header-light-mobile.jpg, admin-header-dark-mobile.jpg and admin-header-booking-focus-mobile.jpg show fictional populated preview data. Actual 200% text/400% zoom, live reduced-motion emulation, screen readers/real devices and full workflow evaluation remain outside this targeted review.

Verification: npm run format and npm run verify completed on 20 November with exit code 0, including all 45 design assertions, boundaries/hygiene, strict types, all 28 tests (7 chatbot / 15 admin / 6 developer), zero-warning lint and the optimized production build. Log: outputs/admin-header-verify.log. The isolated build's temporary preview type includes/imports were restored afterward; final formatting and type checks passed with exit code 0 (outputs/admin-header-final-checks.log).

Design Checker independently rechecked the live light Analytics view at 320px and marked the P2 resolved with no new findings. It confirmed the opaque header (bottom y=62), 96px document scroll padding, no page overflow and keyboard access to all five data disclosures. Last-summary focus was visible at y=475–519; reverse Tab focus was at y=406–450. Its independent screenshot is C:/Users/jerom/.codex/visualizations/2026/11/20/01a1e7c9-e34b-7a63-9beb-e82e9a11736e/admin-header-corrected-independent.jpg. Dark and populated booking checks relied on the owner-supplied screenshots and measurements above. It restored the normal light Booking view/viewport without saving data. The broader review limits remain unchanged.

## 20 November 2026 — Persistent admin header

User task: add a header to the admin panel. Admin panel developer owns this focused change; Design Checker confirmed no overlapping edits and remains read-only. No shared foundations or other panel surfaces changed.

Affected files: components/admin/AdminShell.tsx, components/admin/admin.module.css and docs/admin-panel.md. The existing semantic banner is now visually distinct: an opaque card surface and subtle approved divider separate it from the page canvas. Its current-page title remains visible with the sidebar expanded, collapsed or open as a mobile drawer. The title uses shared serif/type/weight tokens; existing page h1 headings remain unchanged. Notification/profile controls, their spacing and 44px targets, sidebar toggle behavior, approved palettes and 96px scroll clearance are preserved. No additional actions, recurring motion, business logic or authentication changes were introduced.

Browser checks: desktop and 320px light/dark views; persistent title across desktop collapse/expand and mobile drawer open/Escape; Dashboard, Services & Packages, Settings, System Logs and My Profile context; single page h1 in sampled screens; keyboard notification/profile open/Escape with focus return and visible outlines. Services & Packages truncates at 320px while retaining its full title and accessible text, with the full page heading below. All three account controls measured 44px square. At 320px the header ended at y=62 and page width remained 320px. The dark header stayed at top=0 after an 844px scroll, with an opaque rgb(48,38,34) card surface; the light header uses rgb(255,255,255). Existing notification loading and loaded/empty page states were observed. No new data-dependent header states were added.

Evidence: outputs/admin-new-header-desktop.jpg, admin-new-header-mobile.jpg, admin-new-header-dark-desktop.jpg and admin-new-header-dark-mobile.jpg use fictional disposable preview records. outputs/admin-new-header-live.jpg shows the real empty Booking page with the new header. Only the disposable database's appearance preference was saved for theme checks. The preview was stopped and viewport reset; the normal light Booking page remains open on port 3001. No live settings, venue records or authentication policies were changed. Stale preview cookies generated development JWT secret-mismatch diagnostics before test sign-in; these did not change the main localhost session.

Limits: actual 200% text scaling / 400% native browser zoom, live reduced-motion emulation, screen readers and real devices were not checked. Existing reduced-motion rules remain unchanged, and the header adds no motion. This is a focused header review, not a new evaluation of every workflow, error case or WCAG conformance.

Verification: npm run format and npm run verify completed with exit code 0 on 20 November, including formatting, 49 palette/semantic contrast checks, boundaries/hygiene, strict types, all 28 tests, zero-warning lint and the optimized production build. Log: outputs/admin-new-header-verify.log. Only the isolated build's temporary admin-preview type includes/imports were restored afterward. Final repository formatting and type checks passed with exit code 0 (outputs/admin-new-header-final-checks.log).

Design Checker completed its independent targeted read-only review with no actionable findings in the sampled scope. It checked live light Booking at 1280px with both sidebar states, Services & Packages at 320px (87px ellipsized title, full accessible text/main heading), header opacity/divider, one main h1, all three 44px account targets and no page overflow. Mobile drawer and notification/profile Enter/Tab/Escape operation retained visible focus and returned it to the relevant trigger. Scrolled header top=0 and 96px clearance confirmed the earlier P2 remains resolved. Its dark review used the supplied fixture evidence rather than new runtime checks. Independent evidence: C:/Users/jerom/.codex/visualizations/2026/11/20/01a1e7c9-e34b-7a63-9beb-e82e9a11736e/admin-persistent-header-desktop-independent.jpg and admin-persistent-header-mobile-independent.jpg. It restored the expanded light Booking view and normal viewport with menus closed, without saving data or settings. Broader review limits above remain unchanged.

## 20 November 2026 — Dashboard left gutter and logo visibility

User task: extend Dashboard width toward the left and slightly enlarge the Zion logo. Admin developer owns AdminShell.tsx/admin.module.css; Design Checker confirmed no overlap and stays read-only. No shared foundations, other panel surfaces, business logic, authentication or source assets changed.

Implementation: a Dashboard-only content class gives its desktop main/header the same fluid 16–24px left gutter. At 1280px this extends content 12px farther left (36px to 24px); at 1600px the main gutter falls from 52px to 24px. Other pages retain their existing gutters. The existing sidebar logo grows from 40px to 48px square using the shared spacing token; local insets/gap keep the full organization name clear of the toggle and center the mark in the collapsed rail. The mobile menu/header clearance and existing sidebar effects remain unchanged. docs/admin-panel.md describes these adjustments.

Browser checks: light live Dashboard at 1280px and disposable light/dark preview at desktop/320px. Main/header left padding matched at 24px at 1280/1600 and 20.48px at 1024; Booking retained 36px at 1280. At 320px, main padding remained 16px, header menu clearance 76px, header bottom 62px and page width 320px. The enlarged logo measured 48px square at x=16; expanded brand ended near x=217.5 before the 44px toggle at x=222. Collapsed logo bounds x=16–64 are centered in the 80px rail, aligned with the toggle center at x=40. Keyboard collapse/expand, focus reveal of the expand icon, navigation focus and mobile drawer Escape/focus return worked with visible outlines. The accessible dashboard home-link name remains unchanged. No new motion or data-dependent states were introduced.

Evidence: outputs/admin-dashboard-width-live.jpg is the real light empty-data Dashboard. Fictional preview screenshots: admin-dashboard-width-collapsed.jpg, admin-dashboard-logo-mobile.jpg, admin-dashboard-logo-dark-mobile.jpg (Settings drawer), admin-dashboard-width-dark.jpg and admin-dashboard-width-dark-mobile.jpg. Theme saves occurred only in disposable memory; no live preference or venue records changed. The preview was stopped, viewport override reset and the live light Dashboard remains open on port 3001.

Review limits: native 200% text scaling/400% zoom, live reduced-motion emulation, screen readers/real devices and all workflow states were not checked. Existing reduced-motion rules remain intact. A long fictional cash total still extends beyond its KPI card at 1280px; this existing large-value formatting concern was observed and handed off separately, without broadening the requested width/logo change. The zero-data live state and normal text/layout remain readable; no universal conformance claim is made.

Design Checker completed an independent read-only review on 20 November with no new actionable findings in the requested scope. Its live 1280px and 320px measurements confirmed the gutters, 48px logo, expanded toggle clearance, collapsed centering, keyboard navigation/focus and mobile Escape return above. It restored the expanded desktop view and viewport without saved data/preferences changes. Independent evidence: C:/Users/jerom/.codex/visualizations/2026/11/20/01a1e7c9-e34b-7a63-9beb-e82e9a11736e/admin-dashboard-width-independent.jpg and admin-dashboard-logo-mobile-independent.jpg. Dark runtime and 1600/1024px checks rely on owner evidence. The existing large-cash KPI overflow remains a separate open finding; broader review limits remain unchanged.

Verification: npm run format and npm run verify finished with exit code 0 on 20 November, including 49 palette/semantic contrast checks, boundaries/hygiene, strict TypeScript, all 28 tests (7 chatbot / 15 admin / 6 developer), zero-warning lint and the optimized production build. Evidence: outputs/admin-dashboard-width-verify.log. Only the isolated build's temporary admin-preview type includes/imports were restored afterward; final repository formatting and type checks also passed with exit code 0 (outputs/admin-dashboard-width-final-checks.log).

## 20 November 2026 — Header beneath sidebar and collapsed page labels

User correction: restore the page name only when the sidebar is collapsed, revert the Dashboard width change, and extend the admin header toward the left. The user clarified that the header must be beneath the sidebar. This supersedes the earlier persistent-title and Dashboard-gutter requests; the enlarged 48px logo is retained.

Scope/ownership: AdminShell.tsx, admin.module.css and docs/admin-panel.md. Admin developer notified Design Checker before edits and after the layering clarification; it confirmed read-only review without overlap. No shared foundation, other panel, asset, authentication, data or business workflow changes.

Implementation: the opaque sticky banner spans the root top row behind the full-height desktop sidebar. Foreground stacking is sidebar 47 above header 46, with the existing toggle above both at 48. The logo remains in the sidebar. Header controls reserve its current expanded/collapsed width plus the original content gutter; the offset follows the existing sidebar transition and reduced-motion rules. The banner is outside the content column, and content minimum height accounts for its height. Dashboard's special content class/gutter override is removed, restoring the original 36px desktop / 24px medium / 52px wide gutters. The !open condition restores collapsed-only page context, including a closed mobile drawer. Main page headings remain unchanged. A local AdminBrand component preserves the existing accessible home link and 48px image in one sidebar instance.

Browser checks: live light 1280px and disposable light/dark desktop/320px preview. Expanded desktop header starts at x=0 and ends at the document edge, at y=0–70; sidebar starts y=0. Hit testing over the logo resolves inside the foreground sidebar. Expanded page label is absent; collapsing to the 80px rail shows Dashboard/Services & Packages at x=116, and expanding hides it again. The 48px logo, hover/focus expand interaction, Enter/Tab/Shift+Tab navigation and visible outlines remain usable. Main starts at y=70 with restored 36px padding; 1600px main padding is 52px and 1024px is 24px. One main h1 remains in sampled screens.

Mobile: 320px page width, main padding 16px, header control clearance 76px and header/drawer boundary y=62. Opening the drawer hides the page label, keeps a single logo/home-link instance at x=16/y=69 (48px square), and makes account controls/main content inert. Escape restores the label and returns visible focus to Open sidebar. Closed-drawer notifications and profile menus still support keyboard Enter/Tab/Escape and focus return. Long Services & Packages context retains its full accessible text. The dark Settings header remained opaque rgb(48,38,34) at top=0 after scrolling, with 96px document scroll clearance; no new loading/error data states were added.

Evidence: outputs/admin-header-under-sidebar-live.jpg and admin-header-under-sidebar-collapsed.jpg show the real empty-data view. Fictional preview evidence: admin-header-under-sidebar-mobile.jpg, admin-header-under-sidebar-dark.jpg, admin-header-under-sidebar-dark-mobile.jpg (scrolled Settings), and admin-header-under-sidebar-dark-drawer.jpg. Theme changes occurred only in disposable memory. Preview stopped and viewport reset; the live expanded light Dashboard remains open on port 3001. No live preferences or venue records changed.

Limits: native 200% text scaling/400% zoom, live reduced-motion emulation, screen readers, real devices and broad workflow states were not checked. The existing reduced-motion rule covers the new header offset transition. The previously recorded long fictional cash-value KPI overflow remains a separate open finding. This is a focused layout review, not universal accessibility conformance.

Design Checker independently completed the targeted read-only review on 20 November with no new actionable findings in the corrected scope. Its live light 1280px measurements confirmed header x=0/width=1269.6 (document 1270), y=0–70 and z=46, sidebar top=0/z=47, toggle z=48, foreground logo hit testing, restored 36px main gutter and collapsed-only title at x=116. It confirmed one h1/brand link, mobile 320px geometry, inert background, keyboard drawer/account behavior, visible focus, opaque scrolled header and 96px clearance. Evidence: C:/Users/jerom/.codex/visualizations/2026/11/20/01a1e7c9-e34b-7a63-9beb-e82e9a11736e/admin-layered-header-desktop-independent.jpg and admin-layered-header-mobile-independent.jpg. Dark runtime and 1600/1024px checks rely on supplied owner evidence. It restored expanded light Dashboard/viewport with menus closed and no saved changes. The separate KPI finding and broader review limits remain unchanged.

Verification: npm run format and npm run verify completed with exit code 0 on 20 November, including 49 palette/semantic contrast checks, boundaries/hygiene, strict TypeScript, all 28 tests (7 chatbot / 15 admin / 6 developer), zero-warning lint and the optimized production build. Evidence: outputs/admin-header-under-sidebar-verify.log. Only the isolated build's temporary admin-preview type includes/imports were restored afterward. Final repository formatting and type checks also passed with exit code 0 (outputs/admin-header-under-sidebar-final-checks.log).

## 20 November 2026 — Header removal and standalone System Logs

User task: remove the admin header, move System Logs into the sidebar immediately above Settings, and remove it from inside Settings. This supersedes earlier header and Settings-tab requests. Admin developer notified Design Checker before edits; it confirmed source ownership and remains read-only. No shared foundation or other panel changes.

Affected source: components/admin/AdminShell.tsx, AdminNavIcon.tsx, AdminWorkspace.tsx, admin.module.css; app/admin/(panel)/[section]/page.tsx and settings/logs/page.tsx; one notification href in lib/admin/service.ts. The unused SettingsSections.tsx component and its CSS/import/rendering were removed. docs/admin-panel.md reflects the new layout and URLs.

Implementation: no header/banner element, header surface/divider, sticky band or current-page indicator remains. The retained bell/profile/Sign out controls are a small absolute group on the page canvas, not a full-width row; they scroll with the page. Main starts at y=0, with token-based top spacing (80px desktop, 72px mobile) to keep headings clear. Final focus clearance is 16px on desktop and mobile. The closed mobile menu trigger scrolls with the page; only the open drawer's Close control stays fixed. The mobile backdrop covers the full viewport above the inactive account group. Sidebar branding remains 48px; existing palettes/fonts, sidebar animation, 44px controls and role/workflow protections are preserved.

Navigation: System Logs is canonical at /admin/logs, with the existing activity/filter/pagination/outbox/workflow content. It appears directly above Settings at the sidebar bottom, with its own active shape/aria-current and the existing time-past icon previously used by the Logs tab. Settings has no section tabs or link to Logs inside its main content. /admin/settings/logs retains its existing authentication/password-change guards and redirects to /admin/logs. Dashboard queue and notification delivery-review hrefs now use the canonical path. No log records, API endpoints, database schema or processing behavior changed.

Initial browser/route checks: live light Dashboard/Settings/Logs and disposable light/dark desktop/320px views. Header count was 0 and a single main h1 remained in sampled pages. The account group measured 143×44px at desktop y=12, with no full-width background; it moved offscreen (top=-560 at scrollY=568) rather than sticking. Logs and Settings selected only their own sidebar link, and Settings had no Logs tab/link in main. The authenticated old bookmark landed at /admin/logs; unauthenticated HTTP checks of both paths returned 307 to /admin. The Dashboard queued-notices link opened /admin/logs. The notification delivery-review href was checked in source, not triggered with a failed-delivery fixture.

At 320×568, both bottom links stayed visible (Logs y=450–496, Settings y=502–548) while the main menu scrolled independently. Thirteen keyboard Tab steps cycled through the brand, all nine modules, Logs, Settings and back to Close sidebar; all focused destinations were visible. Escape returned visible focus to Open sidebar. Main/account controls were inert while the drawer was open. Mobile notifications/profile Enter/Tab/Escape preserved visible focus and returned to their triggers. The initial dark Logs pass retained 320px page width and 76px focus clearance; focusing Filter after scrolling placed it at y=355–405. The later mobile-toggle correction below removes that obsolete clearance. Expanded/collapsed log navigation and compact titles were checked.

Initial evidence: outputs/admin-no-header-live.jpg shows the live empty Dashboard. Fictional preview evidence: admin-no-header-settings-light.jpg, admin-no-header-logs-collapsed.jpg, admin-no-header-mobile-menu.jpg, admin-no-header-mobile-menu-dark.jpg, admin-no-header-logs-dark.jpg, admin-no-header-logs-dark-mobile.jpg and admin-no-header-signout-preview.jpg. The old scrolled dark-mobile image contains the subsequently corrected toggle overlap and is not final evidence for that state. The retained profile Sign out returned the disposable preview to its empty login form; its callback used the localhost hostname alias on the same preview port. The main localhost:3001 session was separately checked and remained authenticated. Only disposable appearance preferences/session state changed. No live settings or venue records were written.

Limits: native 200% text scaling/400% zoom, live reduced-motion emulation, screen readers/real devices, password-change-required UI and all financial/outbox/filter edge states were not manually checked. Existing reduced-motion rules remain in source. Log filtering/processing and financial workflows were preserved, not broadly re-evaluated. Prior large-value Dashboard KPI overflow remains separately open. No universal conformance claim is made.

Design Checker independently confirmed the requested layout, navigation, canonical/legacy routing, source guards, keyboard/account interactions, 320px geometry and separate Settings content, then reported one P3: the transparent fixed mobile toggle overlapped scrolled description text. It reproduced this at scrollY=85.6 in Settings, with the toggle at y=9–53. Its evidence is C:/Users/jerom/.codex/visualizations/2026/11/20/01a1e7c9-e34b-7a63-9beb-e82e9a11736e/admin-floating-toggle-text-overlap.jpg. Successful initial-layout evidence in that directory: admin-no-header-settings-independent.jpg, admin-no-header-mobile-menu-independent.jpg and admin-no-header-dashboard-independent.jpg. Dark runtime, anonymous HTTP and disposable Sign out checks used owner evidence. The first full npm run format/verify passed with exit code 0 (49 contrast checks, 28 tests, lint/build; outputs/admin-no-header-verify.log), but precedes this P3 correction.

P3 correction: the user had requested a plain toggle without a background, so the closed mobile trigger now uses the positioned root and scrolls with content. The drawer-open control remains fixed. Desktop rail behavior is unchanged. Mobile document clearance is reduced to 16px because no closed-state fixed control overlaps main content. In natural live light and disposable dark Settings at 320×568 and scrollY=85.6, the 44px trigger was at y=-76.6 to -32.6, and a hit test at (40,30) resolved to the paragraph rather than the button. Keyboard focus brought the trigger back to y=9/scrollY=0 with a visible outline. Enter opened the drawer with a fixed 44px Close control at y=9 and inert main/account content. Escape returned visible focus to the absolute trigger at y=9 in both themes. Header count remained 0. Final evidence: outputs/admin-no-header-toggle-light.jpg, admin-no-header-toggle-dark.jpg, admin-no-header-toggle-drawer-light.jpg and admin-no-header-toggle-drawer-dark.jpg. The light images are the live page; dark figures/preferences are disposable. Both previews were stopped, viewport overrides reset and the live expanded light Dashboard was restored at 1280px without preference changes.

Design Checker independently resolved the P3 on 20 November with no new findings in that correction. Its exact live light reproduction confirmed the offscreen closed trigger, paragraph hit test, 16px clearance, native keyboard return at y=9/scrollY=0, fixed 44px drawer Close, inert background and Escape return. Its settled drawer measured x=0/width=280px. Evidence: C:/Users/jerom/.codex/visualizations/2026/11/20/01a1e7c9-e34b-7a63-9beb-e82e9a11736e/admin-mobile-toggle-corrected-independent.jpg. Dark runtime remained owner evidence; drawer screenshots captured during motion do not establish settled geometry. Final-source npm run format/verify for this correction passed with exit code 0 (49 contrast checks, 28 tests, lint/build; outputs/admin-no-header-final-verify.log). The user then added the control/layering work below before final type-path cleanup. Earlier passed header-removal/Logs scope and review limits remain distinct from that added work.

## 20 November 2026 — Rounded controls and foreground page features

User task: increase button rounding and make controls, placeholders, boxes and page layouts more modern, presentable, responsive and functional, with features above the notification/profile area. The user explicitly answered the layering clarification: opened menus should remain on top so their options stay clickable. Header removal, standalone System Logs above Settings, the plain mobile trigger and the 48px logo remain in place.

Ownership/source: admin developer notified Design Checker of the new scope and its later confirmed menu preference. Design Checker stays read-only; earlier review does not certify these additions. Affected implementation: components/admin/admin.module.css, AnalyticsOverview.module.css and AdminWorkspace.tsx. Documentation: docs/admin-panel.md and this record. No shared foundation files, public/developer surfaces, auth guards, financial workflows, database schema or reporting definitions changed.

Implementation: the admin content context reuses the existing 16px card token for its control radius, giving main actions, form/search fields, relevant menu/catalog controls and feedback frames consistent rounded corners. Settings/status/preview/KPI boxes reuse the card radius; restrained role-based shadows clarify card/filter/report surfaces. Spacing, 44px targets and primary/secondary/destructive hierarchy remain; disabled and aria-disabled actions no longer get the main hover/press effects. Existing finite motion and reduced-motion overrides remain in use. Circular avatars/icons, sidebar curves and the background-free toggle keep their intended shapes. Login and other panels do not receive the content-scoped radius override.

Layering: the content creates a local stacking context. Actual feature children are at layer 2, with the closed account area at 1. An expanded account menu raises its group to 3, matching the user's confirmed choice. The main padding itself is not raised, so closed account triggers remain hit-testable. Native dialogs are excluded from the feature-positioning rule and retain their browser top layer. Root drawer/backdrop/sidebar layers continue above the content context.

Responsive cash fix: the earlier Dashboard large-value overflow is addressed in this new responsive scope. The existing compact formatter is used for totals of at least PHP 10,000; a visible 14px exact value appears directly below, with breaks at grouping commas and an exact accessible Payment-link name. Smaller totals are not duplicated. In the populated fixture, primary ₱20.7M and exact ₱20,722,000.00 both fit without overflow at desktop and 320px. Units and the all-time/excluding-voided scope remain explicit; no cash computation or report/export precision changed.

Browser checks: all twelve admin routes (Dashboard, Booking, Contract, Calendar, Inquiries, Payment, Services & Packages, Analytics, Team, System Logs, Settings, Profile) were visited in light/dark at 1280px and 320px: 48 DOM/layout checks, with one main h1, no app header, no unexpected page alerts, page width no greater than viewport, and sampled text/button/input radii of 16px. Evidence data: outputs/admin-controls-route-checks.json. Representative cards/forms, KPI text, menus and dialogs were visually inspected; this is not an exhaustive evaluation of every populated workflow or viewport.

Interaction checks: closed account layer 1 and feature layer 2 were measured; expanded layer 3 profile items were hit-testable and clicked successfully at desktop and mobile. Menu rows computed 16px rounding. Notification/profile Enter/Tab/Escape and click-away returned visible focus and restored the closed layer. A 288px native catalog dialog at 320px retained fixed positioning, modal/top-layer hit testing, 16px text fields (about 51px high), forward/reverse Tab containment, Escape/Cancel and opener focus return. Saving one hidden category in disposable memory succeeded and used the fallback opener; duplicate-slug failure retained both typed values and focused its visible persistent alert (top about 144px). A package editor opened with first-field focus and Cancel/Escape return. The settled dark drawer measured x=0/width=280px, kept background main/account controls inert and trapped a 13-step Tab cycle; hit testing outside it resolved to the backdrop rather than a page feature.

The real light Booking form was opened without submission: Client name received initial focus, sampled text fields were 16px rounded/about 51px high, and feature layers measured 2. Closing restored visible focus to New request. No real bookings, payments, catalogs or preferences were saved. Preview theme changes and the hidden category/error test were confined to disposable memory. The preview was stopped, viewport overrides reset, and the live light Booking register left open without a form or menu.

Evidence: outputs/admin-controls-live.jpg and admin-controls-live-form.jpg are the real empty-data view. Fictional preview images: admin-controls-dashboard-light.jpg, admin-controls-profile-menu-dark.jpg, admin-controls-menu-dark-mobile.jpg, admin-controls-dialog-dark-mobile.jpg, admin-controls-validation-dark-mobile.jpg and admin-controls-drawer-dark-mobile.jpg. Final populated mobile cash evidence is admin-controls-dashboard-mobile-light-settled.jpg and admin-controls-dashboard-mobile-dark-settled.jpg, captured at 320×844 from the visibly inspected screenshot bytes after the exact amount rendered. The older mobile-light file predates the final group-break polish, and the older mobile-dark file caught loading; neither is final KPI evidence. The populated cash values are test fixtures, not live venue income. The extra evidence preview was stopped and viewport overrides reset without source changes or live preferences being saved.

Limits: actual 200% text scaling/400% native zoom, live reduced-motion emulation, screen readers/real devices, every rendered contrast pair and all financial/contract/outbox/package-save/error scenarios were not checked. Earlier domain/API and route checks remain applicable; CSS/manual checks do not establish universal conformance. No new tests that merely mirror styling were added; the full existing gate remains required.

Verification: npm run format and npm run verify completed with exit code 0, including 49 palette/semantic contrast checks, boundaries/hygiene, strict TypeScript, all 28 tests (7 chatbot / 15 admin / 6 developer), zero-warning lint and the optimized production build. Log: outputs/admin-controls-verify.log. No source changes followed this run; only additional settled screenshots were captured. The temporary admin-preview type includes/imports were restored to the main dev paths. Final repository formatting and type checks passed with exit code 0 (outputs/admin-controls-final-checks.log).

Design Checker independently checked the live light rounded Booking controls, closed/expanded account layers, desktop/mobile menu hit testing and actual My Profile navigation, verified click-away outside the popup, native notification/profile Tab/Escape return, a fixed 288px modal with 16px/51px fields and Tab/Escape focus return, and the settled drawer/backdrop/inertness. It found no actionable control/layering issues in that scope and restored the clean expanded light Booking view/viewport without real data changes. Independent evidence: C:/Users/jerom/.codex/visualizations/2026/11/20/01a1e7c9-e34b-7a63-9beb-e82e9a11736e/admin-rounded-controls-independent.jpg and admin-rounded-dialog-independent.jpg. It inspected the 48-record layout file as owner automation evidence, not its own manual review of every state. Dark runtime, manual save/error states and populated cash remain owner evidence. Its completed review of both settled mobile images confirmed readable compact/exact values and scope, closing the previously observed cash overflow for the tested 20.7M case/layout. It reported no actionable findings in the sampled added scope; this does not establish every possible value, viewport, workflow or universal conformance. The stated review limits remain.

## 20 November 2026 — Fixed glass admin header and collapsed page indicator

User task: keep the notification bell, profile and profile menu in place as part of a header, soften page controls beneath it with blur, and restore the current page name only when the sidebar is collapsed. This supersedes the earlier no-header and foreground-page layering requests. The user's confirmed preference for opened menus to remain on top and clickable is preserved.

Ownership and scope: Design Checker was notified before edits and confirmed read-only review with no ownership overlap. Admin developer owns components/admin/AdminShell.tsx, components/admin/admin.module.css, docs/admin-panel.md and this entry. Shared tokens/primitives, other panels, navigation destinations, authentication, workflows and data definitions remain unchanged.

Implementation: a semantic fixed header spans the viewport beneath the existing sidebar. Its account controls retain their right alignment and spacing. The current route label appears only with a collapsed desktop rail or closed mobile drawer, including System Logs, Settings and My Profile. A 16px backdrop blur and 88% semantic canvas tint soften only content scrolling beneath the header; an opaque semantic surface is the fallback without filter support. A divider and restrained token-based shadow separate the layers. Header heights remain 70px desktop/62px mobile, with matching main-content top spacing and document scroll clearance. The plain mobile toggle is fixed above the clear header surface. Page features remain below the header and its open menus; the existing drawer/backdrop/sidebar and native modal top layer stay above. Popovers are bounded to the available viewport height and can scroll. Existing reduced-motion guards suppress the finite sidebar/header resize transition; no recurring effect was introduced.

Owner browser checks: the live light interface was checked at 1280px and 320×568, with expanded/collapsed rail, natural scrolling in Settings, closed/open notification and profile menus, and the mobile drawer. The desktop header stayed at y=0/70px and bell at y=12.6/44px while Settings scrolled; mobile header stayed y=0/62px and bell y=8.6/44px between scrollY=540 and 710.4. The Services & Packages indicator occupied two readable lines at 320px, with 320px document width. All twelve destinations were checked through collapsed desktop navigation: Dashboard, Booking, Contract, Calendar, Inquiries, Payment, Services & Packages, Analytics, Team, System Logs, Settings and My Profile. Each had one header and its matching label, without horizontal page overflow. Expanding the rail removed the indicator. Route evidence: outputs/admin-glass-route-checks.json.

Menu/overlay checks: profile My Profile links were hit-testable above features at desktop/mobile, with actual desktop navigation to Profile. Enter opened menus; Tab reached visibly outlined notification Close/profile identity actions; Escape returned outlined trigger focus. The 288px native category dialog remained fixed and modal above the header, focused Category name, and Escape returned to New event category without saving. Light and disposable dark drawers preserved sidebar/backdrop priority; main and header were inert. Settled dark drawer x=0/width=280px at 320×568, backdrop hit testing outside it returned Close navigation, and Escape restored outlined Open sidebar focus. System Logs/Settings remained visible at the drawer bottom. Header blur was visually inspected in live light and disposable dark scrolled Settings, including the mobile dark profile menu. Only the unsaved theme preview changed in the in-memory fixture; no real settings or business records were written. The preview was stopped, temporary viewport override reset, and the live expanded light Booking register restored with no open form/menu/dialog.

Evidence: outputs/admin-glass-desktop-light.jpg, admin-glass-scrolled-light-menu.jpg, admin-glass-mobile-light.jpg, admin-glass-mobile-light-menu.jpg, admin-glass-scrolled-dark.jpg, admin-glass-scrolled-mobile-dark.jpg, admin-glass-mobile-dark-menu.jpg, admin-glass-drawer-dark.jpg and admin-glass-live-final.jpg. The final image shows the collapsed Booking indicator; the user tab was subsequently expanded again. Dark screenshots show the fictional Preview Owner and no venue data. Screenshots caught during drawer motion were replaced with settled geometry evidence.

Full npm run format and npm run verify passed with exit code 0: 49 contrast foundation checks, architecture/client boundaries/hygiene, strict TypeScript, all 28 existing tests, zero-warning ESLint and the optimized production build. Log: outputs/admin-glass-verify.log. These checks do not validate every translucent rendered blend. After stopping the disposable preview, its generated type includes/imports were restored to the main dev paths; final repository format:check and typecheck both passed with exit code 0 (outputs/admin-glass-final-checks.log). No UI source changed after the full gate.

Design Checker completed an independent targeted read-only review on 20 November, with no actionable findings in the sampled scope. It confirmed live light desktop header/account stationarity after scrollY=720, softened scrolled content and distinct controls, collapsed Settings/My Profile indicators and expanded removal, menu hit testing and actual Profile navigation. At 320×568 it confirmed the long two-line indicator, 320px width, menu height bounds, notification/profile Enter/Tab/Escape focus, native fixed 288px modal above the header with opener return, and settled 280px drawer with inert header/main, backdrop hit testing and visible Escape return. Natural mobile Settings scrolling retained header y=0/account y=8.6; reverse Tab positioned a preceding form control at y=78, clear of the header ending at y=62. Independent evidence: C:/Users/jerom/.codex/visualizations/2026/11/20/01a1e7c9-e34b-7a63-9beb-e82e9a11736e/admin-glass-mobile-independent.jpg. It reviewed the supplied dark images and twelve-route JSON as owner evidence, not independent live dark/all-route human verification. A development issues badge was visible during its session; diagnostics were not assessed or attributed to this change, so no clean-console claim is made. It restored expanded light Booking at 1280px, menus/dialogs closed and viewport reset, without saving preferences or business records. The review retains the limits below.

Limits: native 200% text scaling/400% zoom, live reduced-motion emulation, screen readers and real devices/virtual keyboards remain unverified. The existing reduce-motion CSS guards were inspected. The opaque fallback was checked in source, not on a browser lacking backdrop-filter. Loading/empty data rendered during route checks; notification failure/password-change-required states and every operational workflow were not manually re-evaluated. No universal accessibility conformance claim is made.

## 21 November 2026 — Visual-first Dashboard and Analytics

User task: remove supporting text such as KPI comparison sentences, Comparison details, chart-data sections and overview explanations; make the current business status easier to scan visually. The user explicitly confirmed both Dashboard and Analytics. This supersedes the visible comparison/disclosure presentation approved on 20 November, not the underlying reporting definitions.

Ownership: admin developer notified Design Checker, which confirmed no overlapping edits and read-only final review. Scope: DashboardKpis.tsx/.module.css, DashboardCharts.tsx/.module.css, DashboardGreeting.tsx, Dashboard-only/Analytics heading markup in AdminWorkspace.tsx, AnalyticsOverview.tsx/.module.css, AnalyticsCharts.tsx, admin ChartPrimitives.tsx, and the admin/KPI/reporting/change-record docs. No shared foundation tokens, public/developer/receptionist surfaces, schema, services, financial definitions, data or workflows change.

Implementation: Dashboard keeps its compact neutral cards, short metric labels, totals and non-color arrow/percentage pills while removing comparison sentences and the visible Comparison details control. Greeting support prose/overline, chart explanations and chart-data controls are removed. Analytics removes explanatory report/chart/metric paragraphs and visible calculation/data disclosures, keeps concise business status and numerical change pills, and makes the existing all-time status/event-type breakdown proportional bars with labels/counts. Existing 3D SVG charts, period/date filters, CSV export, palette, fixed glass header/sidebar and reduced-motion guards remain. Short chart headings, legends, units, date scope and honest empty states remain visible; incomplete-history/attribution and operational error/loading warnings stay visible. Exact amounts, comparison scope and static data tables remain accessible offscreen. No interactive controls are placed in those hidden regions. No recurring motion or new dependencies introduced.

Owner browser checks: the real empty light Dashboard was inspected at 1280px before the local environment stopped responding. The initial format/preview attempts hit fatal out-of-memory/ArrayBuffer allocation errors. After resource contention subsided, a retry of npm run format and npm run verify passed all 49 design foundation checks, boundaries/hygiene, TypeScript, 28 tests, zero-warning lint and the production build. No checks or rules were weakened. Verification and preview were then run separately. Logs: outputs/admin-visual-format-memory-failure.log, admin-visual-format.log and admin-visual-verify.log.

A populated fictional in-memory fixture at 127.0.0.1:3014 was checked at 1280px desktop and 320×568 mobile in light/dark. Dashboard totals/arrow-percent badges, 3D charts and legends remained readable without the former comparison rows. The fictional annual sales total PHP9,665,500 displayed PHP9.7M, while the accessible card name retained the exact total, PHP1,698,000 change and 21.3% trajectory. The Dashboard selector switched to twelve month ticks. Native Tab reached sampled KPI links and the chart selector with solid visible focus. Analytics quarterly Apply, previous quarter and Current period controls worked, then Monthly was restored. CSV export succeeded for the displayed report, with its header/date read from outputs/admin-visual-analytics-fixture.csv; it contains fictional aggregate data only. Period controls retained persistent labels and visible focus in both themes, including mobile Previous/Next at y=360/286.4 below the 62px header. Both documents stayed 320px wide with no page overflow. The five Analytics tables retained captioned static accessible content, all visible details disclosures were absent, and both pages had zero interactive descendants in visually hidden regions.

Analytics income/collection charts and labelled proportional reservation/event-type bars were visually inspected. Header/sidebar remained above scrolling content. The only saved theme change was in the disposable fixture. Stopping that server and pressing Refresh produced a visible alert and retained the prior charts, with explicit last-successful-report feedback and an enabled retry. The temporary tab was closed and viewport reset. No real records or saved preferences were changed.

Design Checker source review found one P2: current pending balance and approved pipeline had lost their visible current-snapshot qualifier under historical reports. The labels were corrected to Current pending balance and Current approved pipeline, without restoring explanatory prose or changing aggregates. Design Checker independently verified and closed that source finding. The corrected labels are visible in the dark Analytics and light portfolio evidence. Source review also confirmed retained static exact data, no invisible focus controls, non-color indicators, quality/error notices, native filters/export and reduced-motion guards. Its review of all thirteen submitted screenshots found no further actionable issues in the shown frames, while distinguishing supplied owner evidence from independent live checks and noting partial lower-mobile-chart coverage.

Final npm run format and npm run verify after the correction passed with exit code 0, including all 49 design foundation checks, boundaries/hygiene, strict TypeScript, 28 tests, zero-warning lint and optimized build (outputs/admin-visual-final-verify.log). The disposable preview type includes were removed; final repository format:check/typecheck also passed with exit code 0 (outputs/admin-visual-final-checks.log). No app source changed after the full gate. The already-running port3001 server was preserved when a restart attempt returned EADDRINUSE. A fresh browser tab recovered the real authenticated light workspace; the earlier generated network-error tab could not be closed through the browser API. Real Dashboard sales-card Enter navigated to Analytics, where the current qualifier and zero data loaded without an alert. Dashboard was then left expanded at 1280px with no dialog/menu, and viewport override reset. Final real evidence: outputs/admin-visual-dashboard-live-final.jpg and admin-visual-analytics-live-final.jpg.

Design Checker completed independent sampled live review on 21 November with no further actionable design findings. It checked the real light Dashboard at 1280px and both pages at 320×568 with zero venue data, all four KPI links and period controls with visible keyboard focus, sales-card Enter navigation, twelve-month selection and its twelve exact accessible rows, full lower Dashboard activity/reservation/cash charts, and Analytics income/collection/event/conversion labels, units, axes, legends and honest empty states. Chart cards measured 288px wide with 286px client/scroll widths; documents stayed 320px wide. Quarter Apply/Previous/Current and Monthly restore worked through the keyboard. Current pending balance and Current approved pipeline stayed explicit under historical Q3 2026, including a readable mobile pipeline label. It confirmed zero visible details controls, zero controls inside srOnly regions and three/five captioned accessible tables. One return navigation immediately after viewport reset stalled; a direct page load recovered it, and settled desktop Dashboard → Analytics → Dashboard Enter navigation passed on retest. This was not reproduced or diagnosed as a source regression; no clean-console claim is made. It restored expanded light Dashboard, default 1280px viewport, scrollY=0, six-month default and no menus/page alerts, closed only its temporary tab, and left the owner's deliverable intact. No source, real settings/data, exports or runtime processes were changed by the reviewer.

Independent images: C:/Users/jerom/.codex/visualizations/2026/11/21/01a1e7c9-e34b-7a63-9beb-e82e9a11736e/dashboard-cleanup-desktop-independent.jpg, dashboard-cleanup-mobile-chart-independent.jpg, dashboard-cleanup-mobile-cash-independent.jpg, analytics-cleanup-mobile-collection-independent.jpg, analytics-cleanup-mobile-events-independent.jpg, analytics-cleanup-mobile-conversion-independent.jpg, analytics-cleanup-mobile-snapshot-independent.jpg and dashboard-cleanup-final-independent.jpg. Populated values, runtime dark theme, CSV and forced failure remain owner verification plus independent screenshot/source review, not independent live checks. The limitations below remain; this is a completed scoped review, not universal conformance or deployment approval.

Evidence under outputs/: admin-visual-dashboard-live.jpg (real empty data), admin-visual-dashboard-populated-light.jpg, admin-visual-dashboard-mobile-light.jpg, admin-visual-dashboard-dark.jpg, admin-visual-dashboard-mobile-dark.jpg, admin-visual-analytics-light.jpg, admin-visual-analytics-charts-light.jpg, admin-visual-analytics-mobile-light.jpg, admin-visual-analytics-mobile-charts-light.jpg, admin-visual-analytics-dark.jpg, admin-visual-analytics-mobile-dark.jpg, admin-visual-portfolio-light.jpg and admin-visual-refresh-error.jpg. Populated figures and Preview Owner are fictional. The light Analytics overview was captured before the compact Current-label correction; the later dark/portfolio images show those corrected labels.

Limits: native 200% text scaling/400% zoom, live reduced-motion emulation, assistive technologies/real devices, every rendered contrast blend and populated incomplete-history/new-baseline UI variants remain unverified. Existing aggregate tests cover history gaps and date/financial definitions; source guards were inspected. The earlier independent review of prior layouts is not a review of this new cleanup. No universal conformance claim is made.

## 21 November 2026 — Zeni chat redesign and final design review

User task: use the supplied Zeni receptionist image and professional, warm greetings,
then remove the Ask Zion wording and rebuild the widget as a clean, elegant chat
interface. The later layout request supersedes the icon-only presentation and its
source/screenshot review. The user subsequently instructed Design Checker to continue.

Client panel developer implemented the saved redesign and handed source ownership
to Design Checker after its turn stopped at a usage limit. The receptionist owner
confirmed no overlapping edits. Design Checker preserved that layout, completed
live review and corrected one local keyboard focus defect. No new feature work,
shared tokens/primitives, API, source-ranking, privacy or origin-guard changes.

Affected files: components/chatbot/Chatbot.tsx, Chatbot.module.css, ChatMessage.tsx,
config/chatbot-receptionist.ts, the greeting/thanks branch in lib/chatbot/retrieval.ts,
and public/images/chatbot/zeni-receptionist.webp. Documentation: docs/chatbot.md,
architecture.md and this entry. The client implementation uses the shared typography,
semantic colors, spacing, sizing, radii and motion tokens; no independent palette
or font stack was added.

The launcher reads Chat with Zeni, and the compact dialog identifies Zeni as Zion's
virtual receptionist. Incoming/outgoing bubbles use sender text and alignment as
well as color. The transcript scrolls above a stable composer, with compact quick
replies, linked exact source excerpts, additional-source disclosures and a staff
contact route. Enter sends, Shift+Enter creates a newline, and active composition
is preserved. Empty/pending send actions and pending quick replies are disabled.
The message label, count, privacy help and persistent errors remain visible. Start
a new chat clears the in-memory exchange history; no conversation is persisted.
The supplied 270-frame asset is represented by a transparent 192px, 9,276-byte
static WebP. Independent RIFF inspection found ALPH/VP8 content and no ANIM/ANMF
chunks. Finite hover transitions have a local reduced-motion guard.

Live checks used the existing localhost:3001 FAQ page and final widget at 1280x800,
320x568 and a short-height 320x256 viewport. The native dialog remained modal,
with readable welcome/header, 16px message input, visible keyboard focus and no
horizontal overflow within the dialog, transcript or a 600-character draft.
At 320x568 its dialog was x8/y8, about 298x552; client/scroll widths were 297/297
and transcript widths 291/291. The composer stayed below the scrolling transcript.
At 320x256 the whole dialog scrolled to keep the input reachable. This short-height
check is not a claim of actual 400% browser zoom or 200% text-scaling coverage.

Keyboard testing found initial Shift+Tab from the nonsequential heading could move
focus to the body. Chatbot.tsx now sends that case to the final enabled composer
control before using the existing shared focus helper for normal Tab boundaries.
Retests passed for initial reverse Tab with an empty message and with a draft,
forward/reverse wrapping, Start a new chat resetting to the heading, and Escape
returning focus to the launcher. The shared helper was not changed. One preliminary
DOM probe selected the separate navigation dialog; scoped Zeni-dialog measurements
confirmed focus stayed inside after the correction.

The first final gate passed formatting, design/boundary/hygiene checks, TypeScript
and all 28 tests, then caught a noninteractive tabindex on the role=log transcript.
The unnecessary Tab stop was removed without changing its log semantics or relaxing
the accessibility rule. Focusable transcript controls retain keyboard scrolling:
at 320px, PageUp moved scrollTop from 968 to about 706 and PageDown returned to about
966 while the input stayed at y445.6. Initial reverse Tab, Escape/focus return and
short-height access were rechecked; focused ESLint passed. The first failed gate is
retained as outputs/zeni-redesign-verify.log; final-source verification is separate.

Observed final states: empty welcome, pending reply, successful Good day exchange,
location/source reply, keyboard-expanded additional source, live-booking staff
handoff, new-chat reset and empty-send disablement. Shift+Enter added a newline
without submitting; Enter sent the trimmed question. Contact navigation closed the
modal and opened /contact. The existing 127.0.0.1:3001 origin rejection was reproduced
at desktop: the question was retained, remained editable, had aria-invalid and an
associated persistent alert. The guard remains unchanged. No venue records,
preferences, external messages or real inquiry submissions were created. The
viewport override was reset and only the review's two temporary tabs were closed.

Final evidence under
C:/Users/jerom/.codex/visualizations/2026/11/21/01a1e7c9-e34b-7a63-9beb-e82e9a11736e/:
zeni-redesign-desktop-light.jpg, zeni-redesign-mobile-light.jpg,
zeni-redesign-launcher-light.jpg, zeni-redesign-mobile-sources.jpg,
zeni-redesign-short-height.jpg and zeni-redesign-error-light.jpg (desktop error).
The error frame predates only the nonvisual transcript Tab-stop removal; the other
frames were recaptured afterward.
The earlier client zeni-welcome-*.jpg and outputs/client-zeni-verify.log describe the
superseded intermediate presentation, not final redesign acceptance.

Final-source npm run format and the unchanged npm run verify passed (exit 0):
formatting, 49 palette/semantic contrast checks, 741-file client boundary,
architecture/filesystem hygiene, strict TypeScript, all 28 tests (7 chatbot,
15 admin, 6 developer), zero-warning ESLint and the optimized production build.
Logs: outputs/zeni-redesign-final-format.log and zeni-redesign-final-verify.log.
The gate used isolated chatbot output, a 768 MB Node heap and one-core affinity on
its parent only to manage existing memory pressure; the parent's original affinity
was restored afterward. No unrelated runtime was stopped and no checks, rules or
assertions were weakened. The temporary chatbot-preview type metadata was cleaned
up while preserving unrelated configuration. App source was not changed after the
successful full gate. Final cleanup checks and owner handoff are recorded below.

Post-cleanup global npm run format:check and npm run typecheck passed (exit 0;
outputs/zeni-redesign-final-checks.log). tsconfig.json and next-env.d.ts match their
pre-build snapshots. The verified scope, corrections, actual results, screenshots
and remaining limits were sent to the existing Client panel developer and
receptionist chatbot chats. Code ownership was returned; no additional feature
implementation or duplicate gate was requested. This coordination does not convert
the unverified runtime items into reviewed passes.

Limits: runtime dark theme, actual 200% text scaling/400% zoom, live reduced-motion
switching, assistive technologies, real devices/virtual keyboards, all public routes,
every rendered contrast blend and forced timeout/network failure remain unverified.
The available browser controls exposed viewport/visibility without theme or motion
emulation. No universal accessibility conformance or independent peer review of the
final focus correction is claimed.

## 21 November 2026 — Character-only Zeni launcher and greeting bubble

User task: remove the launcher's background and visible Chat with Zeni / How may
I help you labels, retain the supplied receptionist character with its motion,
and show short greetings above her head. This supersedes only the launcher
presentation in the preceding entry; the verified chat-panel layout is retained.

The receptionist owner and Design Checker confirmed source ownership before
implementation and the later public-footer correction. Both remain free of
overlapping edits. Scope: components/chatbot/ChatLauncher.tsx and its CSS Module,
launcher extraction in Chatbot.tsx and Chatbot.module.css,
config/chatbot-receptionist.ts,
public/images/chatbot/zeni-receptionist-animated.webp,
components/layout/Footer.tsx, docs/chatbot.md and this record. No shared tokens,
staff surfaces, saved preferences, API, retrieval, privacy or origin-guard changes.

The floating button now has a transparent background, no visible text or border,
an accessible chat-opening name and visible keyboard focus. The original
receptionist animation retains transparency, all 270 frames, its 8,999ms duration
and looping behavior in a 160px WebP of 1,378,908 bytes, down from the supplied
11,721,474-byte 768px file. The existing 192px, 9,276-byte static image remains the
fallback and dialog avatar. Display sizes use existing spacing tokens: 80px on
desktop and 64px on narrow screens. No extra floating decoration was added.

A token-styled speech bubble cycles Hello!, Welcome to Zion Events Place. and
How may I help you? at six-second intervals. Text uses the body scale and semantic
surface/text/border colors. Each text change has a finite 180ms entry effect;
reduced motion disables it and displays one stable greeting and a static image.
Hover or keyboard focus independently pauses rotation and the character; leaving
one condition cannot override the other. Dismiss greeting and stop animation
removes the bubble and leaves a static, working chat launcher for the page visit.
Opening the dialog, a hidden document or a visible footer suspends animation
without clearing explicit dismissal. The visible footer also hides the optional
bubble. If that removes the focused dismiss button, focus returns to the launcher;
unrelated footer/dialog focus is preserved. An image-load failure uses the static
fallback. The existing native dialog and initial reverse-Tab correction remain.

Live checks used localhost:3001/faq in light styling at desktop 1280x720/800,
320x568 and short-height 320x256. The button had no visible text, a transparent
computed background and zero border; the final animated source loaded at natural
width 160. All three greetings were observed. Hover kept the same greeting and
static source for over 23 seconds; leaving resumed the animated source. Keyboard
focus paused the character with the pointer outside, and the dismiss control had
a visible 2.4px focus outline. Enter opened the dialog at its heading; Escape
restored launcher focus. Keyboard dismissal stopped the greeting/animation across
footer entry/exit and chat reopen. The reduced-motion/hidden-document guards were
inspected in source; those runtime conditions were not reproduced by this browser.

The initial desktop launcher partly obscured Event Policies at the page bottom.
The public footer now reserves two existing space-12 units plus safe-area inset
at every breakpoint. At 1280x800, the final policy link ended at y704.30 and the
launcher button started at y708; the complete link and focus outline were visibly
clear, and sampled points across the link resolved to that link. At 320x568,
the wrapped policy link ended at y471.73 and the launcher began at y492.
Settled footer entry hid the bubble and selected the static character; exit
resumed both only when not manually dismissed. Focus on Terms / Event Policies
was preserved. Entry while the dismiss button owned focus restored the launcher.
The observer does not remove the character or chat-opening action.

The 320px document retained 320px scroll width. The longest greeting fit in a
272px bubble at approximately x18.4/y99.2 in the 320x256 viewport, above the
64px launcher at y180. Both controls stayed reachable. This short-height check
does not substitute for actual text scaling or browser zoom. The viewport override
was reset and only this task's temporary tabs were closed. No real records,
preferences or inquiry submissions were created.

Final-source screenshots under
C:/Users/jerom/.codex/visualizations/2026/11/21/01a1e86c-a06e-7563-ba02-c4eef00d1662/:
zeni-mascot-launcher-desktop.jpg, zeni-mascot-launcher-detail.jpg,
zeni-mascot-launcher-mobile.jpg, zeni-mascot-short-height.jpg,
zeni-mascot-footer-desktop.jpg and zeni-mascot-footer-mobile.jpg.
Still frames show the visual placement; animated/static source selection and
frame metadata were checked separately. Earlier launcher evidence is superseded.

Design Checker's source/screenshot review raised a possible mobile collision.
The owner reproduced it: at 320x568 the long greeting occupied x18.4..290.4,
y411.2..488, covering the slide controls at y452..496; their centers hit the
greeting. The baseline launcher also overlapped the final slide target by 4px.
This was an actionable P2, not a failure of the unrelated hero implementation.
The first unchanged full gate passed exit 0 (outputs/zeni-mascot-verify.log), but
it describes that intermediate source and does not accept the final correction.

The launcher now measures a stable, unmoved dock against visible main-content
controls, with existing space-2 clearance. It first uses the existing 44px target
in crowded space and only lifts it if necessary and space permits. The candidate
also avoids the carousel heading/subtitle. It suppresses the optional greeting
and animation where controls would be obstructed. The unmoved empty dock passes
pointer events through; only its character and visible greeting intercept them.
This prevents the old 64px layout box from blocking a control after compaction.
Hidden greetings retain their
measurable geometry, avoiding show/hide oscillation. Scroll, resize, focus and
greeting ResizeObserver events refresh the check; an obscured focused dismiss
control returns focus only to the launcher. This does not reset explicit stop.
The hero, shared foundations and chat-panel source were preserved.

Corrected initial mobile slide targets all resolved to their own buttons; the
44px launcher occupied y512..556, leaving 16px after the y452..496 control row.
Center and four cardinal interior points on all five visible controls resolved
to their own buttons. Bounding-box corner samples fall outside rounded controls
and were not used as evidence of covered targets. Keyboard
focus revealed the existing Play slides control, expanded that row and retained
full visible focus and usable controls; returning to scrollY=0 kept the launcher
clear. The compact launcher's complete 2.4px keyboard focus outline remained visible.
At 320x540 the 44px candidate moved to y176.4..220.4, above the hero heading
starting at y228.4 and the subtitle at y334.8..411.6; the initial 64px lifted
candidate that touched the subtitle was superseded. The final slide button
activated through Enter. Scrolling to approximately
y142.4 restored the greeting/animation in clear space; Welcome changed to Hello
while the bubble stayed clear. Resize between desktop, 320x568 and 320x256
refreshed placement and preserved the 320px document width. Entry into a collision
while the dismiss control owned focus returned focus to the launcher. Keyboard
dismissal survived collision/clear-space transitions, footer entry/exit and chat
reopen; Enter still opened at the dialog heading and Escape restored the launcher.
After reload at the footer, automatic greeting suspension and static source were
rechecked separately from manual stop. Policies focus remained untouched. Leaving
the footer restored the enabled greeting; reentering while dismiss held focus
returned only that focus to the launcher. Viewport overrides were reset and the
additional temporary review tab was closed.

The original six screenshots were recaptured after the correction. Additional
evidence in the same directory: zeni-mascot-hero-overlap-before.jpg (finding only),
zeni-mascot-hero-pause-focus.jpg, zeni-mascot-hero-controls-mobile.jpg and
zeni-mascot-greeting-mobile-clear.jpg, zeni-mascot-compact-focus.jpg and
zeni-mascot-crowded-height.jpg. The initial mobile launcher frame now shows the
static compact character and suppressed greeting by design. The former lifted
64px frames were replaced; they do not establish acceptance of the final source.

A second source-driven review question exposed a stale candidate during autoplay.
The owner reproduced it at 320x540: after measuring the shorter Prepare slide,
the naturally advancing Answers heading began at y206.8 while the old candidate
still ended at y220.4. The prior compact-source gate passed exit 0 and is retained
as outputs/zeni-mascot-compact-verify.log; it is intermediate evidence only.
zeni-mascot-autoplay-before.jpg records this second finding, not acceptance.

The same scheduled ResizeObserver now also observes the main region, existing
main controls and carousel heading/subtitle. Their changing dimensions refresh
clearance without changing the hero. Cleanup still cancels the frame, disconnects
the observer and removes the scroll/resize/focus listeners. A complete unpaused
cycle at 320x540, with scrollY=0 and no hero hover, observed Understand, Prepare,
Know What Happens Next and Answers with no character/text/control intersections.
The shorter titles used y176.4..220.4 above a heading start of y228.4; the taller
Answers title moved the candidate to y154.8..198.8 above a heading start of y206.8.
Both maintain the existing 8px clearance before the heading. At 320x568 and
scrollY=0, focused Play (95.70px wide) changed to Pause (108.47px) and back; the
44px candidate stayed at y512..556. All five visible controls remained clear at
their center and four cardinal interior points. The observer update did not
reset explicit stop or redirect unrelated focus.

Final observer-source retests passed for dialog heading focus and Escape return,
keyboard dismissal across collision/clear-space/footer/chat changes, footer
disappearance restoring focus only from dismiss, preserved Policies focus and
320px document width. The six base screenshots were recaptured after this final
source correction. Additional final evidence: zeni-mascot-autoplay-answers-final.jpg,
zeni-mascot-autoplay-cycle-final.jpg and zeni-mascot-playback-resize-final.jpg.
The preceding compact-focus/control frames retain the same stable presentation
but predate only the observer extension; they do not establish autoplay behavior.
Two automation locator attempts timed out around reload/focus. Native keyboard
controls and direct read-only DOM measurements recovered the review; the complete
cycle and final state results above were observed afterward. Viewport overrides
were reset and the additional temporary tab was closed.

Design Checker completed read-only source/artifact re-review and closed both
reported mobile clearance findings within the inspected scope. It reviewed the
final observer source, the Answers/cycle screenshots and Pause-width frame, and
found no further actionable source/screenshot issue. Its review confirmed stable
baseline, compact-first placement, empty-dock hit transparency, measurable hidden
greeting/static blocked state, observer cleanup and retained stop/focus/footer
contracts. The complete live cycle and hit probes remain owner-verified evidence,
not its independent replay. Earlier before/prototype frames remain findings only.
No reviewer files, duplicate browser session or verification gate were created.
The requested above/below wording correction was already made before the final
gate. This scoped closure does not accept the unverified runtime items below.

Final app-source npm run format and unchanged npm run verify passed exit 0:
49 design-foundation checks, 753-file client boundary, architecture/hygiene,
strict TypeScript, all 28 tests (7 chatbot, 15 admin, 6 developer), zero-warning
lint and the optimized production build. Logs: outputs/zeni-mascot-final-format.log
and zeni-mascot-final-verify.log. The earlier zeni-mascot-verify.log and
zeni-mascot-compact-verify.log are intermediate-source results, not final acceptance.
The final gate used isolated chatbot output, a 768MB Node heap, one-core affinity
on its own parent and runtime CIRCLE_NODE_TOTAL=2, which the installed Next defaults
resolve to one build worker. All checks/assertions remained unchanged. The parent
affinity was restored; no shared configuration or unrelated runtime was changed.

Generated preview type metadata was validated as the only metadata change and
restored. tsconfig.json and next-env.d.ts match the task's pre-build snapshots.
All seven recorded app/asset hashes are unchanged from before the successful
final gate. Post-cleanup global npm run format:check and npm run typecheck passed
exit 0 (outputs/zeni-mascot-final-checks.log). The final verified scope, screenshots,
closed findings, actual gate/cleanup results and remaining runtime limits were
sent to the existing Design Checker and receptionist chatbot chats. This records
delivery of the handoff, not a further independent live review or deployment
approval. Source ownership is released; no additional feature work was requested.

Design Checker subsequently checked the final gate/cleanup receipts and
independently matched all seven recorded app/asset hashes to current files. It
confirmed the reported check totals and kept both clearance findings closed
within the corrected source/artifact scope. This adds independent receipt/hash
verification, not a live replay of the owner's browser checks. No further findings,
implementation requests or deployment approval were issued; the limits below remain.

Limits: actual 200% text scaling/400% zoom, runtime dark theme and reduced-motion
switching, screen readers, real devices/virtual keyboards and nonzero safe-area
insets remain unverified. The IAB background-tab attempt kept document.hidden
false, so hidden-tab suspension is source-reviewed only. Unsupported
observer behavior, every public route/contrast blend, image/network
failure and all chat reply states were not replayed for this launcher-only
change. The chat panel's prior state checks remain historical evidence; the new
opening/closing/focus checks above apply to this final launcher. No universal
accessibility conformance or deployment approval is claimed.

## 22 November 2026 — Zeni conversation layout and smaller window

The user asked for a cleaner conversation layout, fewer visible notes, profile
avatars on both sides, a reply bubble, and dismissal by clicking the page outside
the window. The user then requested a slightly narrower and shorter window.
Client panel developer coordinated the presentation handoff with the receptionist
owner, who retained the server workflow and arranged one integrated gate.

Chatbot.tsx and Chatbot.module.css now give the native modal an inline identity
header, a scrolling transcript and a fixed composer at standard viewport heights.
ChatAvatar.tsx and ChatMessage.tsx use the existing Zeni portrait and a generic
visitor silhouette beside labeled, aligned reply bubbles. A three-dot bubble
appears during real requests and presents a spoken status. Its finite animation
uses the shared timing tokens and is disabled by reduced motion. Sources share
one expandable list with their original excerpts and links. ConversationDetails.tsx
places general information behind About this chat and keeps saved request details
available when relevant. It labels stale results, preserves the qualification that
saved results are not a new availability check, and shows a returned reference
when present. Recovery, consent and persistent errors remain visible as needed.
The header refresh button was removed. The contextual Forget saved details action
still clears saved conversation details and explains its scope.

A backdrop click closes the modal when both the press and click are outside its
bounds. It restores launcher focus and keeps the current draft and conversation.
The open/restore/send/clear function syntax trees match the workflow baseline
after normalizing formatting. Launcher, footer, receptionist configuration and
both supplied asset hashes matched their pre-redesign snapshots.

The desktop cap decreased from 480 × 672 to 448 × 624 CSS pixels at default text
size. Narrow screens gain a small edge inset. At 320 × 568 the measured panel
was 290.4 × 536 and the document remained 320 pixels wide. With a 600-character
draft and a 96-pixel composer, panel client/scroll widths were 289/289 and
transcript widths were 283/283. At 320 × 256 the panel measured 290.4 × 224 and
keyboard focus scrolled to the composer. Short-height testing is distinct from
actual 400% browser zoom.

Client preview checks at 1280 and 320 pixels covered opening, reply pending and
success, expandable sources, readable avatars and sender labels, long drafts,
Shift+Enter newline, Enter send, empty/busy send disablement, initial reverse
Tab, focus wrap, Escape, inside/backdrop clicks and draft restoration on reopen.
About this chat, Contact and Forget were keyboard reachable. An isolated origin
rejection produced an associated persistent alert and retained the editable
draft. Preview tests used a disposable fixture. The focused UI lint, formatting
and strict type checks passed before the size adjustment, and the final CSS
format check passed. The integrated verification receipt is recorded separately
from these focused checks.

Evidence under
C:/Users/jerom/.codex/visualizations/2026/11/22/01a1e86c-a06e-7563-ba02-c4eef00d1662/chat-window-redesign/:
desktop-compact.jpg, desktop-compact-conversation.jpg, mobile-compact.jpg,
mobile-compact-draft.jpg and short-compact.jpg show the resized panel. The reply
and error frames from earlier in the redesign predate the final size adjustment.
Viewport override was reset and the client test tabs were closed. Design Checker
reviewed the compact source and screenshots and identified an incomplete primary
visiting-hours reply. The receptionist owner restored Sunday hours and the
appointment condition in the main reply and added a regression assertion.

The receptionist owner's first stable 32-pixel root-font emulation at 320 pixels
wide exposed vertical clipping of the enlarged header, transcript and composer.
Chatbot.module.css now retains a usable transcript row and allows outer scrolling
when needed. Narrow header spacing adapts to the viewport and retains a minimum
44-pixel close target. The corrected panel retained a 227-pixel transcript, and
the owner used pointer scrolling to reach the header from the composer. The
320 × 200 short-height composer, light and dark styling, static reduced-motion
typing dots, and full primary visiting-hours reply also passed. See
outputs/receptionist-layout-checks.json and receptionist-layout-browser.log.
The scaled whole document still reaches 640 pixels wide due to the shared minimum
width, recorded separately above. Actual browser zoom, assistive technology and
real mobile devices remain outside the sampled preview checks.

The receptionist owner's integrated formatter and `npm run verify` completed
with exit 0 on the final compact source. The gate covered 49 design checks, the
798-file public boundary check, architecture and hygiene, strict TypeScript, all
75 tests, lint and the production build. See
`outputs/receptionist-workflow-final-format.log` and
`outputs/receptionist-workflow-final-verify.log`. The client owner observed the
gate's process exit, restored the build-generated TypeScript metadata to the
original snapshots, and matched all five tested UI file hashes. Design Checker
received the final layout evidence. It subsequently completed a read-only
source/artifact review and closed the enlarged-text panel clipping and incomplete
visiting-hours findings for the corrected source and supplied final evidence.
It checked the frozen CSS hash, the 227-pixel transcript, 502/1095-pixel outer
scroll, 270/270-pixel horizontal bounds, and the non-textarea wheel receipt that
moved outer scroll from 467 to 0. Final desktop/mobile frames show Tuesday–Saturday,
Sunday and the appointment condition in the primary reply. The reviewer also
checked the gate receipt and independently matched all 41 recorded final source
hashes. The live browser interactions remain owner-executed evidence, not an
independent replay. The shared 20rem root-minimum full-page reflow finding above
remains open. Native text scaling/zoom, screen readers, physical devices and the
other recorded runtime limits are not established by this scoped review.

## 22 November 2026 — Book Now in client navigation

The user requested moving Book Now out of the FAQ help card and into the bottom
of the client sidebar. The attached reference then clarified that it should be a
separate outlined action anchored at the very bottom, with a right arrow.
components/layout/Navbar.tsx now keeps the page links in the scrollable region and
places the existing /booking destination in a fixed bottom action region. The
matching link was removed from app/faq/_components/FAQClient.tsx. Existing menu
typography, colors, focus treatment and closing behavior are reused. The booking
destination currently shows its existing Coming Soon page.

Live checks on the existing local development server at 1280x800 and 320x568
confirmed the removal and final bottom placement. At 320px, the menu measured
276/276px client/scroll width and the document remained 320px wide. The final
action measured 244.4 × 49.9px and ended 24px above the viewport bottom. The page
link region scrolled independently; at its bottom, FAQ remained fully visible with
a 44px target above the action. Book Now had a visible 2.4px focus outline. Tab
from FAQ reached Book Now and the following Tab wrapped to Close. Enter reached
/booking, closed the menu, and the reopened link reported aria-current=page.
Escape restored focus to the menu toggle. Screenshots:
outputs/book-now-nav/mobile.jpg and bottom-mobile.jpg. The temporary viewport was
reset and test tab closed. Native zoom/text scaling, runtime dark theme,
reduced-motion switching, screen readers and physical devices were not retested
for this link relocation. The menu retains its existing fixed light palette and
motion behavior.

The user explicitly suspended cross-chat coordination for this update to conserve
tokens, so no other chats were contacted and no independent review is claimed.
The final `npm run format` and unchanged `npm run verify` passed with exit 0. This
includes 49 foundation checks, the 814-file public boundary, architecture and
hygiene checks, strict types, all 75 tests, zero-warning lint and the production
build. Receipts are in outputs/book-now-nav/final-format.log and final-verify.log.
The isolated build's generated TypeScript metadata changes were
checked and restored to the pre-task snapshots. No application source changed
after the successful final gate.

## 23 November 2026 — Stable receptionist launcher and tighter client footer

The user reported that the receptionist greeting disappeared while scrolling
the client panel and asked that the launcher keep the same position, size and
orientation throughout page scrolling. They also asked to reduce the excessive
empty footer space shown in the supplied image and video. The disappearing
greeting was caused by a footer `IntersectionObserver` in
components/chatbot/ChatLauncher.tsx that deliberately removed the bubble when
the footer entered the viewport. That scroll-dependent visibility and geometry
logic was removed. The fixed launcher now stays 80 × 80 pixels at the desktop
bottom-right position and 44 × 44 pixels at the narrow-screen upper-right
position. Its greeting remains present during scrolling, while the existing
manual stop control, static fallback, hidden-document suspension, open-dialog
suspension, hover/focus pause and reduced-motion behavior remain available.
Rotating greetings stay outside live announcements. The 44 × 44 dismiss control
returns focus to the named launcher, and the launcher continues to open the
existing chat dialog.

components/chatbot/ChatLauncher.module.css uses the existing semantic chat
colors, typography, spacing, focus treatment and motion tokens. The greeting is
compact, readable and does not intercept page pointer input outside its dismiss
control. components/layout/Footer.tsx reduces bottom padding from the previous
96-pixel launcher reservation to 8 pixels plus the safe-area inset. The legal
bar reserves horizontal room for the fixed desktop launcher instead of adding a
large empty strip, preserving the existing Terms and Event Policies links.

Live checks on the existing FAQ development page covered 1280 × 800,
320 × 568 and 320 × 256. At desktop, the launcher remained at
x 1178.4/y 708 with an 80 × 80 box and the greeting remained at
x 1150.375/y 654.4 with a 100.025 × 45.6 box at both scrollY 0 and the
scrollY 1309.6 footer position. At 320 pixels, the launcher remained at
x 254.4/y 152 with a 44 × 44 box and the greeting remained at
x 198.375/y 98.4 with a 100.025 × 45.6 box at both scrollY 0 and the
scrollY 2955.2 footer position. The short-height viewport retained the same
geometry. Desktop document overflow measured zero; the narrow page retained its
existing 320-pixel minimum against a 314-pixel scrollbar-reduced client width.
The follow-up refinements restored the legal links to their reference alignment,
kept 48 pixels of horizontal clearance from the launcher and reduced the desktop
footer from 275.6 to 251.6 pixels high. The 320-pixel footer decreased from
799.3 to 775.3 pixels high. The launcher was raised 8 pixels while preserving its
fixed geometry: desktop x 1178.4/y 700 at 80 × 80 and mobile x 254.4/y 144 at
44 × 44. Its legal links remained fully readable and ended before the launcher.
Evidence is saved as outputs/footer-chatbot-stability/desktop-footer-refined.png
and mobile-footer-refined.png. Keyboard checks covered the
dismiss action and focus return, dialog opening, Escape closing and launcher
focus restoration. The attached MP4 could not be decoded by the locally
available media tooling or opened through the browser file policy, but the
reported behavior and its exact source condition were reproduced on the live
page.

The user reiterated that no further chats should be contacted for this client
update, so no additional cross-chat messages or independent final review were
requested after that instruction. Native 200% text scaling/400% zoom, runtime
theme switching, screen readers, physical devices and nonzero safe-area hardware
remain unverified. The existing shared 20rem root-minimum reflow finding remains
open and is not changed by this launcher/footer correction.
