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
   for the rest; red outline for destructive actions.
6. **Sentence case.** Navigation, buttons, labels, table headers, badges and stored values
   ("PENDING_REVIEW" shows as "Pending review", via `enumLabel` in `components/admin/AdminBadge.tsx`).
   No uppercase transforms or letter-spacing in admin styles.

## Foundations (`styles/tokens.css`, admin block)

| Role                        | Light                                                                  | Dark (ZENTRA night)         | Use                                  |
| --------------------------- | ---------------------------------------------------------------------- | --------------------------- | ------------------------------------ |
| `--admin-surface-page`      | mist `#F5F8F6`                                                         | night `#07140F`             | Page background                      |
| `--admin-surface-card`      | white                                                                  | night card `#0D1D17`        | Cards, header, sidebar               |
| `--admin-surface-subtle`    | mist                                                                   | night raised `#163026`      | Hover, table header row, count pills |
| `--admin-surface-highlight` | green soft `#E7F1EC`                                                   | night raised                | Current page, KPI icon tiles         |
| `--admin-ink` / `-heading`  | ink `#121A17`                                                          | pearl `#EEF4F1`             | Text and headings                    |
| `--admin-muted`             | `#4D5A54`                                                              | sage `#A9C4B8`              | Secondary text, labels               |
| `--admin-action`            | ZENTRA green `#03422E`                                                 | glow `#8FD3B0`              | Primary buttons                      |
| `--admin-accent-ink`        | ZENTRA green                                                           | glow                        | Current page text, links, icons      |
| `--admin-divider`           | soft line `#E3E8E5`                                                    | `#2A4A3E`                   | Card borders, dividers               |
| `--admin-control-line`      | `#D9D9D9`                                                              | `#3D5F52`                   | Secondary buttons and toggles        |
| `--admin-border`            | `#7A8A83` (≥3:1 on white)                                              | `#7A8A83`                   | Inputs, hover borders                |
| `--admin-status-*`          | Request, pending, confirmed, cancelled hues with soft and ink variants | Night soft and ink variants | Chips, dots, the Bookings banner     |

- **Type:** page titles `--type-panel-title` (22–28px, semibold); card titles 16–18px semibold;
  body 16px; tables and secondary text 14px; captions 12px (never smaller).
- **Shape:** controls 6px radius, cards 8px; card shadow `0 1px 2px` at 6% of `--admin-shadow`.
- **Targets:** 44px controls (the project default), including sidebar rows, legend toggles and
  segmented switches. Buttons in a row share one height, so fields, buttons and toggles line up.
- **Spacing:** page gutters 24px (16px on phones), 16px between cards, card padding 16–24px
  (`--layout-card-padding`, redefined for the admin scope).

The design check (`scripts/check-design-system.mjs`) verifies the role contrasts in both themes.
To use Metis' blue instead of ZENTRA green, change the action, accent-ink, focus and highlight roles
in the admin block of `styles/tokens.css`; no component needs editing.

## Layout and components

- **Header:** wordmark left; theme, notifications, messages and the account menu right.
- **Sidebar** (`components/admin/navigation.ts`, `AdminShell.tsx`): Dashboard, then groups with a
  short muted label: **Events** (Bookings, Front desk, Calendar, Contracts, Payments), **Clients**
  (Inquiries, Live chat, Zeni), **Business** (Packages, Reports, Team); Automation, Activity log and
  Settings stay pinned at the bottom on desktop. The current page is a soft green row with green
  text and `aria-current`. The collapsed rail replaces group labels with thin rules; on phones the
  drawer scrolls as one column.
- **Page header:** the visible `h1` equals the sidebar label (the dashboard shows a greeting and
  today's date, with the `h1` visually hidden), then page actions on the right.
- **KPI cards** (`DashboardKpis`): white, icon tile, label, value, period, change pill, trend line.
- **Status summary** (`DashboardStatusCards`): one card, "Bookings this month" with the month once,
  four cells (dot, label, count) that open Bookings filtered by status.
- **Tables:** quiet header row, 14px cells, row hover. Rows that open a record use the stretched
  pattern: the record name is the only button, and its `::after` covers the row
  (`.clickableRow` / `.rowLink` in `admin.module.css`), so the whole row is clickable while the
  keyboard meets one named control. Focus draws around the whole row.
- **Booking cards:** status chip (and flags), client name (the card's one button, stretched over
  the card), event and package, then date and reference. No repeated field labels.
- **Attention banner** (`AttentionCallout` in `BookingRegister.tsx`): request-yellow soft fill, the
  count of requests needing a decision, other waiting work in one line, and a button that toggles
  between "Review requests" and "Show all bookings" without moving keyboard focus.
- **Notices:** soft fill in their hue (error, success, info, warning), no side stripe.
- **Status chips and badges:** pill, soft fill, ink text, sentence case; status chips add a dot.
- **Search:** one slim toolbar row (`.toolbar`, `.searchBox`): a search field about 26rem wide
  with an icon, a Search button that names it (WCAG technique G167) and a Filter button whose fields
  open in a panel below. No card or label above the field. Phones give the field the full row.
- **Loading:** skeleton bars in the shape of what is loading (`LoadingSkeleton.tsx`), announced once
  through `role="status"`.

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
- **Layout (dashboard):** Cash collected (the main chart) beside "For the past 30 days", then
  Bookings trend, Booking activity and Reservation mix in one row (two, then one, on narrower
  screens).
- **Access:** every canvas has `role="img"` and a summary name, and every chart keeps an exact-value
  table for screen readers (`ChartDataTable`). Legends and totals carry the values in text.

## Motion

Smooth but quiet; every effect below is off under `prefers-reduced-motion` (the reduced-motion rule
at the end of `admin.module.css`, `prefersReducedMotion()` for Chart.js and `useReducedMotion()` for
the counting figures).

- Page content rises in (fade and 8px rise, about 320ms, children 40ms apart). Backwards fill only,
  so no transform stays behind to affect fixed or sticky elements.
- Booking cards and table rows arrive one after another (index in `--i`, capped).
- KPI and month figures count up to their value (`CountUp.tsx`, framer-motion); the cards' accessible
  names carry the exact values.
- Charts draw in, sparklines reveal left to right, the donut centre fades between values.
- Buttons press down 1px; the primary button gains a soft green glow on hover; the filter panel
  slides open; skeleton bars shimmer while loading.

## Checks for admin changes

Follow the checklist in [the design standard](design-standard.md): desktop and 320px layouts,
keyboard and visible focus, light and dark themes, reduced motion, 200% text, and the loading,
empty, error and success states. Record material changes in the
[design change log](design-change-log.md).
