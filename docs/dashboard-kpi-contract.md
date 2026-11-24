# Dashboard KPI contract

Implemented 20 November 2026 for `/admin/dashboard`. The user selected secured
contract value for sales, then clarified annual accumulated sales and pending
inquiries that are not yet secured or settled. Amounts are PHP integer cents.
The Dashboard uses these definitions; the separate Analytics cash-income report
retains its existing receipt-based definition.

| Card              | Main value                                                                                                                            | Trajectory                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Total Revenue     | Current calendar year-to-date agreed value of currently confirmed/completed bookings, attributed to their first recorded confirmation | Same elapsed duration of the preceding calendar year; absolute PHP change and percentage                                                                   |
| Total Bookings    | All currently confirmed/completed bookings created through response time                                                              | Newly secured current YTD versus preceding YTD; absolute count and percentage                                                                              |
| Upcoming Events   | Currently confirmed bookings whose start is at or after the response time                                                             | Scheduled starts in the next 30 days versus secured starts in the preceding 30 days, including currently completed bookings; absolute count and percentage |
| Pending Inquiries | Currently open inquiries without a verified linked confirmed/completed booking; closed/spam excluded                                  | Currently unresolved inquiries received in current YTD versus preceding YTD; absolute count and percentage                                                 |

All annual boundaries use Asia/Manila, starting 1 January. Reuse the existing
equal-elapsed-period helper, including leap-year duration handling. All query
intervals are half-open. Visually hidden static content provides comparison dates,
scope and definitions. The upcoming main value includes dates beyond its 30-day trend.

These are current records grouped by activity date, not reconstructed historical
snapshots. Contract amendments affect the current agreed value; cancellations are
excluded. Pending comparisons use current outcomes of inquiry intake cohorts,
not a historical backlog count. An increase in unresolved inquiries describes
workload, not proof of business growth. Up/down activity is descriptive, not a
profit/loss calculation or forecast.

Deduplicate `RESERVATION_CONFIRMED` outbox events by earliest timestamp. Do not
infer confirmation dates from mutable update times. Missing dates make annual
sales and sales/booking comparisons unavailable; show the known dated sales
portion and missing-history count. The all-time booking count remains available.

Use immutable booking CREATE audit metadata (`bookingId`, `sourceInquiryId`) for
inquiry attribution. A known null inquiry ID represents a direct request. Do not
match names, email addresses or editable notes. An inquiry with several secured
bookings is excluded once. If secured records lack origin tracking, pending is
labelled an upper bound and its comparison is unavailable (unless no pending
inquiries remain). No records or links are invented or backfilled by this read.

Zero-to-zero change is 0%. Positive activity without a previous baseline is
labelled new activity with no prior baseline, never infinite growth. Reject unsafe
integer totals. Loading and request failures use the existing workspace status and
alert with Refresh recovery. Card links lead to Analytics, Inquiries, Calendar and
Booking respectively. No recurring motion is introduced.

The compact reference layout adopted later on 20 November places labels, totals,
percentage pills in neutral cards. On 21 November, the user removed visible signed
comparison sentences and the Comparison details disclosure. Visually hidden static
content retains exact totals, exact monetary changes, comparison values, timestamps,
definitions and dates without hidden keyboard focus stops. Accessible card names include
the exact amount and full scope. Compact display formatting does not change the
underlying aggregate definitions or integer precision. Increases in unresolved
inquiries use a neutral badge; decreases may use the existing success colors.

Implementation: `lib/admin/dashboard-kpis.ts`, `lib/admin/dashboard-kpi-types.ts`,
`components/admin/DashboardKpis.tsx` and its colocated CSS Module. The existing
Dashboard service reads the aggregate alongside its existing charts and lists.
The isolated real-schema test in `lib/admin/dashboard.test.ts` covers zero data,
Manila year boundaries, duplicate confirmations, current statuses, verified links,
future records, declining values and missing history. Manual evidence and limits
are recorded in `design-change-log.md`.
