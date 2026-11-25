import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';
import { manilaDateAfter } from '../booking-quote';
import type { WalkInOptions, WalkInPrefill, WalkInResult } from '../walk-in-types';

test(
  'walk-in bookings: website prices and rules, consent, cash now or later, review and visits',
  { timeout: 180000 },
  async () => {
    const db = new PGlite();
    await db.waitReady;
    const generated = execFileSync(
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
    await db.exec(generated.slice(generated.indexOf('-- CreateSchema')));
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
    const adminSql = readFileSync('prisma/admin.sql', 'utf8');
    await db.exec(adminSql.slice(adminSql.indexOf('-- Admin-only data')));
    for (const file of [
      'automation',
      'booking-holds',
      'payment-proofs',
      'payment-receipts',
      'visits',
    ])
      await db.exec(readFileSync(`prisma/${file}.sql`, 'utf8'));
    const server = createServer(db, { logLevel: LogLevel.Error });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${address.port}/postgres`;
    process.env.DATABASE_POOL_MAX = '1';
    process.env.AUTH_SECRET = randomBytes(32).toString('hex');
    process.env.NEXT_PUBLIC_APP_URL = 'https://zentra.example.test';
    for (const key of ['STAFF_NOTIFICATION_EMAIL', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM'])
      delete process.env[key];
    const { prisma } = await import('../prisma');
    const { adminMutate, adminRead } = await import('./service');
    const { getAdminPreferences } = await import('./preferences');
    const actor = {
      id: 'test-owner',
      email: 'owner@example.test',
      username: 'owner',
      fullName: 'Test Owner',
      profileImage: null,
      contactNumber: null,
      role: 'SUPERADMIN' as const,
      status: 'ACTIVE' as const,
      mustChangePassword: false,
      lastPasswordChangedAt: null,
    };
    try {
      await adminMutate(
        {
          op: 'settings',
          version: 1,
          reviewed: true,
          paymentRule: 'DEPOSIT_REQUIRED',
          cashInstructions: 'Pay the reservation fee in cash at Zion Events Place.',
          contractTerms: 'Venue reviewed terms and cash policy. '.repeat(10),
        },
        actor,
      );
      const category = (await adminMutate(
        {
          op: 'catalog-category',
          id: null,
          updatedAt: null,
          category: {
            name: 'Weddings',
            slug: 'weddings',
            description: 'Weddings at the venue.',
            coverImageUrl: '',
            displayOrder: 1,
            status: 'ACTIVE',
            clientVisible: true,
          },
        },
        actor,
      )) as unknown as { categoryId: string };
      await adminMutate(
        {
          op: 'catalog-package',
          id: null,
          updatedAt: null,
          package: {
            eventCategoryId: category.categoryId,
            packageName: 'Classic Wedding',
            slug: 'classic-wedding-walk-in',
            description: 'The classic package.',
            price: 150000,
            currency: 'PHP',
            paxIncluded: 100,
            excessPaxFee: 450,
            reservationFee: 5000,
            downPaymentAmount: 50000,
            fullPaymentAmount: 150000,
            checkInTime: '2 PM',
            checkOutTime: '10 PM',
            packageImageUrl: '',
            contractItemDescription: 'Wedding package',
            contractInclusionDescription: 'Tables and chairs',
            internalNotes: '',
            status: 'ACTIVE',
            clientVisible: true,
            inclusions: [
              {
                inclusionName: 'Tables and chairs',
                description: '',
                isFree: true,
                isOptional: false,
                displayOrder: 0,
              },
            ],
          },
        },
        actor,
      );

      const options = (await adminRead(
        'front-desk',
        new URLSearchParams({ 'walk-in': 'options' }),
        actor,
      )) as WalkInOptions;
      assert.equal(options.policy.reviewed, true);
      const weddings = options.categories.find((candidate) => candidate.slug === 'weddings');
      assert.ok(weddings?.packages[0], 'The published package is offered at the desk');
      const packageId = weddings.packages[0].id;
      assert.equal(options.earliest, manilaDateAfter(1));

      const day = (offset: number) => manilaDateAfter(offset);
      // Paper receipt numbers are unique, so every booking that pays gets its own.
      let receipt = 1000;
      const walkIn = (change: Record<string, unknown> = {}, event: Record<string, unknown> = {}) =>
        adminMutate(
          {
            op: 'walk-in-booking',
            client: {
              fullName: 'Ana Cruz',
              email: 'Ana.Cruz@Example.test',
              phone: '0917 555 0303',
            },
            event: {
              eventCategory: 'weddings',
              packageId,
              date: day(20),
              startTime: '14:00',
              endTime: '18:00',
              guests: 150,
              extras: ['Live entertainment'],
              notes: 'Prefers the garden.',
              ...event,
            },
            consent: 'ON_SCREEN',
            payment: {
              kind: 'CASH_NOW',
              amountCents: 500000,
              receiptNumber: `OR-${(receipt += 1)}`,
            },
            ...change,
          },
          actor,
        ) as Promise<WalkInResult>;

      // The same rules as the website: dates, times, guests and consent.
      await assert.rejects(walkIn({}, { date: day(0) }), /from tomorrow onward/);
      await assert.rejects(walkIn({}, { startTime: '18:00', endTime: '14:00' }), /one hour/);
      await assert.rejects(walkIn({}, { guests: 5 }), /at least 10/);
      await assert.rejects(walkIn({ consent: undefined }));
      await assert.rejects(
        walkIn({ payment: { kind: 'CASH_NOW', amountCents: 99999999, receiptNumber: 'OR-1' } }),
        /more than the total/,
      );

      // Cash that meets the reservation fee confirms the booking in one step.
      const confirmed = await walkIn();
      assert.equal(confirmed.outcome, 'CONFIRMED');
      assert.equal(confirmed.totalCents, 17250000, 'The website price: 150,000 + 50 x 450');
      assert.equal(confirmed.paidCents, 500000);
      assert.equal(confirmed.amountDueCents, 16750000);
      assert.equal(confirmed.holdExpiresAt, null);
      assert.ok(confirmed.receiptPath?.startsWith('/api/admin/receipts/'));
      const booking = await prisma.adminBooking.findUniqueOrThrow({
        where: { id: confirmed.id },
        include: { payments: true },
      });
      assert.equal(booking.email, 'ana.cruz@example.test');
      assert.equal(booking.approval, 'APPROVED');
      assert.equal(booking.reservation, 'CONFIRMED');
      assert.equal(booking.verification, 'VERIFIED');
      assert.equal(booking.createdBy, actor.id);
      assert.equal(booking.eventType, 'Weddings');
      assert.equal(booking.packageName, 'Classic Wedding');
      assert.match(booking.notes, /Consent: the client agreed on this screen/);
      assert.match(booking.notes, /Asked about: Live entertainment\./);
      assert.match(booking.payments[0].acknowledgmentNumber ?? '', /^ACK-\d{4}-\d{6}$/);
      const created = await prisma.auditLog.findFirstOrThrow({
        where: {
          module: 'Bookings',
          action: 'CREATE',
          metadata: { path: ['bookingId'], equals: booking.id },
        },
      });
      assert.match(created.description, /confirmed with the payment received/);
      assert.deepEqual(
        {
          channel: (created.metadata as Record<string, unknown>).channel,
          consentMethod: (created.metadata as Record<string, unknown>).consentMethod,
          sourceInquiryId: (created.metadata as Record<string, unknown>).sourceInquiryId,
        },
        { channel: 'walk-in', consentMethod: 'ON_SCREEN', sourceInquiryId: null },
      );
      const events = await prisma.adminOutbox.findMany({
        where: { bookingId: booking.id },
        select: { event: true, calendarMethod: true, body: true },
      });
      assert.deepEqual(events.map((row) => row.event).sort(), [
        'CASH_RECEIPT',
        'RESERVATION_CONFIRMED',
      ]);
      assert.equal(
        events.find((row) => row.event === 'RESERVATION_CONFIRMED')?.calendarMethod,
        'REQUEST',
      );

      // The time is now taken for everyone.
      await assert.rejects(walkIn(), (error: { status?: number }) => error.status === 409);
      // A receipt number already recorded is refused and nothing is saved.
      const before = await prisma.adminBooking.count();
      await assert.rejects(
        walkIn(
          {
            payment: {
              kind: 'CASH_NOW',
              amountCents: 500000,
              receiptNumber: booking.payments[0].receiptNumber,
            },
          },
          { date: day(25) },
        ),
      );
      assert.equal(await prisma.adminBooking.count(), before);

      // Pay later: the date is held until the payment deadline.
      const held = await walkIn({ payment: { kind: 'LATER', method: 'GCASH' } }, { date: day(30) });
      assert.equal(held.outcome, 'HELD');
      assert.equal(held.amountDueCents, 500000);
      assert.ok(held.holdExpiresAt && Date.parse(held.holdExpiresAt) > Date.now());
      assert.ok(held.paymentPath?.startsWith('/booking/pay/'));
      const heldBooking = await prisma.adminBooking.findUniqueOrThrow({ where: { id: held.id } });
      assert.match(heldBooking.notes, /Preferred payment: GCash\./);
      assert.deepEqual(
        (await prisma.adminOutbox.findMany({ where: { bookingId: held.id } })).map(
          (row) => row.event,
        ),
        ['REQUEST_APPROVED'],
      );

      // Part of the fee now: still held, and the email asks for the rest.
      const partial = await walkIn(
        { payment: { kind: 'CASH_NOW', amountCents: 200000, receiptNumber: 'OR-1002' } },
        { date: day(40) },
      );
      assert.equal(partial.outcome, 'HELD');
      assert.equal(partial.amountDueCents, 300000);
      const approvedEmail = await prisma.adminOutbox.findFirstOrThrow({
        where: { bookingId: partial.id, event: 'REQUEST_APPROVED' },
      });
      assert.match(approvedEmail.body, /reservation fee of ₱3,000\.00/);
      assert.ok(
        await prisma.adminOutbox.findFirst({
          where: { bookingId: partial.id, event: 'CASH_RECEIPT' },
        }),
      );

      // A custom proposal waits for review and takes no payment yet.
      await assert.rejects(walkIn({}, { packageId: null, date: day(50) }), /decision on Bookings/);
      const custom = await walkIn(
        { payment: { kind: 'LATER', method: 'CASH' } },
        { packageId: null, date: day(50) },
      );
      assert.equal(custom.outcome, 'REVIEW');
      assert.deepEqual(custom.reviewReasons, ['custom proposal: Zion needs to quote a price']);
      assert.equal(custom.paymentPath, null);

      // Above the guest limit: review, unless staff approve at the desk with a reason.
      const preferences = await getAdminPreferences();
      await adminMutate(
        {
          op: 'preferences',
          settings: {
            ...preferences.settings,
            admin: {
              ...preferences.settings.admin,
              bookingRules: { ...preferences.settings.admin.bookingRules, reviewGuestLimit: 120 },
            },
          },
          updatedAt: preferences.updatedAt,
        },
        actor,
      );
      const later = { payment: { kind: 'LATER', method: 'CASH' } };
      const large = await walkIn(later, { date: day(60) });
      assert.equal(large.outcome, 'REVIEW');
      assert.deepEqual(large.reviewReasons, ['more than 120 guests']);
      await assert.rejects(
        walkIn({ overrideReason: 'ok' }, { date: day(61) }),
        /at least 5 characters/,
      );
      const approvedAtDesk = await walkIn(
        { overrideReason: 'Owner approved 150 guests.' },
        { date: day(62) },
      );
      assert.equal(approvedAtDesk.outcome, 'CONFIRMED');
      const approval = await prisma.auditLog.findFirstOrThrow({
        where: { action: 'APPROVAL', metadata: { path: ['bookingId'], equals: approvedAtDesk.id } },
      });
      assert.match(
        approval.description,
        /despite more than 120 guests: Owner approved 150 guests\./,
      );

      // From an ocular visit: the details carry over, and a checked-in visit is completed.
      const visit = await prisma.adminVisit.create({
        data: {
          reference: 'VIS-TEST-WALKIN',
          clientName: 'Ben Lim',
          email: 'ben@example.test',
          phone: '0917 555 0404',
          startsAt: new Date(Date.now() - 30 * 60_000),
          endsAt: new Date(Date.now() + 30 * 60_000),
          status: 'CHECKED_IN',
          source: 'STAFF',
          eventType: 'Weddings',
          guests: 90,
        },
      });
      const prefill = (await adminRead(
        'front-desk',
        new URLSearchParams({ 'walk-in': 'prefill', visit: visit.id }),
        actor,
      )) as WalkInPrefill;
      assert.deepEqual(
        {
          name: prefill.clientName,
          type: prefill.eventType,
          guests: prefill.guests,
          id: prefill.visitId,
        },
        { name: 'Ben Lim', type: 'Weddings', guests: 90, id: visit.id },
      );
      const fromVisit = await walkIn(
        {
          client: { fullName: 'Ben Lim', email: 'ben@example.test', phone: '0917 555 0404' },
          consent: 'PRINTED_FORM',
          sourceVisitId: visit.id,
        },
        { date: day(70), guests: 90 },
      );
      assert.equal(fromVisit.outcome, 'CONFIRMED');
      const completed = await prisma.adminVisit.findUniqueOrThrow({ where: { id: visit.id } });
      assert.equal(completed.status, 'COMPLETED');
      assert.match(
        completed.staffNotes,
        new RegExp(`Booked ${fromVisit.reference} at the front desk`),
      );
      const again = (await adminRead(
        'front-desk',
        new URLSearchParams({ 'walk-in': 'prefill', booking: fromVisit.id }),
        actor,
      )) as WalkInPrefill;
      assert.equal(again.source, 'booking');
      assert.equal(again.reference, fromVisit.reference);
    } finally {
      await prisma.$disconnect();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    }
  },
);
