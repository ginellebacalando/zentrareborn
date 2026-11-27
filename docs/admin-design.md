# Admin design system

How the ZENTRA admin panel (`/admin`) looks and why. It applies to every admin page and to future
admin work, together with [the design and engineering standard](design-standard.md).

**Source:** the redesign of 26 November 2026. The user asked (in a recorded video brief) for the
"vibe" of the Metis admin template (preview.colorlib.com/theme/metis) in the colours of the whole
ZENTRA system, aligned with the main website, and set these rules:

- Apply design principles and one design system; keep it simple, modern and minimal, not bland.
- Group the crowded sidebar by theme.
- No coloured stripes or outlines on cards.
- No redundant subtitles that restate what the page is (for example "Track revenue, bookings,
  upcoming events, and pending inquiries in one place").
- On Bookings, show what needs a decision first, highlighted; cards must not repeat the same labels;
  table rows open on click, with a hover highlight, instead of a column of "Open" buttons.
- The staff are not technical, so pages must not overwhelm.

## Principles

1. **Calm by default.** A mist page, white cards with a soft hairline and a faint shadow, ink text.
   Deep green is reserved for the wordmark, the main action, the current page and focus.
2. **Say it once.** A page shows its title and, only when it adds a fact staff need, one short
   line (Calendar: "All times are Manila time."). The dashboard names the month once. Cards show
   values without repeating field labels.
3. **Priority first.** The thing that needs a decision comes before everything else on its page,
   highlighted, with one action (Bookings: "3 requests need your decision" → Review requests).
4. **Colour never works alone.** Status appears as a labelled chip or a dot beside its label. Cards,
   panels and notices never carry coloured side stripes, top bars or outlines.
5. **One primary button per area.** Green filled for the main action; white with a neutral border
   for the rest; red outline for destructive actions (the shared Button, below).
6. **Sentence case.** Navigation, buttons, labels, table headers, badges and stored values
   ("PENDING_REVIEW" shows as "Pending review", via `enumLabel` in `components/admin/AdminBadge.tsx`).
   No uppercase transforms or letter-spacing in admin styles.
7. **Every element earns its place (26 November 2026, night).** No decorative gradients or glows,
   no icons in coloured tiles or circles for decoration, no filler stats, no heavy shadows, and the
   page name is not repeated in a card title, tab or table header.

## Foundations (`styles/tokens.css`, admin block)

| Role                       | Light                                                                  | Dark (charcoal)             | Use                                  |
| -------------------------- | ---------------------------------------------------------------------- | --------------------------- | ------------------------------------ |
| `--admin-surface-page`     | mist `#F5F8F6`                                                         | charcoal `#121417`          | Page background                      |
| `--admin-surface-card`     | white                                                                  | card `#1A1D21`              | Cards, header, sidebar               |
| `--admin-surface-subtle`   | mist                                                                   | raised `#24282D`            | Hover, table header row, count pills |
| `--admin-surface-selected` | green soft `#E7F1EC`                                                   | `#1C2A25`                   | Current page, chosen segment         |
| `--admin-ink` / `-heading` | ink `#121A17`                                                          | off-white `#E6E9E7`         | Text and headings                    |
| `--admin-muted`            | `#4D5A54`                                                              | cool grey `#A5ABB2`         | Secondary text, labels               |
| `--admin-action`           | ZENTRA green `#03422E`                                                 | mint `#8FD3B0`              | Primary buttons                      |
| `--admin-accent-ink`       | ZENTRA green                                                           | mint                        | Current page text, links, icons      |
| `--admin-divider`          | soft line `#E3E8E5`                                                    | `#2D3237`                   | Card borders, dividers               |
| `--admin-control-line`     | `#D9D9D9`                                                              | `#4A5058`                   | Secondary buttons and toggles        |
| `--admin-border`           | `#7A8A83` (≥3:1 on white)                                              | `#7C838B`                   | Inputs, hover borders                |
| `--admin-status-*`         | Request, pending, confirmed, cancelled hues with soft and ink variants | Night soft and ink variants | Chips, dots, the Bookings banner     |

- **Type (medium density, 27 November 2026):** page titles 20–24px (`--type-admin-title`,
  semibold); card titles 14–16px semibold; body, tables and secondary text 14px; labels and
  captions 12px (never smaller). Fields stay 16px on touch screens, so phones do not zoom in.
- **Dates:** friendly, in the admin's chosen format ("Tue, Dec 8, 2026 · 5:00 PM"; Settings →
  Localization), with no time-zone name on each time; a page that shows times says once which zone
  applies ("Times are Manila time.").
- **Shape:** controls 8px radius, cards 12px; card shadow `0 1px 2px` at 6% of `--admin-shadow`.
- **Targets:** buttons, fields, filters and segmented switches share `--control-height`: 40px on
  desktop and the 44px touch target on phones and touch screens, so a row of them lines up. Sidebar
  rows and header icons stay 44px.
- **Spacing (medium density, 27 November 2026):** every page uses the full width beside the
  sidebar with 24px padding (16px on phones); 16px between cards and sections; 16px card padding
  (`--layout-card-padding`); table rows about 54px for two lines, so about ten bookings fit on a
  1920 × 1080 screen. Gaps, padding and margins come from the 4px scale (`--space-*`). Labels sit
  beside their values on one line where the width allows.
- **Buttons:** the shared component (`components/shared/Button.tsx`, also used by the website):
  `Button`, `IconButton`, `ButtonLink` and `ButtonAnchor` with variants primary, secondary, ghost and
  destructive, and sizes sm 32px (tables, toolbars), md 40px (default) and lg 48px (rare). 8px
  corners, 14px text in medium weight in the admin (`--button-weight`; semibold on the website),
  16px icons with an 8px gap; hover, a 1px press, the shared focus ring, and `loading`, which shows
  a spinner over the label so the button keeps its width. Disabled buttons have a neutral surface
  and muted text. A button that cannot be used yet takes `disabledReason` ("Choose a date first",
  "This is the latest period"): it stays focusable but inactive, the reason is its tooltip and is
  read as its description; plain `disabled` is only for brief states such as saving. An action
  that never applies to the record is hidden instead. One primary button per area; rarely used and
  destructive actions go in the "More" (⋯) menu (`MoreMenu.tsx`), and destructive ones ask for
  confirmation. Buttons never wrap, and a row of actions fits one line on desktop: the two or three
  main ones stay and the rest go in More (a Front desk visit keeps Mark completed, No-show and Start
  booking; Reschedule, Staff notes and Cancel visit are in More). A row has icons on all its
  buttons or on none; Refresh is always an icon button with its tooltip. Pagination appears only
  when there is more than one page. No admin stylesheet defines its own buttons.
- **Page header** (`AdminPageHeader.tsx`, every page): the title, at most one short status line
  (Team: "3 accounts · 1 invitation waiting"; Settings: "Last saved …"; Automation: email and last
  run), and the page's actions on the right with at most one primary. Filters or a toolbar follow,
  then the content. On phones the actions move under the title, except a lone icon action such as
  Refresh, which stays beside it.
- **Icons:** Lucide only (the Flaticon and Material Symbols fonts were removed), 16px beside text
  and 20px on their own, one stroke weight (1.75) set in `admin.module.css`.

The design check (`scripts/check-design-system.mjs`) verifies the role contrasts in both themes.
To use Metis' blue instead of ZENTRA green, change the action, accent-ink, focus and highlight roles
in the admin block of `styles/tokens.css`; no component needs editing.

## Layout and components

- **Header:** wordmark left; theme, notifications, messages and the account menu right. The three
  tools are 44px round buttons with 20px icons in the muted ink, darker on hover; the theme button
  shows its state by its icon, not a fill. Notifications and Messages (new inquiries) share one red
  count badge, centered on the icon's top-right corner ("99+" past 99). A thin divider separates
  the account: a 44px pill (32px avatar, role, chevron) with the same hover fill. Everything shares
  one centre line. Phones show the avatar alone and no divider; Messages hides at 400px and below.
- **Sidebar** (`components/admin/navigation.ts`, `AdminShell.tsx`): Dashboard, then groups with a
  short muted label: **Events** (Bookings, Front desk, Calendar, Contracts, Payments), **Clients**
  (Inquiries, Live chat, Zeni), **Business** (Packages, Reports, Team); Automation, Activity log and
  Settings stay pinned at the bottom on desktop. The current page is a soft green row with green
  text and `aria-current`. The collapsed rail replaces group labels with thin rules; on phones the
  drawer scrolls as one column.
- **Page header:** the visible `h1` equals the sidebar label (the dashboard shows a greeting and
  today's date, with the `h1` visually hidden), then page actions on the right.
- **KPI cards** (`DashboardKpis`): white, label, value, period, change pill, trend line.
- **Status summary** (`DashboardStatusCards`): one card, "Bookings this month" with the month once,
  four cells (dot, label, count) that open Bookings filtered by status.
- **Tables:** quiet header row, 14px cells, row hover. Rows that open a record use the stretched
  pattern: the record name is the only button, and its `::after` covers the row
  (`.clickableRow` / `.rowLink` in `admin.module.css`), so the whole row is clickable while the
  keyboard meets one named control. Focus draws around the whole row.
- **Booking cards:** status chip (and flags), client name (the card's one button, stretched over
  the card), event and package, then date and reference. No repeated field labels.
- **Attention banner** (`AttentionCallout` in `BookingRegister.tsx`): one slim line on the card
  surface with a small amber icon: the count of requests needing a decision, other waiting work,
  and a secondary button that toggles between "Review requests" and "Show all bookings" without
  moving keyboard focus.
- **Notices:** soft fill in their hue (error, success, info, warning), no side stripe.
- **Status chips and badges:** pill, soft fill, ink text, sentence case; status chips add a dot.
- **Search:** one slim toolbar row (`.toolbar`, `.searchBox`): a search field about 26rem wide
  with an icon that filters as you type after a short pause (Enter applies it at once), and a
  Filter button whose fields open in a panel below; "Clear filters" appears only while filters are
  on. The search and filters stay in the address, so returning from a booking keeps them. No card
  or label above the field. Phones give the field the full row.
- **Tooltips:** every icon-only control carries `data-tip` (`IconButton` adds it; header icons, the
  menu toggle, collapsed sidebar links, calendar and report arrows, dialog close buttons): a dark
  label on hover after a short pause, at once on keyboard focus, hidden while the control's menu is
  open. The accessible name stays the aria-label. The website's icon buttons get the same tooltip.
- **Dialogs:** native modal dialogs, centered on every screen over a dimmed page; Escape closes them
  and focus returns to the control that opened them. Tailwind's base reset (`app/globals.css`)
  removes the browser's centering margin, so every dialog class sets `margin: auto` again with
  `position: fixed` and `inset: 0` (`Overlays.module.css`, `.catalogDialog`, the Calendar preview).
- **Team** (`TeamPanel.tsx`): a table on wide screens; on phones each person is a block with
  labelled lines (Role, Status, Last sign-in).
- **Rows and sections:** every table row highlights under the pointer; dashboard "Coming up" rows open
  their booking (`/admin/bookings?booking=<id>`); expandable sections (details) open and close
  smoothly where the browser supports it.
- **Loading:** skeleton bars in the shape of what is loading (`LoadingSkeleton.tsx`), announced once
  through `role="status"`.
- **Back links:** a page reached from another (a booking, the walk-in booking) starts with a small
  "← Bookings" or "← Front desk" link above its title, at least 24px tall.
- **Skip link:** the admin shell's own "Skip to content"; the site-wide skip link is hidden inside
  the admin panel (`styles/primitives.css`), so keyboard users meet one.
- **Packages:** search filters as you type. A package without a reservation fee carries a warning
  beside its status ("No reservation fee set: bookings for it wait for staff review").

## Booking page

Each booking opens on its own page, `/admin/bookings/[reference]` (`BookingPage.tsx`,
`BookingDetail.tsx`); "← Bookings" returns to the list with its filters and scroll position.

- **Header** (sticky): client name, reference with a copy button, one status chip, the main action
  for that status and the "More" menu. One summary line: event · date · time · venue · guests ·
  package. One "next step" line with a help (?) tooltip for the longer explanation.
- **Actions by status:** Under review → Approve (main) and Decline; Waiting for payment → Record or
  Verify payment (main, opens the Payments tab) and Extend deadline; Confirmed → Record payment
  while a balance remains, then Complete event once the event has ended. Edit details, View
  packages, the flag and Cancel booking are in "More". Every decision asks for its note in a small
  centered dialog (`ActionDialog.tsx`; 5 to 2,000 characters, as the server requires).
- **Overview:** two columns on desktop: event, client (contact verification as a badge beside the
  phone, with "Mark as verified") and staff notes on the left; the payment summary (paid, total,
  balance, due date, progress) and any screenshot waiting to verify on the right. Guests read "312
  guests (package includes 100, 212 extra)". A package without a reservation fee shows one warning
  with a link to Packages.
- **Tabs:** Overview · Payments (screenshots, payments received, Record cash) · Agreements ·
  Activity (super administrators, from the Activity log). Empty sections are one short line.
- **Phones:** one column, and the main action in a bar fixed to the bottom of the screen. On short
  screens (under 32rem tall: a phone on its side, 400% zoom) the action stays in the header and the
  header scrolls away, so no bar covers the control that has keyboard focus; elsewhere the page's
  scroll padding keeps focus clear of the sticky header and of the bar.
- **Headings:** the client's name is the `h1`; every tab's sections are `h2`, as on Overview.
- At 1366 × 768 the header, key details, payment summary and main action fit without scrolling.

The bookings table shows one Status column and the Payment column; the table is the default
layout. "Waiting for payment" is blue (`--admin-booking-pending*`), clearly apart from the yellow
"Under review"; the orange pending roles remain the admin's warning colour.

## Calendar

`BookingCalendar.tsx`: one toolbar row (previous, Today, next and the month; search as you type and
a Month · List switch), then the legend as status chips that also show or hide each status
(cancelled hidden by default: "Show cancelled"), with "Clear filters" only while filters are on.
Each day shows its events as chips with the time and who it is for ("10 AM · Santos Family"; the
chip's name adds what it is and its status), coloured by status (appointments outlined), as many
as fit, then "+N more"; the month takes the height the screen leaves, so
it fits without scrolling at 1366 × 768 and 1920 × 1080. Today has a soft tint and past days are
lighter. Choosing a day shows its schedule in the side panel, which otherwise shows today and what
is coming up; an event chip opens a preview with "Open booking", centered like every dialog, and
an appointment opens with the Front desk's card to check in, reschedule, add notes or cancel.
**Schedule** in the toolbar, and **Schedule on this day** for a chosen day from today on, open the
appointment form in a dialog (docs/visits.md, "Appointments"). On
phones the month is compact: each day shows its number and up to three dots in its events' status
colours (visits outlined, "+" for more), choosing a day lists its events below the month, and the
status chips scroll sideways in one row; the List view is one tap away.
The header says once that all times are Manila time. Today is unavailable, with its reason, while
the current month shows. A venue filter appears beside the search once the bookings use more than
one venue; every booking is at Zion Events Place today, so it stays hidden.

## Charts

The dashboard and Reports charts follow the Metis template's interactive charts and use the same
library, Chart.js (`chart-engine.ts`, `useChartJs.ts`, `ChartPrimitives.tsx`).

- **Colours** come from the `--admin-*` tokens of the chart's own subtree, read at runtime, so the
  dark theme applies and a theme switch redraws the chart in place. No colour is written in code.
- **Marks:** smooth monotone lines (they never dip below zero) over soft gradient fills; rounded
  bars that rise one after another; a donut with its total in the centre; dashed grid lines and
  muted 12px axis labels.
- **Tooltip:** an HTML card (`.tooltip`) that appears at the hovered month and glides along as the
  pointer moves, with a dashed guide line on line charts. Escape hides it (WCAG 1.4.13).
- **Interaction:** legends are toggle buttons (`aria-pressed`) that show or hide a series, keeping
  one visible; hovering a bar group or donut slice dims the rest; pointing at a donut slice or its
  legend row lifts the slice and shows its share in the centre. The dashboard's period is a
  segmented switch (6 or 12 months); the charts animate to the new range.
- **Layout (dashboard, 26 November 2026, night):** the KPI cards and "Bookings this month", then
  Trends and all the graphs directly below. Website activity and "Coming up at Zion" are compact
  widgets (the newest five with "View all", the next five with "View calendar") with the testimonies
  hold, in a side column on wide screens (1536px and up) and below the graphs otherwise. The
  reservation split lives on Reports and new inquiries on Inquiries, so the dashboard does not
  repeat them.
- **Access:** every canvas has `role="img"` and a summary name, and every chart keeps an exact-value
  table for screen readers (`ChartDataTable`). Legends and totals carry the values in text.

## Motion

Smooth but quiet; every effect below is off under `prefers-reduced-motion` (the reduced-motion rule
at the end of `admin.module.css`, `prefersReducedMotion()` for Chart.js and `useReducedMotion()` for
the counting figures).

- Page content rises in (fade and 8px rise, about 320ms, children 40ms apart). Backwards fill only,
  so no transform stays behind to affect fixed or sticky elements.
- Cards further down fade and rise 12px as they scroll into view, once, including cards whose data
  arrives later (`ScrollReveal` with `watch`, mounted in `AdminShell.tsx`). Scrolling stays the
  browser's own.
- The theme switch (`lib/theme-switch.ts`): colour transitions pause so the whole page changes
  together, and the new theme sweeps in from the top with a soft edge in about half a second (View
  Transitions API); without it, or under reduced motion, the switch is instant. The choice is a
  cookie the panel layout reads, so a reload never flashes the other theme.
- Booking cards and table rows arrive one after another (index in `--i`, capped).
- KPI and month figures count up to their value (`CountUp.tsx`, framer-motion); the cards' accessible
  names carry the exact values. The Cash collected total counts up the same way, with the exact
  amount beside it for screen readers.
- Charts draw in, sparklines reveal left to right, the donut centre fades between values. Line and
  area charts (Cash collected, Bookings trend) draw themselves in from left to right the first time
  they appear, on the sparklines' 1.1 s and `--motion-ease` curve, so the dashboard's lines move
  together (`lineReveal` in `chart-engine.ts`). The line is uncovered at its final shape with the
  area behind it; the axes are there from the start. A period switch or legend toggle glides the
  line in place instead of replaying the reveal.
- Buttons press down 1px; the filter panel slides open; skeleton bars shimmer while loading.

## Checks for admin changes

Follow the checklist in [the design standard](design-standard.md): desktop and 320px layouts,
keyboard and visible focus, light and dark themes, reduced motion, 200% text, and the loading,
empty, error and success states. Record material changes in the
[design change log](design-change-log.md).
