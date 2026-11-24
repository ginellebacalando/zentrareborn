# Analytics report contract

Implemented 19 November 2026. The user requested income, pending
balances, business trajectory, inquiry conversion, and booking/event reports for
weeks, months, quarters, and years, with animated 3D-style charts. They explicitly
selected cash income and confirmed bookings versus the previous equivalent period
as the trajectory basis. Costs are not currently recorded, so this is an income
and activity report, not a profit/loss calculation.

## Dates and comparisons

- Calendar periods use Asia/Manila. Weeks start Monday; quarters are Jan–Mar,
  Apr–Jun, Jul–Sep, and Oct–Dec. The default is the current calendar month.
- Current periods run through the response time. Future dates/receipts do not
  become income or completed activity. Historical periods use their full bounds.
- A current period compares with the same elapsed portion of the previous period,
  capped at that previous period's end. Completed historical periods compare with
  the whole previous calendar period. Display both date ranges explicitly.
- Trend buckets are daily for weeks, seven-day groups for months, and calendar
  months for quarters/years. Only elapsed buckets are plotted; future empty
  buckets must not create a false downward trend.
- Bind UTC-offset ISO strings in raw SQL and treat Prisma timestamps as UTC;
  adapter date parameters can lose their offset before a timestamptz cast.

## Money and activity

- Cash income: actually recorded receipts by received date, excluding voided and
  future-dated receipts. Overall cash collected is all-time through response time.
- Pending balance: current unpaid amount on secured (CONFIRMED/COMPLETED)
  bookings, clamped at zero per booking after non-voided receipts. Label it as a
  current, all-booking snapshot; do not imply a historical balance reconstruction.
- Approved REQUESTED bookings are prospective pipeline, reported separately from
  secured balances/value. Cancelled/rejected requests do not become receivables.
- Newly secured bookings: current CONFIRMED/COMPLETED records whose first
  RESERVATION_CONFIRMED outbox event falls in the report interval. Deduplicate
  repeated notices. Explain that cancellations are excluded from secured counts.
- Secured event dates and completed events use startsAt within the report period;
  only COMPLETED records are labelled completed events. Upcoming confirmed dates
  in the selected calendar period are shown separately from elapsed activity.
- Missing dated confirmation history is disclosed, not fabricated from updatedAt.
- Reject unsafe cash integer totals rather than silently round or overflow.

## Inquiry conversion and attribution

- For inquiries received in the selected period, count distinct inquiry IDs with
  linked booking requests, then distinct inquiry IDs currently having a solid
  booking. A single inquiry with multiple requests counts once at each stage.
- Conversion rate is secured inquiries / received inquiries; no inquiries means
  an unavailable rate, not a business failure. Newer inquiries may still be under
  review; this is their current status as of the response time.
- The prefill route now includes inquiry id. The create-booking payload carries
  that verified id; the booking transaction checks that it exists and is not
  future-dated. Older editable notes remain untrusted for attribution.
- Persist bookingId and sourceInquiryId (null for known direct requests) in the
  existing immutable CREATE audit metadata. Use those structured links, never
  email/name matching or parsing editable notes. No schema change is needed.
- Distinguish known direct requests from historical records without structured
  attribution. Disclose the historical tracking gap; do not invent conversions.
- If untracked booking origins could belong to the selected inquiry cohort,
  present the overall conversion rate as unavailable. Still show verified counts
  and identify them as tracked results. Known direct requests do not reduce
  attribution completeness. Do not treat incomplete tracking as zero conversion.

## Trajectory and reports

- Compare cash income and newly secured bookings: both non-decreasing with at
  least one increase = Improving; both non-increasing with at least one decrease
  = Needs attention; opposite directions = Mixed signals; equal = Steady.
- All-zero periods = No activity to assess. A zero prior baseline with new
  activity = New activity; avoid infinite percentages or a false zero percent.
- Keep pending/aged balances and data-quality notices visible alongside that
  indicator. The indicator is based on these two measures, not an overall audit.
- Undated confirmations that could overlap the comparison window make the
  combined trajectory unavailable; keep the independent cash comparison visible
  and explain the history gap rather than declaring the business healthy/poor.
- Provide aggregate report tables and a local CSV export. Use explicit monetary
  units/date bases, protect spreadsheet text cells, and export no private contacts.
  As requested on 21 November, tables and calculation explanations are visually
  hidden static accessible content. The visible page uses short titles, numerical
  totals, arrow/percentage indicators, charts and labelled proportional bars;
  data-table and calculation disclosures are removed. Period controls, selected
  dates, essential quality/error/loading feedback and CSV export remain available.
- Reuse the admin chart language and palette. Animate brief entrances/period
  changes and restrained hover depth; reduced motion displays static charts with
  all essential labels/values immediately available. No recurring movement.

## Verification and coordination

Add isolated tests for date boundaries, comparisons, voided/future receipts,
outstanding balances, conversion deduplication/tracking gaps, CSV values, and
trajectory states. Validate desktop/320px, keyboard/focus, both themes, empty,
loading, error, and populated fixtures; record unverified accessibility work.
Run the repository's full verification and send Design Checker the completed
scope, evidence, results, and limitations. Preserve existing confirmation/payment
safeguards and keep all test figures out of the live venue database.
