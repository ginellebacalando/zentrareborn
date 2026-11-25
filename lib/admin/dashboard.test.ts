import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';
import { chartMaximum, donutWedgePath, smoothLinePath } from './dashboard-chart-math';

test('chart geometry handles empty, single-slice, and large-value domains', () => {
  for (const value of [0, 1, 4, 5, 100, 9999, 2000000000]) {
    assert.ok(chartMaximum([value]) >= value);
    assert.equal(chartMaximum([value]) % 4, 0);
  }
  for (const end of [0.001, Math.PI, Math.PI * 2]) {
    const path = donutWedgePath(0, end);
    assert.ok(!/NaN|Infinity/.test(path));
    assert.match(path, /A126,80/);
    assert.match(path, /A76,48/);
  }
});

test('smooth chart lines stay within each pair of values (no overshoot)', () => {
  const points = [0, 0, 5, 5, 2, 9].map((value, index) => ({ x: index * 20, y: 30 - value * 3 }));
  const path = smoothLinePath(points);
  assert.ok(!/NaN|Infinity/.test(path));
  const segments = path.split(' C').slice(1);
  assert.equal(segments.length, points.length - 1);
  segments.forEach((segment, index) => {
    const [, c1y, , c2y] = segment.split(' ').map(Number);
    const low = Math.min(points[index].y, points[index + 1].y);
    const high = Math.max(points[index].y, points[index + 1].y);
    for (const y of [c1y, c2y]) assert.ok(y >= low - 1e-9 && y <= high + 1e-9, `segment ${index}`);
  });
  assert.equal(smoothLinePath([]), '');
  assert.equal(smoothLinePath([{ x: 4, y: 8 }]), 'M4 8');
});

test(
  'dashboard reports preserve Manila boundaries, secured sales, inquiry states, dated cohorts and receipts',
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
    const { readDashboardInsights } = await import('./dashboard');
    const { readDashboardKpis } = await import('./dashboard-kpis');
    const now = new Date('2026-11-19T04:00:00Z');
    try {
      await prisma.$executeRawUnsafe("SET TIME ZONE 'Asia/Manila'");
      const empty = await readDashboardInsights(now);
      assert.equal(empty.months.length, 12);
      assert.equal(empty.months[0].key, '2025-12');
      assert.equal(empty.months.at(-1)!.key, '2026-11');
      assert.ok(
        empty.months.every((month) => !month.bookings && !month.inquiries && !month.cashCents),
      );
      assert.ok(empty.reservations.every((slice) => slice.count === 0));
      const dates = [
        ['outside', '2025-11-30T15:59:59.999Z', 'REQUESTED'],
        ['boundary', '2025-11-30T16:00:00Z', 'REQUESTED'],
        ['current', '2026-11-19T00:00:00Z', 'CONFIRMED'],
        ['future', '2026-11-20T00:00:00Z', 'CANCELLED'],
      ];
      for (const [id, date, reservation] of dates) {
        await prisma.adminBooking.create({
          data: {
            id,
            reference: `CHART-${id}`,
            clientName: 'Private test client',
            email: `${id}@example.test`,
            phone: '0000000000',
            eventType: 'Wedding',
            packageName: 'Test package',
            venue: 'Test venue',
            startsAt: now,
            endsAt: new Date(now.getTime() + 3600000),
            guests: 20,
            totalCents: 100000,
            depositCents: 10000,
            paymentRule: 'DEPOSIT_REQUIRED',
            policyVersion: 1,
            createdBy: 'qa-owner',
            updatedBy: 'qa-owner',
            createdAt: new Date(date),
            reservation,
          },
        });
      }
      for (const [id, date] of dates) {
        await prisma.inquiry.create({
          data: {
            inquiryReference: `CHART-INQ-${id}`,
            fullName: 'Private test visitor',
            email: `${id}@example.test`,
            message: 'Test inquiry',
            submittedAt: new Date(date),
          },
        });
      }
      for (const [id, date, amount, voided] of [
        ['boundary', dates[1][1], 12345, false],
        ['current', dates[2][1], 23456, false],
        ['future', dates[3][1], 50000, false],
        ['voided', dates[2][1], 100000, true],
      ] as const) {
        await prisma.adminCashPayment.create({
          data: {
            bookingId: 'boundary',
            receiptNumber: `CHART-RCT-${id}`,
            amountCents: amount,
            receivedAt: new Date(date),
            recordedBy: 'qa-owner',
            voidedAt: voided ? now : null,
          },
        });
      }
      const result = await readDashboardInsights(now);
      assert.equal(result.months[0].bookings, 1);
      assert.equal(result.months[0].inquiries, 1);
      assert.equal(result.months[0].cashCents, 12345);
      assert.ok(
        result.months.slice(1, -1).every((month) => month.bookings === 0 && month.cashCents === 0),
      );
      assert.equal(result.months.at(-1)!.bookings, 1);
      assert.equal(result.months.at(-1)!.inquiries, 1);
      assert.equal(result.months.at(-1)!.cashCents, 23456);
      assert.deepEqual(
        result.reservations.map((slice) => [slice.key, slice.count]),
        [
          ['REQUESTED', 2],
          ['CONFIRMED', 1],
          ['COMPLETED', 0],
          ['CANCELLED', 1],
        ],
      );
      assert.equal(result.timezone, 'Asia/Manila');
      assert.equal(result.generatedAt, now.toISOString());
      assert.ok(!JSON.stringify(result).includes('@example.test'));

      // A separate isolated fixture verifies the new business definitions rather
      // than relying on chart counts or changing any real venue records.
      await prisma.adminCashPayment.deleteMany();
      await prisma.adminBooking.deleteMany();
      await prisma.inquiry.deleteMany();
      const noKpis = await readDashboardKpis(now);
      assert.equal(noKpis.sales.value, 0);
      assert.equal(noKpis.pending.value, 0);
      assert.equal(noKpis.upcoming.value, 0);
      assert.equal(noKpis.bookings.value, 0);
      const inquiry = async (
        id: string,
        date: string,
        status: 'NEW' | 'ANSWERED' | 'FOLLOW_UP' | 'CLOSED' | 'SPAM' = 'NEW',
      ) =>
        prisma.inquiry.create({
          data: {
            id,
            inquiryReference: id,
            fullName: 'Private KPI visitor',
            email: `${id}@example.test`,
            message: 'Test only',
            submittedAt: new Date(date),
            status,
          },
        });
      for (const [id, date, status] of [
        ['open-current', '2026-03-01', 'NEW'],
        ['open-answered', '2026-04-01', 'ANSWERED'],
        ['open-follow', '2026-05-01', 'FOLLOW_UP'],
        ['secured-inquiry', '2026-02-01', 'NEW'],
        ['closed-inquiry', '2026-02-01', 'CLOSED'],
        ['spam-inquiry', '2026-02-01', 'SPAM'],
        ['prior-open', '2025-03-01', 'NEW'],
        ['cancel-link', '2026-02-01', 'NEW'],
        ['future-inquiry', '2026-11-20', 'NEW'],
      ] as const)
        await inquiry(id, date, status);
      const kpiBooking = async (
        id: string,
        reservation: string,
        confirmation: string | null,
        eventOffsetDays: number,
        total: number,
        source: string | null,
        created = '2025-01-01T00:00:00Z',
      ) => {
        await prisma.adminBooking.create({
          data: {
            id,
            reference: id,
            clientName: 'Private KPI client',
            email: `${id}@example.test`,
            phone: '0000000000',
            eventType: 'Wedding',
            packageName: 'Test package',
            venue: 'Test venue',
            startsAt: new Date(now.getTime() + eventOffsetDays * 86400000),
            endsAt: new Date(now.getTime() + eventOffsetDays * 86400000 + 3600000),
            guests: 20,
            totalCents: total,
            depositCents: 1000,
            paymentRule: 'DEPOSIT_REQUIRED',
            policyVersion: 1,
            createdBy: 'qa',
            updatedBy: 'qa',
            createdAt: new Date(created),
            approval: reservation === 'REQUESTED' ? 'PENDING' : 'APPROVED',
            reservation,
          },
        });
        await prisma.auditLog.create({
          data: {
            timestamp: new Date(created),
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
              recipient: 'test@example.test',
              subject: 'Test only',
              body: 'Test only',
              createdAt: new Date(confirmation),
            },
          });
      };
      await kpiBooking(
        'annual-a',
        'CONFIRMED',
        '2026-02-15T00:00:00Z',
        1,
        2_000_000,
        'secured-inquiry',
      );
      await kpiBooking(
        'annual-b',
        'COMPLETED',
        '2026-03-15T00:00:00Z',
        -1,
        3_000_000,
        'secured-inquiry',
      );
      await kpiBooking('prior-year', 'COMPLETED', '2025-02-15T00:00:00Z', -10, 1_000_000, null);
      await kpiBooking(
        'outside-prior-ytd',
        'CONFIRMED',
        '2025-12-01T00:00:00Z',
        45,
        4_000_000,
        null,
      );
      await kpiBooking(
        'cancelled',
        'CANCELLED',
        '2026-02-20T00:00:00Z',
        10,
        9_000_000,
        'cancel-link',
      );
      await kpiBooking('requested', 'REQUESTED', null, 3, 9_000_000, null);
      await kpiBooking(
        'future-created',
        'CONFIRMED',
        '2026-11-20T00:00:00Z',
        2,
        9_000_000,
        null,
        '2026-11-20T00:00:00Z',
      );
      await kpiBooking('year-boundary', 'CONFIRMED', '2025-12-31T16:00:00Z', 5, 500_000, null);
      // Retries must not multiply contracts, bookings or linked inquiries.
      await prisma.adminOutbox.create({
        data: {
          bookingId: 'annual-a',
          event: 'RESERVATION_CONFIRMED',
          recipient: 'test@example.test',
          subject: 'Retry',
          body: 'Retry',
          createdAt: now,
        },
      });
      const kpis = await readDashboardKpis(now);
      assert.equal(kpis.year, 2026);
      assert.equal(kpis.annual.current.start, '2025-12-31T16:00:00.000Z');
      assert.equal(kpis.annual.comparison.through, '2025-11-19T04:00:00.001Z');
      assert.deepEqual(kpis.sales, { value: 5_500_000, current: 5_500_000, previous: 1_000_000 });
      assert.deepEqual(kpis.pending, { value: 5, current: 4, previous: 1 });
      assert.deepEqual(kpis.upcoming, { value: 3, current: 2, previous: 2 });
      assert.deepEqual(kpis.bookings, { value: 5, current: 3, previous: 1 });
      assert.deepEqual(kpis.quality, { undatedSecuredBookings: 0, untrackedSecuredBookings: 0 });
      assert.ok(!JSON.stringify(kpis).includes('@example.test'));
      // Unknown history remains explicit; no email/note-based conversion inference.
      await kpiBooking('legacy-undated', 'CONFIRMED', null, 7, 700_000, null);
      await prisma.auditLog.deleteMany({
        where: { metadata: { path: ['bookingId'], equals: 'legacy-undated' } },
      });
      const limited = await readDashboardKpis(now);
      assert.equal(limited.quality.undatedSecuredBookings, 1);
      assert.equal(limited.quality.untrackedSecuredBookings, 1);
      assert.equal(limited.sales.value, 5_500_000);
      assert.equal(limited.bookings.value, 6);
      await prisma.adminBooking.update({
        where: { id: 'prior-year' },
        data: { totalCents: 10_000_000 },
      });
      const declining = await readDashboardKpis(now);
      assert.ok(declining.sales.current < declining.sales.previous);
    } finally {
      await prisma.$disconnect();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    }
  },
);
