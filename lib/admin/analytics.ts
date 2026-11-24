import 'server-only';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { AdminError } from './errors';
import { analyticsPeriod } from './analytics-period';
import { businessTrajectory } from './analytics-math';
import {
  reportKinds,
  type AnalyticsMeasures,
  type AnalyticsReport,
  type AnalyticsSnapshot,
} from './analytics-types';

type Numeric<T> = { [K in keyof T]: bigint | number };
type SnapshotRow = Numeric<AnalyticsSnapshot>;
type MeasureRow = Numeric<AnalyticsMeasures> & { tag: 'current' | 'comparison' };
type BucketRow = {
  key: string;
  cashCents: bigint;
  securedEvents: bigint;
  completedEvents: bigint;
  requests: bigint;
  inquiries: bigint;
};

function safe(value: bigint | number) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0)
    throw new AdminError(
      'Report totals exceed the safe reporting range. Please contact the administrator.',
      500,
    );
  return number;
}

function measures(row: MeasureRow): AnalyticsMeasures {
  return {
    cashCents: safe(row.cashCents),
    newSecuredBookings: safe(row.newSecuredBookings),
    requests: safe(row.requests),
    inquiries: safe(row.inquiries),
    linkedInquiries: safe(row.linkedInquiries),
    convertedInquiries: safe(row.convertedInquiries),
    securedEvents: safe(row.securedEvents),
    completedEvents: safe(row.completedEvents),
    cancellations: safe(row.cancellations),
    unattributedOrigins: safe(row.unattributedOrigins),
  };
}

// One row per booking avoids multiplying contract/receipt amounts when a booking
// has several payments, audit events, or repeated notification attempts.
function ledgerSql(asOf: string) {
  return Prisma.sql`WITH receipts AS (
    SELECT * FROM zion_admin_cash_payments
    WHERE "voidedAt" IS NULL AND ("receivedAt" AT TIME ZONE 'UTC') < ${asOf}::timestamptz
  ), paid AS (
    SELECT "bookingId", SUM("amountCents") AS cents FROM receipts GROUP BY "bookingId"
  ), confirmations AS (
    SELECT "bookingId", MIN("createdAt" AT TIME ZONE 'UTC') AS secured_at
    FROM zion_admin_outbox WHERE event = 'RESERVATION_CONFIRMED'
      AND ("createdAt" AT TIME ZONE 'UTC') < ${asOf}::timestamptz GROUP BY "bookingId"
  ), origins AS (
    SELECT DISTINCT ON (metadata->>'bookingId') metadata->>'bookingId' AS booking_id,
      metadata->>'sourceInquiryId' AS inquiry_id
    FROM audit_logs WHERE source = 'zion-admin' AND module = 'Bookings' AND action = 'CREATE'
      AND metadata ? 'bookingId' AND metadata ? 'sourceInquiryId'
      AND (timestamp AT TIME ZONE 'UTC') < ${asOf}::timestamptz
    ORDER BY metadata->>'bookingId', timestamp, id
  ), ledger AS (
    SELECT b.*, COALESCE(p.cents,0)::bigint AS paid_cents,
      GREATEST(b."totalCents" - COALESCE(p.cents,0),0)::bigint AS balance_cents,
      b.reservation IN ('CONFIRMED','COMPLETED') AS secured,
      c.secured_at, o.inquiry_id, o.booking_id IS NOT NULL AS origin_tracked
    FROM zion_admin_bookings b LEFT JOIN paid p ON p."bookingId" = b.id
      LEFT JOIN confirmations c ON c."bookingId" = b.id LEFT JOIN origins o ON o.booking_id = b.id
    WHERE (b."createdAt" AT TIME ZONE 'UTC') < ${asOf}::timestamptz
  )`;
}

export async function readAnalyticsReport(
  params: URLSearchParams,
  now = new Date(),
): Promise<AnalyticsReport> {
  const kind = z.enum(reportKinds).parse(params.get('period') || 'month');
  let period: ReturnType<typeof analyticsPeriod>;
  try {
    period = analyticsPeriod(kind, params.get('date') || undefined, now);
  } catch (error) {
    throw new AdminError(error instanceof Error ? error.message : 'Invalid report period.');
  }
  const { range } = period;
  const asOf = now.toISOString();
  const asOfExclusive = new Date(now.getTime() + 1).toISOString();
  const ledger = ledgerSql(asOfExclusive);
  const result = await prisma.$transaction(
    async (tx) => {
      const [snapshotRow] = await tx.$queryRaw<SnapshotRow[]>(Prisma.sql`${ledger}
      SELECT
        COALESCE((SELECT SUM("amountCents") FROM receipts),0)::bigint AS "allTimeCashCents",
        COALESCE(SUM(balance_cents) FILTER (WHERE secured),0)::bigint AS "outstandingCents",
        COUNT(*) FILTER (WHERE secured AND balance_cents > 0) AS "outstandingBookings",
        COALESCE(SUM("totalCents") FILTER (WHERE secured),0)::bigint AS "securedContractCents",
        COALESCE(SUM(LEAST(paid_cents,"totalCents")) FILTER (WHERE secured),0)::bigint AS "paidOnSecuredCents",
        COALESCE(SUM("totalCents") FILTER (WHERE approval='APPROVED' AND reservation='REQUESTED'),0)::bigint AS "pipelineCents",
        COUNT(*) FILTER (WHERE approval='APPROVED' AND reservation='REQUESTED') AS "pipelineRequests",
        COALESCE(SUM(balance_cents) FILTER (WHERE secured AND ("endsAt" AT TIME ZONE 'UTC') < ${asOfExclusive}::timestamptz),0)::bigint AS "pastEventBalanceCents",
        COUNT(*) FILTER (WHERE secured AND balance_cents > 0 AND ("endsAt" AT TIME ZONE 'UTC') < ${asOfExclusive}::timestamptz) AS "pastEventBalanceBookings",
        COUNT(*) FILTER (WHERE paid_cents > "totalCents") AS "overpaidBookings",
        COUNT(*) FILTER (WHERE secured AND secured_at IS NULL
          AND ("updatedAt" AT TIME ZONE 'UTC') >= ${range.comparison.start}::timestamptz
          AND ("createdAt" AT TIME ZONE 'UTC') < ${range.current.through}::timestamptz) AS "undatedConfirmations",
        COUNT(*) FILTER (WHERE reservation='CONFIRMED' AND ("startsAt" AT TIME ZONE 'UTC') >= ${asOf}::timestamptz
          AND ("startsAt" AT TIME ZONE 'UTC') < ${range.current.end}::timestamptz) AS "upcomingEvents"
      FROM ledger`);
      const rows = await tx.$queryRaw<
        MeasureRow[]
      >(Prisma.sql`${ledger}, windows(tag,begin_at,through_at) AS (
      VALUES ('current',${range.current.start}::timestamptz,${range.current.through}::timestamptz),
        ('comparison',${range.comparison.start}::timestamptz,${range.comparison.through}::timestamptz)
    ) SELECT w.tag,
      (SELECT COALESCE(SUM("amountCents"),0)::bigint FROM receipts
        WHERE ("receivedAt" AT TIME ZONE 'UTC') >= w.begin_at AND ("receivedAt" AT TIME ZONE 'UTC') < w.through_at) AS "cashCents",
      (SELECT COUNT(*) FROM ledger WHERE secured AND secured_at >= w.begin_at AND secured_at < w.through_at) AS "newSecuredBookings",
      (SELECT COUNT(*) FROM ledger WHERE ("createdAt" AT TIME ZONE 'UTC') >= w.begin_at AND ("createdAt" AT TIME ZONE 'UTC') < w.through_at) AS requests,
      (SELECT COUNT(*) FROM inquiries i WHERE (i.submitted_at AT TIME ZONE 'UTC') >= w.begin_at AND (i.submitted_at AT TIME ZONE 'UTC') < w.through_at) AS inquiries,
      (SELECT COUNT(*) FROM inquiries i WHERE (i.submitted_at AT TIME ZONE 'UTC') >= w.begin_at AND (i.submitted_at AT TIME ZONE 'UTC') < w.through_at
        AND EXISTS (SELECT 1 FROM ledger l WHERE l.inquiry_id=i.id)) AS "linkedInquiries",
      (SELECT COUNT(*) FROM inquiries i WHERE (i.submitted_at AT TIME ZONE 'UTC') >= w.begin_at AND (i.submitted_at AT TIME ZONE 'UTC') < w.through_at
        AND EXISTS (SELECT 1 FROM ledger l WHERE l.inquiry_id=i.id AND l.secured)) AS "convertedInquiries",
      (SELECT COUNT(*) FROM ledger WHERE secured AND ("startsAt" AT TIME ZONE 'UTC') >= w.begin_at AND ("startsAt" AT TIME ZONE 'UTC') < w.through_at) AS "securedEvents",
      (SELECT COUNT(*) FROM ledger WHERE reservation='COMPLETED' AND ("startsAt" AT TIME ZONE 'UTC') >= w.begin_at AND ("startsAt" AT TIME ZONE 'UTC') < w.through_at) AS "completedEvents",
      (SELECT COUNT(DISTINCT "bookingId") FROM zion_admin_outbox WHERE event='CANCEL'
        AND ("createdAt" AT TIME ZONE 'UTC') >= w.begin_at AND ("createdAt" AT TIME ZONE 'UTC') < w.through_at) AS cancellations,
      (SELECT COUNT(*) FROM ledger WHERE NOT origin_tracked AND ("createdAt" AT TIME ZONE 'UTC') >= w.begin_at) AS "unattributedOrigins"
    FROM windows w`);
      const bucketRows = await tx.$queryRaw<BucketRow[]>(Prisma.sql`${ledger}, buckets AS (
      SELECT key, begin_at::timestamptz AS begin_at, through_at::timestamptz AS through_at
      FROM jsonb_to_recordset(${JSON.stringify(period.buckets.map((bucket) => ({ key: bucket.key, begin_at: bucket.start, through_at: bucket.end })))}::jsonb)
        AS b(key text, begin_at text, through_at text)
    ) SELECT b.key,
      (SELECT COALESCE(SUM("amountCents"),0)::bigint FROM receipts WHERE ("receivedAt" AT TIME ZONE 'UTC') >= b.begin_at AND ("receivedAt" AT TIME ZONE 'UTC') < b.through_at) AS "cashCents",
      (SELECT COUNT(*) FROM ledger WHERE secured AND ("startsAt" AT TIME ZONE 'UTC') >= b.begin_at AND ("startsAt" AT TIME ZONE 'UTC') < b.through_at) AS "securedEvents",
      (SELECT COUNT(*) FROM ledger WHERE reservation='COMPLETED' AND ("startsAt" AT TIME ZONE 'UTC') >= b.begin_at AND ("startsAt" AT TIME ZONE 'UTC') < b.through_at) AS "completedEvents",
      (SELECT COUNT(*) FROM ledger WHERE ("createdAt" AT TIME ZONE 'UTC') >= b.begin_at AND ("createdAt" AT TIME ZONE 'UTC') < b.through_at) AS requests,
      (SELECT COUNT(*) FROM inquiries i WHERE (i.submitted_at AT TIME ZONE 'UTC') >= b.begin_at AND (i.submitted_at AT TIME ZONE 'UTC') < b.through_at) AS inquiries
    FROM buckets b ORDER BY b.begin_at`);
      const [tracking] = await tx.$queryRaw<{ since: Date | null }[]>`
      SELECT MIN(timestamp AT TIME ZONE 'UTC') AS since FROM audit_logs
      WHERE source='zion-admin' AND module='Bookings' AND action='CREATE'
        AND metadata ? 'bookingId' AND metadata ? 'sourceInquiryId'
        AND (timestamp AT TIME ZONE 'UTC') < ${asOfExclusive}::timestamptz`;
      return { snapshotRow, rows, bucketRows, tracking };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 30000,
      maxWait: 10000,
    },
  );
  const s = result.snapshotRow;
  const snapshot: AnalyticsSnapshot = {
    allTimeCashCents: safe(s.allTimeCashCents),
    outstandingCents: safe(s.outstandingCents),
    outstandingBookings: safe(s.outstandingBookings),
    securedContractCents: safe(s.securedContractCents),
    paidOnSecuredCents: safe(s.paidOnSecuredCents),
    pipelineCents: safe(s.pipelineCents),
    pipelineRequests: safe(s.pipelineRequests),
    pastEventBalanceCents: safe(s.pastEventBalanceCents),
    pastEventBalanceBookings: safe(s.pastEventBalanceBookings),
    overpaidBookings: safe(s.overpaidBookings),
    undatedConfirmations: safe(s.undatedConfirmations),
    upcomingEvents: safe(s.upcomingEvents),
  };
  const current = measures(result.rows.find((row) => row.tag === 'current')!);
  const comparison = measures(result.rows.find((row) => row.tag === 'comparison')!);
  const buckets = period.buckets.map((bucket) => {
    const row = result.bucketRows.find((value) => value.key === bucket.key)!;
    return {
      ...bucket,
      cashCents: safe(row.cashCents),
      securedEvents: safe(row.securedEvents),
      completedEvents: safe(row.completedEvents),
      requests: safe(row.requests),
      inquiries: safe(row.inquiries),
    };
  });
  const confirmationHistoryComplete = snapshot.undatedConfirmations === 0;
  return {
    asOf,
    timezone: 'Asia/Manila',
    range,
    snapshot,
    current,
    comparison,
    buckets,
    quality: {
      currentAttributionComplete: current.unattributedOrigins === 0,
      comparisonAttributionComplete: comparison.unattributedOrigins === 0,
      confirmationHistoryComplete,
      trackingSince: result.tracking.since?.toISOString() ?? null,
    },
    trajectory: businessTrajectory(current, comparison, confirmationHistoryComplete),
  };
}
