import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';
import { afterLook, isNewSince } from './header-numbers';

/**
 * The admin header's numbers (docs/admin-panel.md, "Header numbers"): opening the bell or
 * Messages clears its number for that admin only, and only new arrivals bring it back.
 */
process.env.AUTH_SECRET ??= 'test-only-secret-for-admin-header-numbers-0123456789';
process.env.NEXT_PUBLIC_APP_URL ??= 'https://zion.example.test';

const MINUTE_MS = 60_000;

test('a notice is new until the first look, then only when something arrives after it', () => {
  const look = new Date('2026-11-27T08:00:00Z');
  assert.equal(isNewSince(new Date('2026-11-27T07:00:00Z'), null), true);
  assert.equal(isNewSince(null, null), true);
  assert.equal(isNewSince(new Date('2026-11-27T07:59:59Z'), look), false);
  assert.equal(isNewSince(look, look), false);
  assert.equal(isNewSince(new Date('2026-11-27T08:00:01Z'), look), true);
  // The policy review has no arrival time: once seen, it never comes back by itself.
  assert.equal(isNewSince(null, look), false);
});

test('a look clears only the number it opened and names what it revealed', () => {
  const summary = {
    notifications: [
      { id: 'pending-bookings', title: '2 requests', isNew: true },
      { id: 'booking-confirmations', title: '1 confirmation', isNew: false },
    ],
    unseen: 1,
    newMessages: 3,
  };
  const bell = afterLook(summary, 'bell');
  assert.equal(bell.unseen, 0);
  assert.equal(bell.newMessages, 3);
  assert.deepEqual(bell.wasNew, ['pending-bookings']);
  assert.ok(bell.notifications.every((notice) => !notice.isNew));
  // The rest of each notice is kept for the panel.
  assert.equal(bell.notifications[0].title, '2 requests');
  const messages = afterLook(summary, 'messages');
  assert.equal(messages.unseen, 1);
  assert.equal(messages.newMessages, 0);
  assert.deepEqual(messages.wasNew, []);
  assert.equal(messages.notifications[0].isNew, true);
  const all = afterLook(summary, 'all');
  assert.equal(all.unseen, 0);
  assert.equal(all.newMessages, 0);
  // The summary itself is not changed.
  assert.equal(summary.unseen, 1);
  assert.equal(summary.notifications[0].isNew, true);
});

test(
  'header numbers: per admin, cleared by a look, back only for new arrivals',
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
    // The installer must apply cleanly over the schema (idempotent, additive).
    await db.exec(readFileSync('prisma/admin-notification-seen.sql', 'utf8'));
    await db.exec(readFileSync('prisma/admin-notification-seen.sql', 'utf8'));
    const server = createServer(db, { logLevel: LogLevel.Error });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${address.port}/postgres`;
    process.env.DATABASE_POOL_MAX = '1';
    const { prisma } = await import('../prisma');
    const { readNotificationSummary } = await import('./service');
    const { markSeen, readSeenTimes } = await import('./notification-seen');
    const actor = (id: string, role: 'SUPERADMIN' | 'ADMIN') => ({
      id,
      email: `${id}@example.test`,
      username: id,
      fullName: `Test ${id}`,
      profileImage: null,
      contactNumber: null,
      role,
      status: 'ACTIVE' as const,
      mustChangePassword: false,
      lastPasswordChangedAt: null,
    });
    const owner = actor('owner', 'SUPERADMIN');
    const staff = actor('staff', 'ADMIN');
    const now = Date.now();
    const minutesAgo = (minutes: number) => new Date(now - minutes * MINUTE_MS);
    const newIds = (summary: { notifications: { id: string; isNew: boolean }[] }) =>
      summary.notifications.filter((notice) => notice.isNew).map((notice) => notice.id);
    const request = (id: string, createdAt: Date) =>
      prisma.adminBooking.create({
        data: {
          id,
          reference: `SEEN-${id}`,
          clientName: `Client ${id}`,
          email: `${id}@example.test`,
          phone: '09170000000',
          eventType: 'Wedding',
          packageName: 'Zion Classic',
          venue: 'Garden Pavilion',
          startsAt: new Date(now + 30 * 24 * 60 * MINUTE_MS),
          endsAt: new Date(now + 30 * 24 * 60 * MINUTE_MS + 4 * 60 * MINUTE_MS),
          guests: 80,
          totalCents: 10_000_000,
          depositCents: 1_000_000,
          paymentRule: 'DEPOSIT_REQUIRED',
          policyVersion: 1,
          createdBy: 'qa',
          updatedBy: 'qa',
          createdAt,
        },
      });
    const inquiry = (id: string, submittedAt: Date) =>
      prisma.inquiry.create({
        data: {
          inquiryReference: `INQ-${id}`,
          fullName: `Guest ${id}`,
          email: `${id}@example.test`,
          message: 'Is 12 December free?',
          submittedAt,
        },
      });
    const outbox = (
      id: string,
      fields: Partial<Record<'event' | 'status', string>> & {
        createdAt: Date;
        claimedAt?: Date;
      },
    ) =>
      prisma.adminOutbox.create({
        data: {
          id,
          event: fields.event ?? 'RESERVATION_CONFIRMED',
          recipient: 'client@example.test',
          subject: 'Your reservation',
          body: 'Confirmed.',
          status: fields.status ?? 'ACCEPTED',
          createdAt: fields.createdAt,
          claimedAt: fields.claimedAt,
        },
      });
    try {
      for (const user of [owner, staff])
        await prisma.user.create({
          data: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            status: 'ACTIVE',
          },
        });
      await request('first', minutesAgo(60));
      await inquiry('first', minutesAgo(50));
      // The team's own record: listed, but never a reason for a number.
      await outbox('confirmed', { createdAt: minutesAgo(40) });
      // An email queued long ago that stopped on its last attempt, after the owner's look below.
      await outbox('stopped', {
        event: 'CANCEL',
        status: 'REVIEW_REQUIRED',
        createdAt: minutesAgo(45),
        claimedAt: minutesAgo(5),
      });

      // Before anyone looked, every arrival counts, as the header did before.
      const first = await readNotificationSummary(owner);
      assert.deepEqual(newIds(first).sort(), [
        'delivery-issues',
        'new-inquiries',
        'pending-bookings',
        'policy-review',
      ]);
      assert.equal(first.unseen, 4);
      assert.equal(first.newMessages, 1);
      const confirmations = first.notifications.find((n) => n.id === 'booking-confirmations');
      assert.equal(confirmations?.isNew, false, 'what the team records never raises the number');

      // The owner opens the bell (as of 10 minutes ago): only that number clears, for them only.
      await markSeen(owner.id, 'bell', minutesAgo(10));
      const afterBell = await readNotificationSummary(owner);
      // The stopped email's last attempt came after the look, so it is still new.
      assert.deepEqual(newIds(afterBell), ['delivery-issues']);
      assert.equal(afterBell.unseen, 1);
      assert.equal(afterBell.newMessages, 1, 'Messages keeps its number until it is opened');
      assert.equal(afterBell.notifications.length, first.notifications.length, 'the list stays');
      const forStaff = await readNotificationSummary(staff);
      assert.deepEqual(newIds(forStaff).sort(), ['new-inquiries', 'pending-bookings']);
      assert.equal(forStaff.newMessages, 1, 'each admin has their own numbers');
      assert.ok(
        !forStaff.notifications.some((n) => n.id === 'delivery-issues' || n.id === 'policy-review'),
        'delivery and policy notices stay with the super administrator',
      );

      // Opening Messages and the bell again clears both.
      await markSeen(owner.id, 'messages', minutesAgo(4));
      await markSeen(owner.id, 'bell', minutesAgo(4));
      const quiet = await readNotificationSummary(owner);
      assert.equal(quiet.unseen, 0);
      assert.equal(quiet.newMessages, 0);

      // Old items never bring a number back: work on them, more team records.
      await prisma.inquiry.updateMany({ data: { status: 'PENDING_RESPONSE' } });
      await prisma.adminBooking.update({ where: { id: 'first' }, data: { notes: 'Called back' } });
      await outbox('confirmed-again', { createdAt: minutesAgo(1) });
      const stillQuiet = await readNotificationSummary(owner);
      assert.equal(stillQuiet.unseen, 0);
      assert.equal(stillQuiet.newMessages, 0);

      // Something new does: a new inquiry raises both, a new request the bell.
      await inquiry('second', minutesAgo(2));
      await request('second', minutesAgo(2));
      const arrivals = await readNotificationSummary(owner);
      assert.deepEqual(newIds(arrivals).sort(), ['new-inquiries', 'pending-bookings']);
      assert.equal(arrivals.unseen, 2);
      assert.equal(arrivals.newMessages, 1);
      assert.match(
        arrivals.notifications.find((n) => n.id === 'pending-bookings')?.title ?? '',
        /^2 booking requests/,
        'the notice still counts every open request',
      );

      // "Mark all as read" clears both numbers at once.
      await markSeen(owner.id, 'all');
      const cleared = await readNotificationSummary(owner);
      assert.equal(cleared.unseen, 0);
      assert.equal(cleared.newMessages, 0);
      const times = await readSeenTimes(owner.id);
      assert.ok(times.bellSeenAt && times.messagesSeenAt);
      assert.equal(times.bellSeenAt.getTime(), times.messagesSeenAt.getTime());

      // An inquiry turned off in Settings shows no Messages number.
      await inquiry('third', new Date());
      await prisma.systemSetting.create({
        data: {
          id: 'singleton',
          settings: { admin: { notifications: { customerInquiries: false } } },
        },
      });
      const muted = await readNotificationSummary(owner);
      assert.equal(muted.newMessages, 0);
      assert.ok(!muted.notifications.some((n) => n.id === 'new-inquiries'));

      // Removing an admin removes their looks with them.
      await markSeen(staff.id, 'bell');
      await prisma.user.delete({ where: { id: staff.id } });
      assert.equal(await prisma.adminNotificationSeen.count({ where: { userId: staff.id } }), 0);
      assert.equal(await prisma.adminNotificationSeen.count({ where: { userId: owner.id } }), 1);

      // Before the table is installed, the header works and counts everything still open.
      await prisma.$executeRawUnsafe('DROP TABLE "zion_admin_notification_seen"');
      const withoutTable = await readNotificationSummary({ ...owner, id: 'not-installed' });
      assert.ok(withoutTable.unseen >= 2);
      assert.equal(withoutTable.newMessages, 0, 'inquiries are still turned off in Settings');
    } finally {
      await prisma.$disconnect();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    }
  },
);
