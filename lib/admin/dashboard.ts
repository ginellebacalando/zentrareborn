import 'server-only';
import { prisma } from '@/lib/prisma';
import type { DashboardInsights, DashboardMonth } from './dashboard-types';

type MonthlyCount = { month: string; count: number };
type MonthlyCash = { month: string; cashCents: bigint };
const reservationLabels: Record<string, string> = {
  REQUESTED: 'Requested',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export async function readDashboardInsights(now = new Date()): Promise<DashboardInsights> {
  const manila = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const firstMonth = new Date(Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth() - 11, 1));
  const start = new Date(firstMonth.getTime() - 8 * 60 * 60 * 1000);
  const from = start.toISOString();
  const through = now.toISOString();
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
    };
  });
  // Prisma timestamps are stored as UTC without a zone. Explicit conversion keeps
  // month boundaries correct even when the database session uses Manila time.
  // Bind ISO strings with their UTC offset; date parameters lose that offset in
  // the adapter's raw-query serialization before a timestamptz cast.
  const [bookings, inquiries, receipts, reservations] = await Promise.all([
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
  ]);
  for (const month of months) {
    month.bookings = bookings.find((row) => row.month === month.key)?.count ?? 0;
    month.inquiries = inquiries.find((row) => row.month === month.key)?.count ?? 0;
    month.cashCents = Number(receipts.find((row) => row.month === month.key)?.cashCents ?? 0);
    if (!Number.isSafeInteger(month.cashCents))
      throw new Error('Monthly cash totals are too large to display accurately.');
  }
  if (!Number.isSafeInteger(months.reduce((total, month) => total + month.cashCents, 0)))
    throw new Error('Cash totals are too large to display accurately.');
  const slices = Object.entries(reservationLabels).map(([key, label]) => ({
    key,
    label,
    count: reservations.find((row) => row.reservation === key)?._count._all ?? 0,
  }));
  const other = reservations
    .filter((row) => !Object.hasOwn(reservationLabels, row.reservation))
    .reduce((total, row) => total + row._count._all, 0);
  if (other) slices.push({ key: 'OTHER', label: 'Other', count: other });
  return { generatedAt: now.toISOString(), timezone: 'Asia/Manila', months, reservations: slices };
}
