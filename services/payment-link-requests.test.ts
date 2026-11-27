import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';

/**
 * "Find my payment page" (docs/booking-automation.md): the link goes only to the booking's own
 * email, only when the reference and email match, within the limits, and the answer never says
 * whether anything matched.
 */
process.env.AUTH_SECRET ??= 'test-only-secret-for-payment-link-requests-0123456789';
process.env.NEXT_PUBLIC_APP_URL = 'https://zion.example.test';

const MINUTE_MS = 60_000;

test(
  'payment page links: matching, limits, the email and a missing site address',
  { timeout: 180000 },
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
    await db.exec(readFileSync('prisma/automation.sql', 'utf8'));
    const server = createServer(db, { logLevel: LogLevel.Error });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${address.port}/postgres`;
    process.env.DATABASE_POOL_MAX = '1';
    const { prisma } = await import('../lib/prisma');
    const { paymentLinkToken } = await import('../lib/payment-link');
    const { PAYMENT_LINK_EVENT, PaymentLinkError, requestPaymentLink } =
      await import('./payment-link-requests');
    const start = new Date('2026-11-27T02:00:00Z');
    const at = (minutes: number) => new Date(start.getTime() + minutes * MINUTE_MS);
    const ask = (input: Record<string, string>, minutes = 0) =>
      requestPaymentLink(input, at(minutes)).then((result) => result.notificationIds);
    const rows = () =>
      prisma.adminOutbox.findMany({
        where: { event: PAYMENT_LINK_EVENT },
        orderBy: { createdAt: 'asc' },
      });
    try {
      const booking = await prisma.adminBooking.create({
        data: {
          reference: 'ZION-2026-AB12CD34',
          clientName: 'Maria Santos',
          email: 'client@example.test',
          phone: '09170000000',
          eventType: 'Wedding',
          packageName: 'Zion Classic',
          venue: 'Garden Pavilion',
          startsAt: new Date('2027-02-14T08:00:00Z'),
          endsAt: new Date('2027-02-14T12:00:00Z'),
          guests: 80,
          totalCents: 10_000_000,
          depositCents: 3_000_000,
          paymentRule: 'DEPOSIT_REQUIRED',
          policyVersion: 1,
          createdBy: 'qa',
          updatedBy: 'qa',
        },
      });

      await assert.rejects(
        requestPaymentLink({ reference: 'zion', email: 'client@example.test' }, start),
        (error: unknown) => error instanceof PaymentLinkError && error.status === 400,
      );
      // Nothing matches, or a bot filled the hidden field: the same answer, and nothing is sent.
      assert.deepEqual(
        await ask({ reference: 'ZION-2026-AB12CD34', email: 'other@example.test' }),
        [],
      );
      assert.deepEqual(
        await ask({ reference: 'ZION-2026-00000000', email: 'client@example.test' }),
        [],
      );
      assert.deepEqual(
        await ask({
          reference: 'ZION-2026-AB12CD34',
          email: 'client@example.test',
          website: 'https://spam.example',
        }),
        [],
      );
      assert.equal((await rows()).length, 0);

      // Spaces and case are forgiven; the link goes to the address on the booking.
      const sent = await ask({ reference: ' zion-2026-ab12cd34 ', email: 'CLIENT@Example.TEST' });
      assert.equal(sent.length, 1);
      const [first] = await rows();
      assert.equal(first.status, 'QUEUED');
      assert.equal(first.recipient, 'client@example.test');
      assert.equal(first.bookingId, booking.id);
      assert.match(first.subject, /Your payment page \| ZION-2026-AB12CD34/);
      assert.ok(
        first.html?.includes(
          `https://zion.example.test/booking/pay/${paymentLinkToken(booking.id)}`,
        ),
        'the email links the booking’s own payment page',
      );
      assert.match(first.body, /Keep this link to yourself/);

      // Asked again within 10 minutes: nothing new is sent or stored.
      assert.deepEqual(
        await ask({ reference: 'ZION-2026-AB12CD34', email: 'client@example.test' }, 5),
        [],
      );
      assert.equal((await rows()).length, 1);
      // Then once every 10 minutes, at most five times a day.
      for (const minutes of [11, 22, 33, 44])
        assert.equal(
          (await ask({ reference: 'ZION-2026-AB12CD34', email: 'client@example.test' }, minutes))
            .length,
          1,
        );
      assert.deepEqual(
        await ask({ reference: 'ZION-2026-AB12CD34', email: 'client@example.test' }, 55),
        [],
      );
      assert.equal((await rows()).length, 5);
      assert.equal(
        (await ask({ reference: 'ZION-2026-AB12CD34', email: 'client@example.test' }, 25 * 60))
          .length,
        1,
      );

      // Without the site's address no link can be built: nothing is sent, and staff see why.
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      try {
        assert.deepEqual(
          await ask({ reference: 'ZION-2026-AB12CD34', email: 'client@example.test' }, 26 * 60),
          [],
        );
        const skipped = (await rows()).at(-1);
        assert.equal(skipped?.status, 'EXPIRED');
        assert.match(skipped?.lastError ?? '', /site address/);
      } finally {
        process.env.NEXT_PUBLIC_APP_URL = appUrl;
      }

      // Many requests for any bookings within an hour: the form asks to try again later.
      await prisma.adminOutbox.createMany({
        data: Array.from({ length: 60 }, (_, index) => ({
          event: PAYMENT_LINK_EVENT,
          recipient: `someone${index}@example.test`,
          subject: 'Your payment page',
          body: 'Link',
          createdAt: at(30 * 60),
        })),
      });
      await assert.rejects(
        requestPaymentLink(
          { reference: 'ZION-2026-AB12CD34', email: 'client@example.test' },
          at(30 * 60 + 1),
        ),
        (error: unknown) => error instanceof PaymentLinkError && error.status === 429,
      );
    } finally {
      await prisma.$disconnect();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    }
  },
);
