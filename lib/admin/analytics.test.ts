import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';
import { analyticsCsv, conversionRate, reportDates } from './analytics-export';
import { analyticsPeriod } from './analytics-period';
import { businessTrajectory } from './analytics-math';
import type { AnalyticsMeasures } from './analytics-types';

const now = new Date('2026-11-19T04:00:00.000Z');
const emptyMeasures: AnalyticsMeasures = {
  cashCents: 0,
  newSecuredBookings: 0,
  requests: 0,
  inquiries: 0,
  linkedInquiries: 0,
  convertedInquiries: 0,
  securedEvents: 0,
  completedEvents: 0,
  cancellations: 0,
  unattributedOrigins: 0,
};

test('analytics uses Manila calendar periods, elapsed comparisons, leap dates and no future buckets', () => {
  const week = analyticsPeriod('week', undefined, now);
  assert.equal(week.range.current.start, '2026-11-15T16:00:00.000Z');
  assert.equal(week.range.current.end, '2026-11-22T16:00:00.000Z');
  assert.equal(week.range.comparison.through, '2026-11-12T04:00:00.001Z');
  assert.deepEqual(
    week.buckets.map((bucket) => bucket.label),
    ['Mon', 'Tue', 'Wed', 'Thu'],
  );
  const month = analyticsPeriod('month', undefined, now);
  assert.equal(month.range.comparison.start, '2026-09-30T16:00:00.000Z');
  assert.equal(month.range.comparison.through, '2026-10-19T04:00:00.001Z');
  assert.deepEqual(
    month.buckets.map((bucket) => bucket.label),
    ['1–7', '8–14', '15–19'],
  );
  const quarter = analyticsPeriod('quarter', undefined, now);
  assert.equal(quarter.range.current.label, 'Q4 2026');
  assert.equal(quarter.range.current.start, '2026-09-30T16:00:00.000Z');
  assert.deepEqual(
    quarter.buckets.map((bucket) => bucket.label),
    ['Oct', 'Nov'],
  );
  const leap = analyticsPeriod('year', '2024-02-29', now);
  assert.equal(
    (Date.parse(leap.range.current.end) - Date.parse(leap.range.current.start)) / 86400000,
    366,
  );
  assert.equal(leap.buckets.length, 12);
  assert.equal(leap.range.partial, false);
  assert.equal(leap.range.comparison.through, leap.range.current.start);
  const shortPrior = analyticsPeriod('month', undefined, new Date('2026-03-31T04:00:00Z'));
  assert.equal(shortPrior.range.comparison.through, shortPrior.range.current.start);
  const firstDay = analyticsPeriod('month', undefined, new Date('2026-10-31T17:00:00Z'));
  assert.equal(firstDay.buckets.length, 1);
  assert.equal(firstDay.range.current.start, '2026-10-31T16:00:00.000Z');
  assert.throws(() => analyticsPeriod('month', '2026-02-30', now), /valid calendar/);
  assert.throws(() => analyticsPeriod('month', '2026-11-20', now), /through today/);
});

test('trajectory distinguishes new, empty, mixed, improving, falling, steady and incomplete history', () => {
  const measure = (cashCents: number, newSecuredBookings: number) => ({
    ...emptyMeasures,
    cashCents,
    newSecuredBookings,
  });
  assert.equal(businessTrajectory(measure(0, 0), measure(0, 0), true).state, 'empty');
  assert.equal(businessTrajectory(measure(100, 1), measure(0, 0), true).state, 'new');
  assert.equal(businessTrajectory(measure(100, 1), measure(0, 0), true).cashChangePercent, null);
  assert.equal(businessTrajectory(measure(110, 2), measure(100, 1), true).state, 'improving');
  assert.equal(businessTrajectory(measure(90, 0), measure(100, 1), true).state, 'attention');
  assert.equal(businessTrajectory(measure(110, 0), measure(100, 1), true).state, 'mixed');
  assert.equal(businessTrajectory(measure(100, 1), measure(100, 1), true).state, 'steady');
  assert.equal(businessTrajectory(measure(110, 2), measure(100, 1), false).state, 'limited');
});

test(
  'analytics reports actual cash, balances, dated confirmations, and verified inquiry conversion',
  { timeout: 120000 },
  async () => {
    const db = new PGlite();
    await db.waitReady;
    const sql = execFileSync(
      process.execPath,
      [
        'node_modules/prisma/build/index.js',
        'migrate',
        'diff',
        '--from-empty',
        '--to-schema',
        'prisma/schema.prisma',
        '--script',
      ],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
    );
    await db.exec(sql.slice(sql.indexOf('-- CreateSchema')));
    const adminSql = readFileSync('prisma/admin.sql', 'utf8');
    await db.exec(adminSql.slice(adminSql.indexOf('-- Admin-only data')));
    const server = createServer(db, { logLevel: LogLevel.Error });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${address.port}/postgres`;
    process.env.DATABASE_POOL_MAX = '1';
    const { prisma } = await import('../prisma');
    const { readAnalyticsReport } = await import('./analytics');
    const params = new URLSearchParams({ period: 'month', date: '2026-11-19' });
    try {
      await prisma.$executeRawUnsafe("SET TIME ZONE 'Asia/Manila'");
      const empty = await readAnalyticsReport(params, now);
      assert.equal(empty.trajectory.state, 'empty');
      assert.equal(empty.snapshot.outstandingCents, 0);
      const inquiry = async (id: string, date: string) =>
        prisma.inquiry.create({
          data: {
            id,
            inquiryReference: `INQ-${id}`,
            fullName: 'Private visitor',
            email: `${id}@example.test`,
            message: 'Test only',
            submittedAt: new Date(date),
          },
        });
      await inquiry('a', '2026-11-01T01:00:00Z');
      await inquiry('b', '2026-11-03T01:00:00Z');
      await inquiry('c', '2026-11-10T01:00:00Z');
      await inquiry('future-inquiry', '2026-11-20T01:00:00Z');
      const booking = async (
        id: string,
        reservation: string,
        date: string,
        event: string,
        total: number,
        source: string | null | undefined,
        confirmation?: string,
      ) => {
        await prisma.adminBooking.create({
          data: {
            id,
            reference: `TEST-${id}`,
            clientName: 'Private client',
            email: id === 'undated' ? 'c@example.test' : `${id}@example.test`,
            phone: '0000000000',
            eventType: 'Wedding',
            packageName: 'Test package',
            venue: 'Test venue',
            startsAt: new Date(event),
            endsAt: new Date(Date.parse(event) + 3600000),
            guests: 40,
            totalCents: total,
            depositCents: 1000,
            paymentRule: 'DEPOSIT_REQUIRED',
            policyVersion: 1,
            createdBy: 'qa',
            updatedBy: 'qa',
            createdAt: new Date(date),
            updatedAt: new Date(date),
            approval: 'APPROVED',
            verification: 'VERIFIED',
            reservation,
            notes:
              id === 'undated'
                ? 'From inquiry INQ-c. Editable notes do not prove a conversion.'
                : '',
          },
        });
        if (source !== undefined)
          await prisma.auditLog.create({
            data: {
              timestamp: new Date(date),
              userName: 'Test owner',
              userRole: 'SUPERADMIN',
              action: 'CREATE',
              module: 'Bookings',
              description: 'Test only',
              status: 'SUCCESS',
              source: 'zion-admin',
              metadata: { bookingId: id, sourceInquiryId: source },
            },
          });
        if (confirmation)
          await prisma.adminOutbox.create({
            data: {
              bookingId: id,
              event: 'RESERVATION_CONFIRMED',
              recipient: 'private@example.test',
              subject: 'Test only',
              body: 'Test only',
              createdAt: new Date(confirmation),
            },
          });
      };
      await booking(
        'linked-a',
        'CONFIRMED',
        '2026-11-02T00:00:00Z',
        '2026-11-20T00:00:00Z',
        100000,
        'a',
        '2026-11-03T00:00:00Z',
      );
      await booking(
        'linked-b',
        'COMPLETED',
        '2026-11-04T00:00:00Z',
        '2026-11-10T00:00:00Z',
        50000,
        'a',
        '2026-11-06T00:00:00Z',
      );
      await booking(
        'cancelled',
        'CANCELLED',
        '2026-11-05T00:00:00Z',
        '2026-11-15T00:00:00Z',
        10000,
        null,
        '2026-11-06T00:00:00Z',
      );
      await booking(
        'pipeline',
        'REQUESTED',
        '2026-11-06T00:00:00Z',
        '2026-12-02T00:00:00Z',
        80000,
        'b',
      );
      await booking(
        'previous',
        'CONFIRMED',
        '2026-10-02T00:00:00Z',
        '2026-10-18T00:00:00Z',
        200000,
        null,
        '2026-10-03T00:00:00Z',
      );
      await booking(
        'future',
        'CONFIRMED',
        '2026-11-20T00:00:00Z',
        '2026-12-10T00:00:00Z',
        50000,
        'future-inquiry',
        '2026-11-20T01:00:00Z',
      );
      const receipt = async (
        id: string,
        bookingId: string,
        amountCents: number,
        date: string,
        voided = false,
      ) =>
        prisma.adminCashPayment.create({
          data: {
            receiptNumber: id,
            bookingId,
            amountCents,
            receivedAt: new Date(date),
            recordedBy: 'qa',
            voidedAt: voided ? new Date('2026-11-18T00:00:00Z') : null,
          },
        });
      await receipt('a', 'linked-a', 40000, '2026-11-02T00:00:00Z');
      await receipt('b', 'linked-b', 50000, '2026-11-05T00:00:00Z');
      await receipt('c', 'cancelled', 10000, '2026-11-05T00:00:00Z');
      await receipt('d', 'pipeline', 10000, '2026-11-12T00:00:00Z');
      await receipt('previous', 'previous', 100000, '2026-10-02T00:00:00Z');
      await receipt('previous-later', 'previous', 50000, '2026-10-25T00:00:00Z');
      await receipt('voided', 'linked-a', 50000, '2026-11-08T00:00:00Z', true);
      await receipt('future', 'linked-a', 30000, '2026-11-20T00:00:00Z');
      await prisma.adminOutbox.createMany({
        data: [
          {
            bookingId: 'linked-a',
            event: 'RESERVATION_CONFIRMED',
            recipient: 'private@example.test',
            subject: 'Repeat',
            body: 'Test',
            createdAt: new Date('2026-11-12T00:00:00Z'),
          },
          {
            bookingId: 'cancelled',
            event: 'CANCEL',
            recipient: 'private@example.test',
            subject: 'Cancel',
            body: 'Test',
            createdAt: new Date('2026-11-15T00:00:00Z'),
          },
        ],
      });
      const report = await readAnalyticsReport(params, now);
      assert.equal(report.current.cashCents, 110000);
      assert.equal(report.comparison.cashCents, 100000);
      assert.equal(report.snapshot.allTimeCashCents, 260000);
      assert.equal(report.snapshot.outstandingCents, 110000);
      assert.equal(report.snapshot.pastEventBalanceCents, 50000);
      assert.equal(report.snapshot.pipelineCents, 80000);
      assert.equal(
        report.snapshot.paidOnSecuredCents + report.snapshot.outstandingCents,
        report.snapshot.securedContractCents,
      );
      assert.equal(report.current.newSecuredBookings, 2);
      assert.equal(report.comparison.newSecuredBookings, 1);
      assert.equal(report.current.inquiries, 3);
      assert.equal(report.current.linkedInquiries, 2);
      assert.equal(report.current.convertedInquiries, 1);
      assert.equal(report.current.completedEvents, 1);
      assert.equal(report.snapshot.upcomingEvents, 1);
      assert.equal(report.current.cancellations, 1);
      assert.equal(report.quality.currentAttributionComplete, true);
      assert.equal(report.trajectory.state, 'improving');
      assert.ok(Math.abs(conversionRate(report.current, true)! - 100 / 3) < 1e-12);
      assert.equal(conversionRate(report.current, false), null);
      assert.equal(conversionRate(emptyMeasures, true), null);
      const csv = analyticsCsv(report);
      assert.ok(csv.startsWith('\uFEFF'));
      assert.ok(csv.includes('"Cash income","1100","1000"'));
      assert.ok(csv.includes('"Pending balance","1100"'));
      assert.ok(csv.includes('"Inquiries with solid bookings","1","0"'));
      assert.ok(csv.includes(reportDates(report.range.current)));
      assert.ok(!csv.includes('@example.test'));
      assert.ok(!csv.includes('private'));
      const formulaReport = {
        ...report,
        range: { ...report.range, current: { ...report.range.current, label: '=test,"line"' } },
      };
      assert.ok(analyticsCsv(formulaReport).includes('"\'=test,""line"""'));
      assert.equal(
        report.buckets.reduce((sum, bucket) => sum + bucket.cashCents, 0),
        report.current.cashCents,
      );
      assert.ok(!JSON.stringify(report).includes('@example.test'));
      await booking(
        'overpaid',
        'CONFIRMED',
        '2026-11-10T00:00:00Z',
        '2026-11-25T00:00:00Z',
        10000,
        null,
        '2026-11-11T00:00:00Z',
      );
      await receipt('overpaid', 'overpaid', 15000, '2026-11-10T00:00:00Z');
      const overpaid = await readAnalyticsReport(params, now);
      assert.equal(overpaid.snapshot.overpaidBookings, 1);
      assert.equal(overpaid.snapshot.outstandingCents, 110000);
      assert.equal(
        overpaid.snapshot.paidOnSecuredCents + overpaid.snapshot.outstandingCents,
        overpaid.snapshot.securedContractCents,
      );
      await booking(
        'undated',
        'CONFIRMED',
        '2026-11-08T00:00:00Z',
        '2026-11-26T00:00:00Z',
        10000,
        undefined,
      );
      const limited = await readAnalyticsReport(params, now);
      assert.equal(limited.quality.currentAttributionComplete, false);
      assert.equal(limited.quality.confirmationHistoryComplete, false);
      assert.equal(limited.trajectory.state, 'limited');
      assert.equal(limited.current.convertedInquiries, 1);
      assert.equal(limited.snapshot.undatedConfirmations, 1);
    } finally {
      await prisma.$disconnect();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    }
  },
);
