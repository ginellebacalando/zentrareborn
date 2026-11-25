import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';
import {
  WEBSITE_ACTIVITY_LIMIT,
  activityAge,
  activityNewerThan,
  bookingActivity,
  inquiryActivity,
  mergeWebsiteActivity,
  newActivityMessage,
  shortText,
  testimonyActivity,
  zeniQuestionActivities,
  type WebsiteActivityItem,
} from './website-activity-feed';

const now = Date.parse('2026-11-25T06:00:00.000Z');
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const itemKeys = ['href', 'id', 'kind', 'occurredAt', 'status', 'summary', 'title'];

test('activity text stays one short line without splitting characters', () => {
  assert.equal(shortText('  Maria \n  Santos ', 60), 'Maria Santos');
  assert.equal(shortText(null, 10), '');
  assert.equal(
    shortText('Is parking free for guests who arrive before the ceremony starts?', 30),
    'Is parking free for guests…',
  );
  assert.equal(shortText('Hello, world, and everyone else', 14), 'Hello, world…');
  assert.equal(shortText('🎉'.repeat(20), 5), '🎉🎉🎉🎉…');
  // A joined emoji and a decomposed accent each count as one character and are never split.
  assert.equal(shortText('👨‍👩‍👧'.repeat(10), 4), '👨‍👩‍👧👨‍👩‍👧👨‍👩‍👧…');
  assert.equal(shortText('José Rizal', 5), 'José…');
  assert.equal(shortText('Exactly ten', 11), 'Exactly ten');
});

test('ages are short, never negative, and fall back to a dated label after a week', () => {
  const age = (iso: string, timeZone = 'Asia/Manila') => activityAge(iso, now, timeZone);
  assert.equal(age(minutesAgo(0)), 'just now');
  assert.equal(age(new Date(now - 59_000).toISOString()), 'just now');
  assert.equal(age(minutesAgo(-5)), 'just now');
  assert.equal(age(minutesAgo(1)), '1 min ago');
  assert.equal(age(minutesAgo(59)), '59 min ago');
  assert.equal(age(minutesAgo(60)), '1 hr ago');
  assert.equal(age(minutesAgo(23 * 60 + 59)), '23 hr ago');
  assert.equal(age(minutesAgo(24 * 60)), '1 day ago');
  assert.equal(age(minutesAgo(6 * 24 * 60 + 23 * 60)), '6 days ago');
  assert.equal(age(minutesAgo(7 * 24 * 60)), 'Nov 18');
  assert.equal(age('2025-11-03T02:00:00.000Z'), 'Nov 3, 2025');
  // New Year in Manila is still 31 December in UTC: the admin time zone decides the year shown.
  assert.equal(age('2025-12-31T17:00:00.000Z'), 'Jan 1');
  assert.equal(age('2025-12-31T17:00:00.000Z', 'UTC'), 'Dec 31, 2025');
});

test('each source becomes one labelled item that links to the screen handling it', () => {
  const booking = bookingActivity({
    id: 'b1',
    clientName: 'Maria Santos',
    eventType: 'Wedding',
    // 00:30 on 20 December in Manila, still 19 December in UTC.
    startsAt: new Date('2026-12-19T16:30:00.000Z'),
    approval: 'PENDING',
    reservation: 'REQUESTED',
    createdAt: new Date(minutesAgo(5)),
  });
  assert.deepEqual(booking, {
    id: 'booking:b1',
    kind: 'booking',
    title: 'Booking request',
    summary: 'Maria Santos · Wedding · Dec 20, 2026',
    status: { tone: 'request', label: 'Under review' },
    occurredAt: minutesAgo(5),
    href: '/admin/bookings?status=request',
  });
  const approved = bookingActivity({
    id: 'b2',
    clientName: 'Paolo Cruz',
    eventType: 'Debut',
    startsAt: '2027-01-09T08:00:00.000Z',
    approval: 'APPROVED',
    reservation: 'REQUESTED',
    createdAt: minutesAgo(30),
  });
  assert.deepEqual(approved.status, { tone: 'pending', label: 'Waiting for payment' });
  assert.equal(approved.href, '/admin/bookings?status=pending');

  const contactForm = {
    id: 'i1',
    fullName: 'Juan Dela Cruz',
    eventInterest: 'General Message',
    sourcePage: 'contact_us',
    status: 'NEW',
    submittedAt: minutesAgo(10),
  };
  const inquiry = inquiryActivity(contactForm);
  assert.equal(inquiry.kind, 'inquiry');
  assert.equal(inquiry.title, 'Inquiry');
  assert.equal(inquiry.summary, 'Juan Dela Cruz · General Message');
  assert.deepEqual(inquiry.status, { tone: 'neutral', label: 'New' });
  assert.equal(inquiry.href, '/admin/inquiries');
  const untitled = inquiryActivity({ ...contactForm, fullName: 'Lea', eventInterest: ' ' });
  assert.equal(untitled.summary, 'Lea · General inquiry');
  const handoff = inquiryActivity({
    id: 'zeni-1',
    fullName: 'Ana Reyes',
    eventInterest: null,
    sourcePage: 'zeni_receptionist',
    status: 'PENDING_RESPONSE',
    submittedAt: minutesAgo(20),
  });
  assert.equal(handoff.kind, 'handoff');
  assert.equal(handoff.title, 'Zeni hand-off');
  assert.equal(handoff.summary, 'Ana Reyes · Asked for staff help');
  assert.deepEqual(handoff.status, { tone: 'neutral', label: 'Awaiting response' });

  const flagged = {
    id: 't1',
    clientName: 'Carla Mendoza',
    nickname: 'Carla',
    eventType: 'Birthday',
    status: 'FLAGGED',
    submittedAt: minutesAgo(30),
  };
  const held = testimonyActivity(flagged);
  assert.equal(held.summary, 'Carla · Birthday');
  assert.deepEqual(held.status, { tone: 'attention', label: 'On hold' });
  assert.equal(held.href, '#testimonies-hold');
  const review = testimonyActivity({ ...flagged, nickname: null, status: 'PENDING_REVIEW' });
  assert.equal(review.summary, 'Carla Mendoza · Birthday');
  assert.deepEqual(review.status, { tone: 'neutral', label: 'Awaiting review' });

  for (const item of [booking, inquiry, handoff, held])
    assert.deepEqual(Object.keys(item).sort(), itemKeys);
});

test('a repeated Zeni question is shown once, at its latest time', () => {
  const items = zeniQuestionActivities([
    { id: 'q-old', question: 'Is parking free?', questionHash: 'h1', createdAt: minutesAgo(50) },
    { id: 'q-new', question: 'is parking free', questionHash: 'h1', createdAt: minutesAgo(15) },
    {
      id: 'q-long',
      question: `Can we bring our own caterer ${'and decorations '.repeat(10)}?`,
      questionHash: 'h2',
      createdAt: new Date(minutesAgo(60)),
    },
  ]);
  assert.deepEqual(
    items.map((item) => [item.id, item.occurredAt]),
    [
      ['question:q-new', minutesAgo(15)],
      ['question:q-long', minutesAgo(60)],
    ],
  );
  assert.equal(items[0].summary, '“is parking free”');
  assert.equal(items[0].title, 'Zeni could not answer');
  assert.equal(items[0].status, null);
  assert.equal(items[0].href, '/admin/zeni#zeni-gaps-title');
  assert.ok(Array.from(items[1].summary).length <= 92);
  assert.match(items[1].summary, /…”$/);
});

test('sources merge newest first, in a fixed order for equal times, up to the limit', () => {
  const at = (
    id: string,
    kind: WebsiteActivityItem['kind'],
    occurredAt: string,
  ): WebsiteActivityItem => ({
    id,
    kind,
    title: kind,
    summary: id,
    status: null,
    occurredAt,
    href: '/admin',
  });
  const merged = mergeWebsiteActivity([
    at('question:a', 'question', minutesAgo(1)),
    at('booking:a', 'booking', minutesAgo(1)),
    at('inquiry:b', 'inquiry', minutesAgo(1)),
    at('inquiry:a', 'inquiry', minutesAgo(1)),
    at('testimony:a', 'testimony', minutesAgo(0)),
    at('booking:old', 'booking', minutesAgo(90)),
  ]);
  assert.deepEqual(
    merged.map((item) => item.id),
    ['testimony:a', 'booking:a', 'inquiry:a', 'inquiry:b', 'question:a', 'booking:old'],
  );
  const many = Array.from({ length: 20 }, (_, index) =>
    at(`inquiry:${index}`, 'inquiry', minutesAgo(index)),
  );
  const limited = mergeWebsiteActivity(many);
  assert.equal(limited.length, WEBSITE_ACTIVITY_LIMIT);
  assert.equal(limited[0].id, 'inquiry:0');
  assert.equal(limited.at(-1)!.id, `inquiry:${WEBSITE_ACTIVITY_LIMIT - 1}`);
});

test('announcements name only newly shown activity', () => {
  const items = [
    inquiryActivity({
      id: 'new',
      fullName: 'Juan',
      eventInterest: 'Feedback / Suggestion',
      sourcePage: 'contact_us',
      status: 'NEW',
      submittedAt: minutesAgo(1),
    }),
    inquiryActivity({
      id: 'newer-than-shown',
      fullName: 'Lea',
      eventInterest: null,
      sourcePage: 'contact_us',
      status: 'NEW',
      submittedAt: minutesAgo(2),
    }),
    inquiryActivity({
      id: 'shown',
      fullName: 'Ana',
      eventInterest: null,
      sourcePage: 'contact_us',
      status: 'NEW',
      submittedAt: minutesAgo(3),
    }),
  ];
  assert.equal(activityNewerThan(items, minutesAgo(3)).length, 2);
  assert.equal(activityNewerThan(items, '').length, 3);
  assert.equal(activityNewerThan(items, minutesAgo(1)).length, 0);
  assert.equal(newActivityMessage([]), '');
  assert.equal(
    newActivityMessage(items.slice(0, 1)),
    'New website activity. Inquiry: Juan · Feedback / Suggestion.',
  );
  assert.equal(
    newActivityMessage(items.slice(0, 2)),
    '2 new website activities. Latest: Inquiry: Juan · Feedback / Suggestion.',
  );
});

test(
  'the loader reads only visitor-side records, newest first, without contact details or messages',
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
    const server = createServer(db, { logLevel: LogLevel.Error });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${address.port}/postgres`;
    process.env.DATABASE_POOL_MAX = '1';
    const { prisma } = await import('../prisma');
    const { readWebsiteActivity } = await import('./website-activity');
    const { WEBSITE_BOOKING_ACTOR } = await import('../../config/booking');
    const generatedAt = new Date(now);
    try {
      // A session outside UTC must not shift times (the pg adapter drops timestamptz offsets).
      await prisma.$executeRawUnsafe("SET TIME ZONE 'Asia/Manila'");
      // Without the optional receptionist schema the feed still loads, and says Zeni is missing.
      const empty = await readWebsiteActivity(generatedAt);
      assert.deepEqual(empty, {
        generatedAt: generatedAt.toISOString(),
        zeniQuestionsAvailable: false,
        items: [],
      });

      const booking = (id: string, createdBy: string, minutes: number, approval = 'PENDING') =>
        prisma.adminBooking.create({
          data: {
            id,
            reference: `QA-${id}`,
            clientName: `Client ${id}`,
            email: `${id}@example.test`,
            phone: '09170000000',
            eventType: 'Wedding',
            packageName: 'Test package',
            venue: 'Test venue',
            startsAt: new Date('2026-12-20T02:00:00.000Z'),
            endsAt: new Date('2026-12-20T08:00:00.000Z'),
            guests: 80,
            totalCents: 10_000_000,
            depositCents: 3_000_000,
            paymentRule: 'DEPOSIT_REQUIRED',
            approval,
            notes: 'Private booking note',
            policyVersion: 1,
            createdBy,
            updatedBy: createdBy,
            createdAt: new Date(minutesAgo(minutes)),
          },
        });
      await booking('website-new', WEBSITE_BOOKING_ACTOR, 5);
      await booking('website-old', WEBSITE_BOOKING_ACTOR, 2 * 24 * 60, 'APPROVED');
      await booking('staff-entered', 'qa-staff-id', 1);

      const inquiry = (
        id: string,
        minutes: number,
        status: 'NEW' | 'PENDING_RESPONSE' | 'SPAM',
        sourcePage = 'contact_us',
      ) =>
        prisma.inquiry.create({
          data: {
            id,
            inquiryReference: `QA-${id}`,
            fullName: `Visitor ${id}`,
            email: `${id}@example.test`,
            phoneNumber: '09170000000',
            message: 'Private inquiry message',
            eventInterest: 'General Message',
            sourcePage,
            status,
            submittedAt: new Date(minutesAgo(minutes)),
          },
        });
      await inquiry('contact', 10, 'NEW');
      await inquiry('zeni-handoff', 20, 'PENDING_RESPONSE', 'zeni_receptionist');
      await inquiry('spam', 2, 'SPAM');

      const testimony = (
        id: string,
        minutes: number,
        status: 'FLAGGED' | 'PENDING_REVIEW' | 'APPROVED',
        deleted = false,
      ) =>
        prisma.testimony.create({
          data: {
            id,
            clientName: `Guest ${id}`,
            email: `${id}@example.test`,
            eventType: 'Birthday',
            eventDate: new Date('2026-10-10T00:00:00.000Z'),
            overallRating: 5,
            approachRating: 5,
            foodRating: 5,
            serviceRating: 5,
            comment: 'Private testimony comment',
            status,
            submittedAt: new Date(minutesAgo(minutes)),
            deletedAt: deleted ? new Date(minutesAgo(1)) : null,
          },
        });
      await testimony('held', 30, 'FLAGGED');
      await testimony('review', 40, 'PENDING_REVIEW');
      await testimony('published', 3, 'APPROVED');
      await testimony('deleted', 6, 'FLAGGED', true);

      const withoutZeni = await readWebsiteActivity(generatedAt);
      assert.equal(withoutZeni.zeniQuestionsAvailable, false);
      assert.equal(withoutZeni.items.length, 6);

      await db.exec(readFileSync('prisma/receptionist.sql', 'utf8'));
      const gap = (question: string, hash: string, minutes: number, resolved = false) =>
        prisma.$executeRaw`
          INSERT INTO zion_zeni_gaps (id, question, question_hash, topic, language, reason, created_at, resolved_at)
          VALUES (${randomUUID()}::uuid, ${question}, ${hash}, 'other', 'en', 'no_source',
            ${minutesAgo(minutes)}::timestamptz,
            ${resolved ? minutesAgo(1) : null}::timestamptz)`;
      await gap('Is parking free?', 'a'.repeat(64), 50);
      await gap('is parking free', 'a'.repeat(64), 15);
      await gap('Can we bring our own caterer?', 'b'.repeat(64), 60);
      await gap('Do you allow pets?', 'c'.repeat(64), 4, true);

      const feed = await readWebsiteActivity(generatedAt);
      assert.equal(feed.zeniQuestionsAvailable, true);
      assert.deepEqual(
        feed.items.map((item) => [item.id.replace(/^question:.+$/, 'question'), item.occurredAt]),
        [
          ['booking:website-new', minutesAgo(5)],
          ['inquiry:contact', minutesAgo(10)],
          ['question', minutesAgo(15)],
          ['inquiry:zeni-handoff', minutesAgo(20)],
          ['testimony:held', minutesAgo(30)],
          ['testimony:review', minutesAgo(40)],
          ['question', minutesAgo(60)],
          ['booking:website-old', minutesAgo(2 * 24 * 60)],
        ],
      );
      assert.deepEqual(
        feed.items.map((item) => item.summary),
        [
          'Client website-new · Wedding · Dec 20, 2026',
          'Visitor contact · General Message',
          '“is parking free”',
          'Visitor zeni-handoff · General Message',
          'Guest held · Birthday',
          'Guest review · Birthday',
          '“Can we bring our own caterer?”',
          'Client website-old · Wedding · Dec 20, 2026',
        ],
      );
      assert.equal(feed.items[3].kind, 'handoff');
      assert.deepEqual(feed.items.at(-1)!.status, {
        tone: 'pending',
        label: 'Waiting for payment',
      });
      const serialized = JSON.stringify(feed);
      for (const privateText of ['@example.test', '0917', 'Private', 'QA-'])
        assert.ok(!serialized.includes(privateText), `${privateText} must not be exposed`);

      // Each source is bounded; the merged list keeps only the newest items.
      await prisma.inquiry.createMany({
        data: Array.from({ length: WEBSITE_ACTIVITY_LIMIT + 3 }, (_, index) => ({
          id: `burst-${index}`,
          inquiryReference: `QA-burst-${index}`,
          fullName: `Burst ${index}`,
          email: `burst-${index}@example.test`,
          message: 'Private inquiry message',
          submittedAt: new Date(now - (index + 1) * 1000),
        })),
      });
      const burst = await readWebsiteActivity(generatedAt);
      assert.equal(burst.items.length, WEBSITE_ACTIVITY_LIMIT);
      assert.ok(burst.items.every((item) => item.id.startsWith('inquiry:burst-')));
      assert.equal(burst.items[0].id, 'inquiry:burst-0');
    } finally {
      await prisma.$disconnect();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    }
  },
);
