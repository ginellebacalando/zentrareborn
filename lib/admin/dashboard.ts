import 'server-only';
import { prisma } from '@/lib/prisma';
import { countDisplayStatuses } from './dashboard-status';
import type { DashboardInsights, DashboardMonth } from './dashboard-types';

type MonthlyCount = { month: string; count: number };
type MonthlyCash = { month: string; cashCents: bigint };
type RecentActivity = {
  requests: number;
  confirmed: number;
  cancelled: number;
  inquiries: number;
  cashCents: bigint;
};
const reservationLabels: Record<string, string> = {
  REQUESTED: 'Requested',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};
const MANILA_OFFSET = 8 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

function safeCents(value: bigint | number) {
  const cents = Number(value);
  if (!Number.isSafeInteger(cents))
    throw new Error('Cash totals are too large to display accurately.');
  return cents;
}

export async function readDashboardInsights(now = new Date()): Promise<DashboardInsights> {
  const manila = new Date(now.getTime() + MANILA_OFFSET);
  const firstMonth = new Date(Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth() - 11, 1));
  const start = new Date(firstMonth.getTime() - MANILA_OFFSET);
  const from = start.toISOString();
  const through = now.toISOString();
  const since = new Date(now.getTime() - 30 * DAY).toISOString();
  const monthStart = new Date(
    Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), 1) - MANILA_OFFSET,
  );
  const nextMonthStart = new Date(
    Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth() + 1, 1) - MANILA_OFFSET,
  );
  const months: DashboardMonth[] = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(
      Date.UTC(firstMonth.getUTCFullYear(), firstMonth.getUTCMonth() + index, 1),
    );
    return {
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('en-PH', {
        timeZone: 'UTC',
        month: 'short',
        year: 'numeric',
      }),
      bookings: 0,
      inquiries: 0,
      cashCents: 0,
      confirmed: 0,
      cancelled: 0,
    };
  });
  // Prisma timestamps are stored as UTC without a zone. Explicit conversion keeps
  // month boundaries correct even when the database session uses Manila time.
  // Bind ISO strings with their UTC offset; date parameters lose that offset in
  // the adapter's raw-query serialization before a timestamptz cast.
  // Confirmations and cancellations use their recorded notice dates (the same source as the
  // KPI and report modules). "Cancelled" includes rejections, matching the display statuses.
  const [
    bookings,
    inquiries,
    receipts,
    reservations,
    confirmations,
    cancellations,
    monthStatuses,
    recent,
  ] = await Promise.all([
    prisma.$queryRaw<MonthlyCount[]>`
      SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'YYYY-MM') AS month,
        COUNT(*)::int AS count
      FROM zion_admin_bookings
      WHERE ("createdAt" AT TIME ZONE 'UTC') >= ${from}::timestamptz
        AND ("createdAt" AT TIME ZONE 'UTC') <= ${through}::timestamptz
      GROUP BY 1`,
    prisma.$queryRaw<MonthlyCount[]>`
      SELECT to_char(submitted_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'YYYY-MM') AS month,
        COUNT(*)::int AS count
      FROM inquiries
      WHERE (submitted_at AT TIME ZONE 'UTC') >= ${from}::timestamptz
        AND (submitted_at AT TIME ZONE 'UTC') <= ${through}::timestamptz
      GROUP BY 1`,
    prisma.$queryRaw<MonthlyCash[]>`
      SELECT to_char("receivedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'YYYY-MM') AS month,
        SUM("amountCents")::bigint AS "cashCents"
      FROM zion_admin_cash_payments
      WHERE "voidedAt" IS NULL AND ("receivedAt" AT TIME ZONE 'UTC') >= ${from}::timestamptz
        AND ("receivedAt" AT TIME ZONE 'UTC') <= ${through}::timestamptz
      GROUP BY 1`,
    prisma.adminBooking.groupBy({ by: ['reservation'], _count: { _all: true } }),
    prisma.$queryRaw<MonthlyCount[]>`
      SELECT to_char(first_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'YYYY-MM') AS month,
        COUNT(*)::int AS count
      FROM (
        SELECT "bookingId", MIN("createdAt") AS first_at
        FROM zion_admin_outbox WHERE event = 'RESERVATION_CONFIRMED'
        GROUP BY "bookingId"
      ) confirmations
      WHERE (first_at AT TIME ZONE 'UTC') >= ${from}::timestamptz
        AND (first_at AT TIME ZONE 'UTC') <= ${through}::timestamptz
      GROUP BY 1`,
    prisma.$queryRaw<MonthlyCount[]>`
      SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila', 'YYYY-MM') AS month,
        COUNT(DISTINCT "bookingId")::int AS count
      FROM zion_admin_outbox
      WHERE event IN ('CANCEL', 'REJECT')
        AND ("createdAt" AT TIME ZONE 'UTC') >= ${from}::timestamptz
        AND ("createdAt" AT TIME ZONE 'UTC') <= ${through}::timestamptz
      GROUP BY 1`,
    prisma.adminBooking.groupBy({
      by: ['approval', 'reservation'],
      where: { startsAt: { gte: monthStart, lt: nextMonthStart } },
      _count: { _all: true },
    }),
    prisma.$queryRaw<RecentActivity[]>`
      SELECT
        (SELECT COUNT(*) FROM zion_admin_bookings
          WHERE ("createdAt" AT TIME ZONE 'UTC') >= ${since}::timestamptz
            AND ("createdAt" AT TIME ZONE 'UTC') <= ${through}::timestamptz)::int AS requests,
        (SELECT COUNT(*) FROM (
            SELECT MIN("createdAt") AS first_at FROM zion_admin_outbox
            WHERE event = 'RESERVATION_CONFIRMED' GROUP BY "bookingId"
          ) confirmations
          WHERE (first_at AT TIME ZONE 'UTC') >= ${since}::timestamptz
            AND (first_at AT TIME ZONE 'UTC') <= ${through}::timestamptz)::int AS confirmed,
        (SELECT COUNT(DISTINCT "bookingId") FROM zion_admin_outbox
          WHERE event IN ('CANCEL', 'REJECT')
            AND ("createdAt" AT TIME ZONE 'UTC') >= ${since}::timestamptz
            AND ("createdAt" AT TIME ZONE 'UTC') <= ${through}::timestamptz)::int AS cancelled,
        (SELECT COUNT(*) FROM inquiries
          WHERE (submitted_at AT TIME ZONE 'UTC') >= ${since}::timestamptz
            AND (submitted_at AT TIME ZONE 'UTC') <= ${through}::timestamptz)::int AS inquiries,
        (SELECT COALESCE(SUM("amountCents"), 0) FROM zion_admin_cash_payments
          WHERE "voidedAt" IS NULL AND ("receivedAt" AT TIME ZONE 'UTC') >= ${since}::timestamptz
            AND ("receivedAt" AT TIME ZONE 'UTC') <= ${through}::timestamptz)::bigint AS "cashCents"`,
  ]);
  for (const month of months) {
    month.bookings = bookings.find((row) => row.month === month.key)?.count ?? 0;
    month.inquiries = inquiries.find((row) => row.month === month.key)?.count ?? 0;
    month.cashCents = safeCents(receipts.find((row) => row.month === month.key)?.cashCents ?? 0);
    month.confirmed = confirmations.find((row) => row.month === month.key)?.count ?? 0;
    month.cancelled = cancellations.find((row) => row.month === month.key)?.count ?? 0;
  }
  safeCents(months.reduce((total, month) => total + month.cashCents, 0));
  const slices = Object.entries(reservationLabels).map(([key, label]) => ({
    key,
    label,
    count: reservations.find((row) => row.reservation === key)?._count._all ?? 0,
  }));
  const other = reservations
    .filter((row) => !Object.hasOwn(reservationLabels, row.reservation))
    .reduce((total, row) => total + row._count._all, 0);
  if (other) slices.push({ key: 'OTHER', label: 'Other', count: other });
  const activity = recent[0];
  return {
    generatedAt: now.toISOString(),
    timezone: 'Asia/Manila',
    months,
    reservations: slices,
    thisMonth: {
      key: months.at(-1)!.key,
      label: new Date(
        Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), 1),
      ).toLocaleDateString('en-PH', { timeZone: 'UTC', month: 'long', year: 'numeric' }),
      statuses: countDisplayStatuses(
        monthStatuses.map((row) => ({
          approval: row.approval,
          reservation: row.reservation,
          count: row._count._all,
        })),
      ),
    },
    last30: {
      requests: Number(activity?.requests ?? 0),
      confirmed: Number(activity?.confirmed ?? 0),
      cancelled: Number(activity?.cancelled ?? 0),
      inquiries: Number(activity?.inquiries ?? 0),
      cashCents: safeCents(activity?.cashCents ?? 0),
    },
  };
}
