import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';
import { DEFAULT_VISIT_RULES, manilaDateKey } from '../visit-rules';
import type { CalendarVisit, ClientLookup, FrontDeskAgenda, FrontDeskSlots } from '../visit-types';
import type { WalkInPrefill } from '../walk-in-types';
import type { MailTransport, OutgoingMail } from '../automation/transport';

const DAY_MS = 86_400_000;
const addDays = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://zentra.example.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

test(
  'ocular visits: website scheduling, manage link, emails, reminders, front desk and digest',
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
      // Re-running the visit installer must be harmless.
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
    const { getAdminPreferences, readVisitRules } = await import('./preferences');
    const { readVisitAvailability } = await import('../visits');
    const { visitManageToken } = await import('../visit-link');
    const { scheduleVisitReminders, visitJobIrrelevance } = await import('../automation/visits');
    const { scheduleDailyDigest } = await import('../automation/scheduler');
    const { processDueJobs } = await import('../automation/processor');
    const { scheduleWebsiteVisit, readVisitManagePage, manageWebsiteVisit } =
      await import('../../services/visits');
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
    const jobsFor = (visitId: string) =>
      prisma.adminOutbox.findMany({
        where: { idempotencyKey: { startsWith: `visit:${visitId}:` } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
    const job = async (visitId: string, kind: string, revision: number) =>
      prisma.adminOutbox.findUniqueOrThrow({
        where: { idempotencyKey: `visit:${visitId}:${kind}:r${revision}` },
      });
    try {
      const rls = await db.query<{ relrowsecurity: boolean }>(
        "SELECT relrowsecurity FROM pg_class WHERE relname = 'zion_visits'",
      );
      assert.equal(rls.rows[0]?.relrowsecurity, true, 'Visitor details are closed to the Data API');
      await assert.rejects(
        db.query(
          `INSERT INTO zion_visits (id, reference, "clientName", email, phone, "startsAt", "endsAt", status, "updatedAt")
           VALUES ('bad', 'VIS-BAD', 'x', '', '1', now(), now() + interval '1 hour', 'BOGUS', now())`,
        ),
        /visit_rules/,
      );

      // Settings: the defaults until saved, a checked set of rules, and the staff inbox.
      const preferences = await getAdminPreferences();
      assert.deepEqual(preferences.settings.admin.visitRules, DEFAULT_VISIT_RULES);
      const withRules = (visitRules: unknown) => ({
        op: 'preferences',
        settings: {
          ...preferences.settings,
          admin: {
            ...preferences.settings.admin,
            staffNotifications: { emails: ['desk@example.test'] },
            visitRules,
          },
        },
        updatedAt: preferences.updatedAt,
      });
      await assert.rejects(
        adminMutate(withRules({ ...DEFAULT_VISIT_RULES, slotMinutes: 50 }), actor),
      );
      await adminMutate(withRules({ ...DEFAULT_VISIT_RULES, closedDates: ['2099-12-25'] }), actor);
      assert.deepEqual((await readVisitRules()).closedDates, ['2099-12-25']);
      const settingsAudit = await prisma.auditLog.findFirstOrThrow({
        where: { module: 'Settings' },
        orderBy: { timestamp: 'desc' },
      });
      assert.match(settingsAudit.description, /Visit hours or rules changed\./);

      // The website: an open time, checked details, and one upcoming visit per email.
      const { days } = await readVisitAvailability();
      const day = days.find((candidate) => candidate.slots.length >= 3);
      assert.ok(day, 'The default hours offer several times within the booking window');
      const [first, second, third] = day.slots;
      const visitor = {
        startsAt: first.startsAt,
        fullName: 'Maria Santos',
        email: 'Maria@Example.test',
        phone: '0917 555 0101',
        eventType: 'Wedding',
        eventDate: '',
        guests: 120,
        message: 'We would like to see the garden.',
        consent: true,
        fromZeni: true,
      };
      const path = '/api/client/visits';
      await assert.rejects(
        scheduleWebsiteVisit(post(path, visitor, { 'sec-fetch-site': 'cross-site' })),
        (error: { status?: number }) => error.status === 403,
      );
      await assert.rejects(
        scheduleWebsiteVisit(post(path, { ...visitor, website: 'https://spam.example' })),
        /check the visit details/,
      );
      await assert.rejects(
        scheduleWebsiteVisit(post(path, { ...visitor, consent: false })),
        /privacy notice/,
      );
      const { result, notificationIds } = await scheduleWebsiteVisit(post(path, visitor));
      assert.match(result.reference, /^VIS-\d{4}-[0-9A-F]{8}$/);
      assert.ok(result.managePath?.startsWith('/visit/manage/'));
      assert.equal(result.emailed, true);
      assert.equal(notificationIds.length, 2);
      const visit = await prisma.adminVisit.findUniqueOrThrow({
        where: { reference: result.reference },
      });
      assert.equal(visit.email, 'maria@example.test');
      assert.equal(visit.source, 'ZENI');
      assert.equal(visit.status, 'SCHEDULED');
      assert.ok(visit.consentAt, 'The visitor agreed to the privacy notice');
      const confirmation = await job(visit.id, 'scheduled', 1);
      assert.equal(confirmation.event, 'VISIT_SCHEDULED');
      assert.equal(confirmation.recipient, 'maria@example.test');
      assert.equal(confirmation.calendarMethod, 'REQUEST');
      assert.match(
        confirmation.calendar ?? '',
        new RegExp(`UID:visit-${visit.id}@zion-events-place`),
      );
      assert.match(confirmation.calendar ?? '', /SEQUENCE:1\r\n/);
      assert.match(
        confirmation.body,
        /Reschedule or cancel: https:\/\/zentra\.example\.test\/visit\/manage\//,
      );
      const staffCopy = await job(visit.id, 'staff', 1);
      assert.equal(staffCopy.event, 'VISIT_STAFF_CALENDAR');
      assert.equal(staffCopy.recipient, 'desk@example.test');
      assert.equal(staffCopy.replyTo, 'maria@example.test');
      assert.match(
        staffCopy.body,
        /Maria Santos scheduled an ocular visit on the visit page, opened from Zeni\./,
      );
      await assert.rejects(
        scheduleWebsiteVisit(post(path, { ...visitor, startsAt: second.startsAt })),
        /already has an upcoming visit/,
      );
      // With one visit per time, a second visitor cannot take the same time.
      await assert.rejects(
        scheduleWebsiteVisit(post(path, { ...visitor, email: 'other@example.test' })),
        (error: { status?: number; code?: string }) =>
          error.status === 409 && error.code === 'TIME_TAKEN',
      );
      const offered = async (startsAt: string) =>
        (await readVisitAvailability()).days.some((candidate) =>
          candidate.slots.some((slot) => slot.startsAt === startsAt),
        );
      assert.equal(await offered(first.startsAt), false);
      // An event at the venue blocks the visit times it overlaps.
      await prisma.adminBooking.create({
        data: {
          reference: 'ZION-TEST-EVENT',
          clientName: 'Event Client',
          email: 'event@example.test',
          phone: '0917 000 0000',
          eventType: 'Wedding',
          packageName: 'Test package',
          venue: 'Zion Events Place',
          startsAt: new Date(third.startsAt),
          endsAt: new Date(third.endsAt),
          guests: 100,
          totalCents: 100000,
          depositCents: 10000,
          paymentRule: 'DEPOSIT_REQUIRED',
          approval: 'APPROVED',
          reservation: 'CONFIRMED',
          policyVersion: 1,
          createdBy: 'test',
          updatedBy: 'test',
        },
      });
      assert.equal(await offered(third.startsAt), false);

      // The private manage link: its own visit only, and changes checked against the revision.
      const token = visitManageToken(visit.id);
      assert.deepEqual(await readVisitManagePage(`${visit.id}.forged-signature-value`), {
        state: 'invalid',
      });
      const view = await readVisitManagePage(token);
      assert.equal(view.state, 'open');
      assert.ok(view.state === 'open' && view.firstName === 'Maria' && view.revision === 1);
      const managePath = '/api/client/visits/manage';
      const moved = await manageWebsiteVisit(
        post(managePath, { action: 'reschedule', token, revision: 1, startsAt: second.startsAt }),
      );
      assert.equal(moved.result.startsAt, second.startsAt);
      await assert.rejects(
        manageWebsiteVisit(
          post(managePath, { action: 'reschedule', token, revision: 1, startsAt: first.startsAt }),
        ),
        /changed in the meantime/,
      );
      assert.equal(await offered(first.startsAt), true, 'The earlier time opens again');
      // The unsent emails of the first time are retired; the new time goes out with SEQUENCE 2.
      for (const kind of ['scheduled', 'staff']) {
        const retired = await job(visit.id, kind, 1);
        assert.equal(retired.status, 'EXPIRED');
        assert.match(retired.lastError ?? '', /moved to a new time/);
      }
      const update = await job(visit.id, 'rescheduled', 2);
      assert.equal(update.event, 'VISIT_RESCHEDULED');
      assert.match(update.calendar ?? '', /SEQUENCE:2\r\n/);
      assert.equal((await job(visit.id, 'staff', 2)).recipient, 'desk@example.test');

      // Delivery through the mail transport.
      process.env.SMTP_USER = 'venue@example.test';
      process.env.SMTP_PASSWORD = 'abcd efgh ijkl mnop';
      process.env.MAIL_FROM = 'Zion Events Place <venue@example.test>';
      const sent: OutgoingMail[] = [];
      const transport: MailTransport = {
        async send(message) {
          sent.push(message);
          return { accepted: message.to.split(',').map((part) => part.trim()), rejected: [] };
        },
        close() {},
      };
      const delivered = await processDueJobs({ transport });
      assert.equal(delivered.sent, 2);
      assert.deepEqual(sent.map((message) => message.calendar?.method).sort(), [
        'REQUEST',
        'REQUEST',
      ]);

      // Reminders: the day before and on the morning, once each, unless booked hours before.
      const visitDay = manilaDateKey(new Date(second.startsAt));
      const dayBefore = new Date(`${addDays(visitDay, -1)}T08:00:00+08:00`);
      const morning = new Date(`${visitDay}T07:30:00+08:00`);
      await prisma.adminVisit.update({
        where: { id: visit.id },
        data: { scheduledAt: new Date(dayBefore.getTime() - 2 * 3_600_000) },
      });
      assert.equal(await scheduleVisitReminders(dayBefore), 0, 'Booked two hours before');
      await prisma.adminVisit.update({
        where: { id: visit.id },
        data: { scheduledAt: new Date(dayBefore.getTime() - 3 * DAY_MS) },
      });
      assert.equal(
        await scheduleVisitReminders(new Date(`${addDays(visitDay, -1)}T06:00:00+08:00`)),
        0,
      );
      assert.equal(await scheduleVisitReminders(dayBefore), 1);
      assert.equal(await scheduleVisitReminders(dayBefore), 0, 'Prepared once');
      assert.equal(await scheduleVisitReminders(morning), 1);
      const dayReminder = await job(visit.id, 'reminder-day', 2);
      assert.equal(dayReminder.event, 'VISIT_REMINDER_1D');
      assert.equal(
        dayReminder.expiresAt?.toISOString(),
        new Date(`${visitDay}T00:00:00+08:00`).toISOString(),
      );
      assert.match(dayReminder.subject, /Visit reminder/);
      const morningReminder = await job(visit.id, 'reminder-today', 2);
      assert.equal(morningReminder.event, 'VISIT_REMINDER_TODAY');
      assert.equal(await visitJobIrrelevance(morningReminder, morning), null);

      // The visitor cancels: one cancellation for the visitor and for the calendars that hold it.
      await manageWebsiteVisit(post(managePath, { action: 'cancel', token, revision: 2 }));
      const cancelled = await prisma.adminVisit.findUniqueOrThrow({ where: { id: visit.id } });
      assert.equal(cancelled.status, 'CANCELLED');
      assert.equal(cancelled.revision, 3);
      assert.ok(cancelled.cancelledAt);
      const cancellation = await job(visit.id, 'cancelled', 3);
      assert.equal(cancellation.event, 'VISIT_CANCELLED');
      assert.equal(cancellation.calendarMethod, 'CANCEL');
      assert.match(cancellation.calendar ?? '', /SEQUENCE:3\r\n/);
      const staffCancel = await job(visit.id, 'staff', 3);
      assert.equal(staffCancel.event, 'VISIT_STAFF_CANCEL');
      assert.equal(staffCancel.recipient, 'desk@example.test');
      for (const reminder of [dayReminder, morningReminder]) {
        const after = await prisma.adminOutbox.findUniqueOrThrow({ where: { id: reminder.id } });
        assert.equal(after.status, 'EXPIRED');
        assert.match(after.lastError ?? '', /cancelled/);
        assert.match((await visitJobIrrelevance(after, morning)) ?? '', /moved, was cancelled/);
      }
      const closed = await readVisitManagePage(token);
      assert.ok(closed.state === 'closed' && closed.status === 'CANCELLED');
      await assert.rejects(
        manageWebsiteVisit(post(managePath, { action: 'cancel', token, revision: 3 })),
        /can no longer be changed/,
      );
      assert.equal(
        await prisma.auditLog.count({
          where: { module: 'Front desk', metadata: { path: ['visitId'], equals: visit.id } },
        }),
        3,
      );
      assert.equal((await jobsFor(visit.id)).length, 8);

      // The front desk: open times without notice, a caller without email, outcomes and notes.
      const staffSlots = (await adminRead(
        'front-desk',
        new URLSearchParams({ slots: '1' }),
        actor,
      )) as FrontDeskSlots;
      const staffSlot = staffSlots.days.find((candidate) => candidate.slots.length)?.slots[0];
      assert.ok(staffSlot);
      const caller = {
        clientName: 'Jose Reyes',
        email: '',
        phone: '+63 917 555 0202',
        startsAt: staffSlot.startsAt,
        staffNotes: 'Prefers the garden.',
      };
      await assert.rejects(
        adminMutate({ op: 'schedule-visit', visit: caller, consent: false }, actor),
      );
      const created = (await adminMutate(
        { op: 'schedule-visit', visit: caller, consent: true },
        actor,
      )) as { id: string; reference: string; emailed: boolean };
      assert.equal(created.emailed, false);
      const callerJobs = await jobsFor(created.id);
      assert.deepEqual(
        callerJobs.map((row) => row.event),
        ['VISIT_STAFF_CALENDAR'],
        'Without an email only the staff calendars get the visit',
      );
      assert.match(
        callerJobs[0].body,
        /Staff scheduled an ocular visit for Jose Reyes at the front desk\./,
      );

      const now = new Date();
      const today = manilaDateKey(now);
      const todayStart = new Date(`${today}T00:00:00+08:00`).getTime();
      const startsToday = new Date(Math.max(todayStart + 60_000, now.getTime() - 60_000));
      const visitRow = (reference: string, startsAt: Date) => ({
        reference,
        clientName: reference === 'VIS-TEST-TODAY' ? 'Ana Cruz' : 'Ben Lim',
        email: '',
        phone: '0917 555 0303',
        startsAt,
        endsAt: new Date(startsAt.getTime() + 3_600_000),
        source: 'STAFF',
      });
      const todayVisit = await prisma.adminVisit.create({
        data: visitRow('VIS-TEST-TODAY', startsToday),
      });
      const pastVisit = await prisma.adminVisit.create({
        data: visitRow('VIS-TEST-PAST', new Date(now.getTime() - 26 * 3_600_000)),
      });
      const laterVisit = await prisma.adminVisit.create({
        data: visitRow('VIS-TEST-LATER', new Date(now.getTime() + 3 * DAY_MS)),
      });

      const digestNow = new Date(`${today}T23:00:00+08:00`);
      assert.equal(await scheduleDailyDigest(digestNow), 1);
      const digest = await prisma.adminOutbox.findUniqueOrThrow({
        where: { idempotencyKey: `digest:${today}` },
      });
      const visitsToday = await prisma.adminVisit.count({
        where: {
          status: { in: ['SCHEDULED', 'CHECKED_IN'] },
          startsAt: { gte: new Date(todayStart), lt: new Date(todayStart + DAY_MS) },
        },
      });
      assert.match(digest.body, new RegExp(`Ocular visits today: ${visitsToday}`));
      assert.match(digest.body, /Ana Cruz \(VIS-TEST-TODAY\)/);

      const agenda = (await adminRead(
        'front-desk',
        new URLSearchParams(),
        actor,
      )) as FrontDeskAgenda;
      assert.equal(agenda.today, today);
      assert.ok(agenda.visitsToday.some((row) => row.id === todayVisit.id));
      assert.ok(agenda.needsOutcome.some((row) => row.id === pastVisit.id));
      assert.ok(agenda.upcoming.some((row) => row.id === laterVisit.id));
      assert.ok(
        agenda.eventsToday.every((event) => event.state === 'CONFIRMED' || event.state === 'HELD'),
      );

      const outcome = (id: string, value: string) =>
        adminMutate({ op: 'visit-outcome', id, outcome: value }, actor);
      await assert.rejects(outcome(laterVisit.id, 'CHECK_IN'), /only possible on the day/);
      await assert.rejects(outcome(laterVisit.id, 'NO_SHOW'), /once its time has started/);
      await outcome(todayVisit.id, 'CHECK_IN');
      await outcome(todayVisit.id, 'COMPLETE');
      await outcome(pastVisit.id, 'NO_SHOW');
      await assert.rejects(outcome(pastVisit.id, 'NO_SHOW'), /already updated/);
      const completed = await prisma.adminVisit.findUniqueOrThrow({ where: { id: todayVisit.id } });
      assert.equal(completed.status, 'COMPLETED');
      assert.ok(completed.checkedInAt && completed.completedAt);
      const after = (await adminRead(
        'front-desk',
        new URLSearchParams(),
        actor,
      )) as FrontDeskAgenda;
      assert.equal(
        after.needsOutcome.some((row) => row.id === pastVisit.id),
        false,
      );

      await adminMutate(
        { op: 'visit-notes', id: todayVisit.id, staffNotes: 'Loved the garden.' },
        actor,
      );
      assert.equal(
        (await prisma.adminVisit.findUniqueOrThrow({ where: { id: todayVisit.id } })).staffNotes,
        'Loved the garden.',
      );
      await assert.rejects(
        adminMutate({ op: 'cancel-visit', id: created.id, revision: 1, reason: '' }, actor),
      );
      await adminMutate(
        { op: 'cancel-visit', id: created.id, revision: 1, reason: 'Caller rebooked by phone.' },
        actor,
      );
      const callerCancelled = await prisma.adminVisit.findUniqueOrThrow({
        where: { id: created.id },
      });
      assert.equal(callerCancelled.status, 'CANCELLED');
      assert.equal(callerCancelled.cancelReason, 'Caller rebooked by phone.');
      // Its staff invitation never went out, so no calendar needs a cancellation.
      assert.equal((await job(created.id, 'staff', 1)).status, 'EXPIRED');
      assert.equal(
        await prisma.adminOutbox.count({
          where: { idempotencyKey: `visit:${created.id}:staff:r2` },
        }),
        0,
      );

      // The admin Calendar shows the month's visits beside its events, except cancelled ones.
      const month = (change: Record<string, string> = {}) =>
        adminRead(
          'calendar',
          new URLSearchParams({
            from: `${today.slice(0, 8)}01`,
            to: addDays(`${addDays(today.slice(0, 8) + '01', 32).slice(0, 8)}01`, -1),
            ...change,
          }),
          actor,
        ) as Promise<{ visits?: CalendarVisit[] }>;
      const calendar = (await month()).visits ?? [];
      assert.ok(calendar.some((row) => row.id === todayVisit.id && row.status === 'COMPLETED'));
      assert.equal(
        calendar.some((row) => row.status === 'CANCELLED'),
        false,
      );
      assert.deepEqual((await month({ reservation: 'CONFIRMED' })).visits, []);
      assert.deepEqual(
        ((await month({ q: 'ana cruz' })).visits ?? []).map((row) => row.reference),
        ['VIS-TEST-TODAY'],
      );
      assert.equal(
        'visits' in (await adminRead('bookings', new URLSearchParams(), actor)),
        false,
        'Only the Calendar reads visits',
      );

      // Client lookup by phone in any format, by email in any case, and by name.
      const byPhone = (await adminRead(
        'front-desk',
        new URLSearchParams({ lookup: '0917-555-0202' }),
        actor,
      )) as ClientLookup;
      assert.deepEqual(
        byPhone.clientVisits.map((row) => row.reference),
        [created.reference],
      );
      const byEmail = (await adminRead(
        'front-desk',
        new URLSearchParams({ lookup: 'MARIA@example.test' }),
        actor,
      )) as ClientLookup;
      assert.deepEqual(
        byEmail.clientVisits.map((row) => row.reference),
        [result.reference],
      );
      const byName = (await adminRead(
        'front-desk',
        new URLSearchParams({ lookup: 'event client' }),
        actor,
      )) as ClientLookup;
      assert.deepEqual(
        byName.clientBookings.map((row) => row.reference),
        ['ZION-TEST-EVENT'],
      );
      await assert.rejects(
        adminRead('front-desk', new URLSearchParams({ lookup: 'ab' }), actor),
        /at least 3 characters/,
      );

      // "Start booking" opens the walk-in page with the visitor's details.
      const prefill = (await adminRead(
        'front-desk',
        new URLSearchParams({ 'walk-in': 'prefill', visit: created.id }),
        actor,
      )) as WalkInPrefill;
      assert.equal(prefill.source, 'visit');
      assert.equal(prefill.visitId, created.id);
      assert.equal(prefill.clientName, 'Jose Reyes');
      assert.equal(prefill.phone, '+63 917 555 0202');
      await assert.rejects(
        adminRead(
          'front-desk',
          new URLSearchParams({ 'walk-in': 'prefill', visit: 'missing' }),
          actor,
        ),
        /Visit not found/,
      );
    } finally {
      await prisma.$disconnect();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    }
  },
);
