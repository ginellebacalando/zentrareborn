import 'server-only';
import { prisma } from '@/lib/prisma';
import { analyticsPeriod } from './analytics-period';
import { AdminError } from './errors';
import type { DashboardKpi, DashboardKpis } from './dashboard-kpi-types';

type Totals = Record<
  | 'salesCurrent'
  | 'salesPrevious'
  | 'pendingValue'
  | 'pendingCurrent'
  | 'pendingPrevious'
  | 'upcomingValue'
  | 'upcomingCurrent'
  | 'upcomingPrevious'
  | 'bookingsValue'
  | 'bookingsCurrent'
  | 'bookingsPrevious'
  | 'undatedSecuredBookings'
  | 'untrackedSecuredBookings',
  bigint | number
>;

function safe(value: bigint | number) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0)
    throw new AdminError('Dashboard totals exceed the safe reporting range.', 500);
  return result;
}

export async function readDashboardKpis(now = new Date()): Promise<DashboardKpis> {
  const { range } = analyticsPeriod('year', undefined, now);
  const asOf = range.current.through;
  const nextEnd = new Date(now.getTime() + 30 * 86400000).toISOString();
  const previousStart = new Date(now.getTime() - 30 * 86400000).toISOString();
  const instant = now.toISOString();
  // Current statuses are deliberate: these are dated activity cohorts, not
  // reconstructed historical dashboard snapshots. Only immutable IDs link inquiries.
  const [row] = await prisma.$queryRaw<Totals[]>`
    WITH confirmations AS (
      SELECT "bookingId", MIN("createdAt" AT TIME ZONE 'UTC') AS secured_at
      FROM zion_admin_outbox WHERE event = 'RESERVATION_CONFIRMED'
        AND ("createdAt" AT TIME ZONE 'UTC') < ${asOf}::timestamptz GROUP BY "bookingId"
    ), origins AS (
      SELECT DISTINCT ON (metadata->>'bookingId') metadata->>'bookingId' AS booking_id,
        metadata->>'sourceInquiryId' AS inquiry_id
      FROM audit_logs WHERE source='zion-admin' AND module='Bookings' AND action='CREATE'
        AND metadata ? 'bookingId' AND metadata ? 'sourceInquiryId'
        AND (timestamp AT TIME ZONE 'UTC') < ${asOf}::timestamptz
      ORDER BY metadata->>'bookingId', timestamp, id
    ), bookings AS (
      SELECT b.*, b.reservation IN ('CONFIRMED','COMPLETED') AS secured,
        c.secured_at, o.inquiry_id, o.booking_id IS NOT NULL AS origin_tracked
      FROM zion_admin_bookings b LEFT JOIN confirmations c ON c."bookingId"=b.id
        LEFT JOIN origins o ON o.booking_id=b.id
      WHERE (b."createdAt" AT TIME ZONE 'UTC') < ${asOf}::timestamptz
    ), pending AS (
      SELECT i.submitted_at AT TIME ZONE 'UTC' AS submitted_at FROM inquiries i
      WHERE i.status NOT IN ('closed','spam')
        AND (i.submitted_at AT TIME ZONE 'UTC') < ${asOf}::timestamptz
        AND NOT EXISTS (
          SELECT 1 FROM bookings b WHERE b.secured AND b.inquiry_id=i.id
        )
    )
    SELECT
      COALESCE(SUM("totalCents") FILTER (WHERE secured AND secured_at >= ${range.current.start}::timestamptz
        AND secured_at < ${range.current.through}::timestamptz),0)::bigint AS "salesCurrent",
      COALESCE(SUM("totalCents") FILTER (WHERE secured AND secured_at >= ${range.comparison.start}::timestamptz
        AND secured_at < ${range.comparison.through}::timestamptz),0)::bigint AS "salesPrevious",
      (SELECT COUNT(*) FROM pending) AS "pendingValue",
      (SELECT COUNT(*) FROM pending WHERE submitted_at >= ${range.current.start}::timestamptz
        AND submitted_at < ${range.current.through}::timestamptz) AS "pendingCurrent",
      (SELECT COUNT(*) FROM pending WHERE submitted_at >= ${range.comparison.start}::timestamptz
        AND submitted_at < ${range.comparison.through}::timestamptz) AS "pendingPrevious",
      COUNT(*) FILTER (WHERE reservation='CONFIRMED'
        AND ("startsAt" AT TIME ZONE 'UTC') >= ${instant}::timestamptz) AS "upcomingValue",
      COUNT(*) FILTER (WHERE reservation='CONFIRMED'
        AND ("startsAt" AT TIME ZONE 'UTC') >= ${instant}::timestamptz
        AND ("startsAt" AT TIME ZONE 'UTC') < ${nextEnd}::timestamptz) AS "upcomingCurrent",
      COUNT(*) FILTER (WHERE secured
        AND ("startsAt" AT TIME ZONE 'UTC') >= ${previousStart}::timestamptz
        AND ("startsAt" AT TIME ZONE 'UTC') < ${instant}::timestamptz) AS "upcomingPrevious",
      COUNT(*) FILTER (WHERE secured) AS "bookingsValue",
      COUNT(*) FILTER (WHERE secured AND secured_at >= ${range.current.start}::timestamptz
        AND secured_at < ${range.current.through}::timestamptz) AS "bookingsCurrent",
      COUNT(*) FILTER (WHERE secured AND secured_at >= ${range.comparison.start}::timestamptz
        AND secured_at < ${range.comparison.through}::timestamptz) AS "bookingsPrevious",
      COUNT(*) FILTER (WHERE secured AND secured_at IS NULL) AS "undatedSecuredBookings",
      COUNT(*) FILTER (WHERE secured AND NOT origin_tracked) AS "untrackedSecuredBookings"
    FROM bookings`;
  if (!row) throw new AdminError('Dashboard totals are unavailable.', 500);
  const metric = (
    value: bigint | number,
    current: bigint | number,
    previous: bigint | number,
  ): DashboardKpi => ({ value: safe(value), current: safe(current), previous: safe(previous) });
  return {
    asOf: instant,
    timezone: 'Asia/Manila',
    year: Number(range.current.label),
    annual: { current: range.current, comparison: range.comparison },
    outlook: {
      current: { start: instant, end: nextEnd, through: nextEnd, label: 'Next 30 days' },
      comparison: {
        start: previousStart,
        end: instant,
        through: instant,
        label: 'Previous 30 days',
      },
    },
    sales: metric(row.salesCurrent, row.salesCurrent, row.salesPrevious),
    pending: metric(row.pendingValue, row.pendingCurrent, row.pendingPrevious),
    upcoming: metric(row.upcomingValue, row.upcomingCurrent, row.upcomingPrevious),
    bookings: metric(row.bookingsValue, row.bookingsCurrent, row.bookingsPrevious),
    quality: {
      undatedSecuredBookings: safe(row.undatedSecuredBookings),
      untrackedSecuredBookings: safe(row.untrackedSecuredBookings),
    },
  };
}
