import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';
import { applicationUrl, serverStaffRecipients } from './config';
import { formatCalendarDate } from './ics';
import { classifyDeliveryError, type MailTransport, type OutgoingMail } from './transport';
import { maskEmail, maskRecipients, sanitizeErrorMessage } from './privacy';
import { addDays, daysBetween, manilaDay, manilaDayStart, manilaHour } from './time';

const MAIL_ENV = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'MAIL_FROM',
  'STAFF_NOTIFICATION_EMAIL',
  'CRON_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'AUTH_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
];
function clearMail() {
  for (const key of MAIL_ENV) delete process.env[key];
}
function configureMail() {
  process.env.SMTP_USER = 'venue@example.test';
  process.env.SMTP_PASSWORD = 'abcd efgh ijkl mnop';
  process.env.MAIL_FROM = 'Zion Events Place <venue@example.test>';
  process.env.STAFF_NOTIFICATION_EMAIL = 'staff@example.test';
}

/** In-memory stand-in for the SMTP server: records messages, or fails as instructed. */
function fakeTransport(behavior: (message: OutgoingMail, call: number) => void | Promise<void>) {
  const sent: OutgoingMail[] = [];
  let calls = 0;
  const transport: MailTransport = {
    async send(message) {
      calls++;
      await behavior(message, calls);
      sent.push(message);
      return { accepted: message.to.split(',').map((part) => part.trim()), rejected: [] };
    },
    close() {},
  };
  return {
    transport,
    sent,
    calls: () => calls,
  };
}
const smtpError = (fields: Record<string, unknown>) =>
  Object.assign(new Error('SMTP failure'), fields);

test('pure helpers: masking, error classification, Manila days', () => {
  assert.equal(maskEmail('juan@gmail.com'), 'j***@gmail.com');
  assert.equal(
    maskRecipients('owner@example.test, staff@example.test'),
    'o***@example.test, s***@example.test',
  );
  assert.equal(maskEmail(''), '');
  assert.equal(
    sanitizeErrorMessage('550 rejected\r\nfor jane.doe@example.test'),
    '550 rejected for j***@example.test',
  );
  assert.equal(sanitizeErrorMessage(null), null);
  assert.equal(classifyDeliveryError(smtpError({ code: 'ETIMEDOUT' })).kind, 'transient');
  assert.equal(classifyDeliveryError(smtpError({ responseCode: 451 })).kind, 'transient');
  assert.equal(
    classifyDeliveryError(smtpError({ code: 'EAUTH', responseCode: 535 })).kind,
    'configuration',
  );
  assert.equal(
    classifyDeliveryError(smtpError({ responseCode: 550, permanent: true })).kind,
    'permanent',
  );
  assert.equal(classifyDeliveryError(smtpError({ code: 'EENVELOPE' })).kind, 'permanent');
  assert.equal(
    classifyDeliveryError(
      smtpError({
        responseCode: 550,
        permanent: true,
        response: '550 5.4.5 Daily user sending quota exceeded',
      }),
    ).kind,
    'quota',
  );
  const permanent = classifyDeliveryError(
    smtpError({
      responseCode: 550,
      permanent: true,
      response: '550 No such user jane@example.test',
    }),
  );
  assert.ok(!permanent.message.includes('jane@example.test'), 'server responses are never echoed');
  assert.equal(manilaDay(new Date('2026-12-31T16:00:00Z')), '2027-01-01');
  assert.equal(manilaHour(new Date('2026-12-31T23:30:00Z')), 7);
  assert.equal(manilaDayStart('2027-01-01').toISOString(), '2026-12-31T16:00:00.000Z');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(daysBetween('2026-12-28', '2027-01-04'), 7);
});

test('email links use the configured address, else the Vercel production domain', () => {
  clearMail();
  try {
    assert.equal(applicationUrl(), null);
    process.env.VERCEL_PROJECT_PRODUCTION_URL = 'zentrareborn.vercel.app';
    assert.equal(applicationUrl(), 'https://zentrareborn.vercel.app');
    process.env.NEXT_PUBLIC_APP_URL = 'https://events.example.test/booking';
    assert.equal(applicationUrl(), 'https://events.example.test', 'the configured address wins');
    process.env.NEXT_PUBLIC_APP_URL = 'javascript:alert(1)';
    assert.equal(applicationUrl(), null, 'only http and https addresses are used');
  } finally {
    clearMail();
  }
});

test('the server default staff inboxes come from STAFF_NOTIFICATION_EMAIL, else SMTP_USER', () => {
  clearMail();
  try {
    assert.deepEqual(serverStaffRecipients(), { emails: [], source: 'none' });
    process.env.SMTP_USER = 'Venue@Example.test';
    assert.deepEqual(serverStaffRecipients(), {
      emails: ['venue@example.test'],
      source: 'sending-account',
    });
    process.env.STAFF_NOTIFICATION_EMAIL = 'one@example.test, Two@example.test';
    assert.deepEqual(serverStaffRecipients(), {
      emails: ['one@example.test', 'two@example.test'],
      source: 'environment',
    });
    process.env.STAFF_NOTIFICATION_EMAIL = 'not-an-address';
    assert.deepEqual(
      serverStaffRecipients(),
      { emails: [], source: 'none' },
      'an invalid list does not fall back to the sending account',
    );
    process.env.STAFF_NOTIFICATION_EMAIL = [1, 2, 3, 4, 5]
      .map((index) => `${'x'.repeat(50)}${index}@example.test`)
      .join(',');
    assert.deepEqual(
      serverStaffRecipients(),
      { emails: [], source: 'none' },
      'the joined list must fit the 255-character recipient column',
    );
  } finally {
    clearMail();
  }
});

test(
  'automation outbox, delivery, scheduling, admin recovery and cron in an isolated database',
  { timeout: 240000 },
  async (t) => {
    clearMail();
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
    const automationSql = readFileSync('prisma/automation.sql', 'utf8');
    await db.exec(automationSql);
    // Re-running the installer SQL must be harmless.
    await db.exec(automationSql);
    const bookingHoldsSql = readFileSync('prisma/booking-holds.sql', 'utf8');
    await db.exec(bookingHoldsSql);
    await db.exec(bookingHoldsSql);
    await db.exec(readFileSync('prisma/payment-proofs.sql', 'utf8'));
    const server = createServer(db, { logLevel: LogLevel.Error });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    process.env.DATABASE_URL = `postgresql://postgres@127.0.0.1:${address.port}/postgres`;
    process.env.DATABASE_POOL_MAX = '1';
    process.env.AUTH_SECRET = randomBytes(32).toString('hex');
    const originalFetch = globalThis.fetch;
    // Automation delivers only through the injected SMTP transport: no outbound HTTP at all.
    globalThis.fetch = async () => {
      throw new Error('Unexpected outbound HTTP request.');
    };
    const { prisma } = await import('../prisma');
    const { enqueueJobs } = await import('./outbox');
    const { processDueJobs } = await import('./processor');
    const { enqueueInquiryReceived } = await import('./inquiries');
    const { scheduleDailyDigest, scheduleEventReminders, sweepInquiryNotifications } =
      await import('./scheduler');
    const { readAutomationOverview, retryAutomationJob, readAutomationHealth } =
      await import('./overview');
    const { MAIL_NOT_CONFIGURED_MESSAGE } = await import('./config');
    const addJob = async (key: string, now: Date, extra: Record<string, unknown> = {}) => {
      const [id] = await enqueueJobs(
        prisma,
        [
          {
            idempotencyKey: key,
            event: 'INQUIRY_ACKNOWLEDGEMENT',
            recipient: 'client@example.test',
            subject: 'Test notice',
            text: 'Test body',
            html: '<p>Test body</p>',
            ...extra,
          },
        ],
        now,
      );
      return id;
    };
    const row = (id: string) => prisma.adminOutbox.findUniqueOrThrow({ where: { id } });
    const t0 = new Date('2031-01-06T02:00:00Z');
    const { adminMutate } = await import('../admin/service');
    const owner = {
      id: 'automation-owner',
      email: 'owner@example.test',
      username: 'owner',
      fullName: 'Automation Owner',
      profileImage: null,
      contactNumber: null,
      role: 'SUPERADMIN' as const,
      status: 'ACTIVE' as const,
      mustChangePassword: false,
      lastPasswordChangedAt: null,
    };
    /** A staff-entered request `daysAhead` days out; separate dates keep confirmations apart. */
    const bookingRequest = (email: string, daysAhead: number) => {
      const startsAt = new Date(Date.now() + daysAhead * 86_400_000);
      return {
        op: 'create-booking',
        booking: {
          clientName: 'Calendar Client',
          email,
          phone: '09123456789',
          eventType: 'Wedding',
          packageName: 'Classic',
          venue: 'Zion Events Place',
          startsAt: startsAt.toISOString(),
          endsAt: new Date(startsAt.getTime() + 5 * 3_600_000).toISOString(),
          guests: 80,
          totalCents: 10_000_000,
          depositCents: 0,
          paymentRule: 'NO_PAYMENT_REQUIRED',
          notes: '',
        },
      };
    };
    const createBooking = async (email: string, daysAhead: number) =>
      ((await adminMutate(bookingRequest(email, daysAhead), owner)) as { id: string }).id;
    const decide = async (id: string, action: string) => {
      const current = await prisma.adminBooking.findUniqueOrThrow({ where: { id } });
      await adminMutate(
        {
          op: 'booking-action',
          id,
          revision: current.revision,
          action,
          reason: 'Verified by phone call.',
        },
        owner,
      );
      return prisma.adminBooking.findUniqueOrThrow({ where: { id } });
    };
    // Calendar lines longer than 75 octets are folded; match on the unfolded text.
    const unfold = (calendar: string | null) => (calendar ?? '').replace(/\r\n /g, '');
    const calendarUid = (calendar: string | null) => calendar?.match(/\r\nUID:([^\r]+)/)?.[1];

    try {
      await t.test(
        'schema: idempotent install, row security, state marker, status guard',
        async () => {
          const protectedTables = await db.query<{ relname: string; relrowsecurity: boolean }>(
            "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('zion_admin_outbox','zion_automation_state') AND relkind='r'",
          );
          assert.equal(protectedTables.rows.length, 2);
          assert.ok(protectedTables.rows.every((table) => table.relrowsecurity));
          const anonymous = await db.query<{ allowed: boolean }>(
            "SELECT has_table_privilege('anon','zion_automation_state','SELECT') AS allowed",
          );
          assert.equal(anonymous.rows[0].allowed, false);
          assert.ok(
            await prisma.automationState.findUnique({ where: { key: 'inquiry-sweep-since' } }),
          );
          await assert.rejects(
            db.query(
              "INSERT INTO zion_admin_outbox (id,event,recipient,subject,body,status) VALUES ('bad','X','x@example.test','s','b','SENT')",
            ),
          );
        },
      );

      await t.test(
        'public inquiry route enqueues alert and acknowledgement without HTTP',
        async () => {
          const { POST } = await import('../../app/api/client/inquiries/route');
          const response = await POST(
            new Request('http://localhost/api/client/inquiries', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                fullName: 'Maria Santos',
                email: 'Maria@Example.test',
                phoneNumber: '09123456789',
                message: 'We would like to ask about a wedding package in December.',
                eventInterest: 'Wedding',
                sourcePage: 'contact_us',
              }),
            }),
          );
          assert.equal(response.status, 201);
          const body = (await response.json()) as Record<string, unknown>;
          assert.deepEqual(Object.keys(body).sort(), ['id', 'inquiryReference', 'message']);
          const jobs = await prisma.adminOutbox.findMany({
            where: { idempotencyKey: { startsWith: `inquiry:${body.id}:` } },
            orderBy: { event: 'asc' },
          });
          assert.deepEqual(
            jobs.map((job) => [job.event, job.status, job.recipient]),
            [
              ['INQUIRY_ACKNOWLEDGEMENT', 'QUEUED', 'maria@example.test'],
              ['INQUIRY_STAFF_ALERT', 'QUEUED', ''],
            ],
          );
          const [acknowledgement, alert] = jobs;
          assert.match(acknowledgement.body, /Spam or Junk folder/);
          assert.match(acknowledgement.body, /Hello Maria Santos,/);
          assert.doesNotMatch(
            acknowledgement.body,
            /wedding package in December/,
            'no echo of visitor text',
          );
          assert.match(acknowledgement.html ?? '', /ZENTRA[\s\S]*Zion Events Place/);
          assert.match(alert.body, /wedding package in December/);
          assert.equal(alert.replyTo, 'maria@example.test');
          assert.ok(acknowledgement.expiresAt && acknowledgement.expiresAt > new Date());
        },
      );

      await t.test(
        'inquiries created outside the route are swept once, never retroactively',
        async () => {
          const marker = await prisma.automationState.findUniqueOrThrow({
            where: { key: 'inquiry-sweep-since' },
          });
          await prisma.inquiry.create({
            data: {
              id: 'zeni-sweep-1',
              inquiryReference: 'ZENI-SWEEP-1',
              fullName: 'Chat Visitor',
              email: 'chat@example.test',
              message: 'Visitor asked the team for help.',
              sourcePage: 'zeni_receptionist',
            },
          });
          await prisma.inquiry.create({
            data: {
              id: 'before-automation',
              inquiryReference: 'INQ-OLD-1',
              fullName: 'Earlier Visitor',
              email: 'earlier@example.test',
              message: 'Submitted before automation existed.',
              submittedAt: new Date(marker.at.getTime() - 60_000),
            },
          });
          assert.ok((await sweepInquiryNotifications(new Date())) >= 2);
          assert.equal(
            await prisma.adminOutbox.count({
              where: {
                idempotencyKey: {
                  in: ['inquiry:zeni-sweep-1:staff', 'inquiry:zeni-sweep-1:client'],
                },
              },
            }),
            2,
          );
          assert.equal(
            await prisma.adminOutbox.count({
              where: { idempotencyKey: { startsWith: 'inquiry:before-automation:' } },
            }),
            0,
          );
          assert.equal(await sweepInquiryNotifications(new Date()), 0);
        },
      );

      await t.test('without SMTP settings jobs stay queued with a clear reason', async () => {
        const fake = fakeTransport(() => {});
        const result = await processDueJobs({ transport: fake.transport });
        assert.equal(result.mailConfigured, false);
        assert.equal(result.sent, 0);
        assert.ok(result.waiting >= 4);
        assert.equal(fake.calls(), 0);
        const waiting = await prisma.adminOutbox.findMany({ where: { status: 'QUEUED' } });
        assert.ok(
          waiting.every(
            (job) => job.attempts === 0 && job.lastError === MAIL_NOT_CONFIGURED_MESSAGE,
          ),
        );
        const { processAdminNotifications } = await import('../admin/notifications');
        await assert.rejects(processAdminNotifications(), /not configured/);
      });

      await t.test(
        'configured delivery sends once, resolves staff and never sends twice',
        async () => {
          configureMail();
          const fake = fakeTransport(() => {});
          const result = await processDueJobs({ transport: fake.transport });
          assert.equal(result.mailConfigured, true);
          assert.equal(result.sent, 4);
          assert.equal(result.failed, 0);
          const staff = fake.sent.filter((message) => message.subject.startsWith('New inquiry'));
          assert.equal(staff.length, 2);
          assert.ok(staff.every((message) => message.to === 'staff@example.test'));
          assert.ok(
            fake.sent.every((message) =>
              /^<automation\.[^@]+@example\.test>$/.test(message.messageId),
            ),
          );
          assert.ok(fake.sent.every((message) => message.from.address === 'venue@example.test'));
          const accepted = await prisma.adminOutbox.findMany({ where: { status: 'ACCEPTED' } });
          assert.equal(accepted.length, 4);
          assert.ok(
            accepted.every((job) => job.sentAt && job.lastError === null && job.attempts === 1),
          );
          assert.ok(accepted.some((job) => job.recipient === 'staff@example.test'));
          const again = await processDueJobs({ transport: fake.transport });
          assert.equal(again.claimed, 0);
          assert.equal(fake.calls(), 4);
        },
      );

      await t.test('idempotency keys deduplicate enqueues', async () => {
        const first = await addJob('test:idempotent', t0);
        const second = await addJob('test:idempotent', t0);
        assert.ok(first);
        assert.equal(second, undefined);
        assert.equal(
          await prisma.adminOutbox.count({ where: { idempotencyKey: 'test:idempotent' } }),
          1,
        );
        const zeni = await prisma.inquiry.findUniqueOrThrow({ where: { id: 'zeni-sweep-1' } });
        assert.deepEqual(await enqueueInquiryReceived(prisma, zeni), []);
        await prisma.adminOutbox.deleteMany({ where: { idempotencyKey: { startsWith: 'test:' } } });
      });

      await t.test('transient failures back off exponentially, then stop for review', async () => {
        const id = await addJob('test:transient', t0);
        const failing = fakeTransport(() => {
          throw smtpError({ code: 'ETIMEDOUT' });
        });
        let now = t0;
        for (const [index, minutes] of [2, 8, 32, 128].entries()) {
          const result = await processDueJobs({ now, transport: failing.transport });
          assert.equal(result.retrying, 1);
          const job = await row(id);
          assert.equal(job.status, 'QUEUED');
          assert.equal(job.attempts, index + 1);
          assert.equal(job.nextAttemptAt.getTime() - now.getTime(), minutes * 60_000);
          assert.match(job.lastError ?? '', /Temporary delivery problem \(ETIMEDOUT\)/);
          const early = await processDueJobs({
            now: new Date(job.nextAttemptAt.getTime() - 1),
            transport: failing.transport,
          });
          assert.equal(early.claimed, 0, 'a job is not retried before its backoff elapses');
          now = job.nextAttemptAt;
        }
        const final = await processDueJobs({ now, transport: failing.transport });
        assert.equal(final.failed, 1);
        let job = await row(id);
        assert.equal(job.status, 'REVIEW_REQUIRED');
        assert.equal(job.attempts, 5);
        const later = await processDueJobs({
          now: new Date(now.getTime() + 86_400_000),
          transport: failing.transport,
        });
        assert.equal(
          later.claimed,
          0,
          'failed jobs stay visible and are not retried automatically',
        );
        const working = fakeTransport(() => {});
        assert.equal(
          (await retryAutomationJob(id, { now, transport: working.transport }))?.status,
          'sent',
        );
        job = await row(id);
        assert.equal(job.status, 'ACCEPTED');
        assert.equal(job.maxAttempts, 8);
        assert.equal(await retryAutomationJob(id, { now, transport: working.transport }), null);
        assert.equal(working.calls(), 1, 'a sent job is never sent again');
      });

      await t.test('permanent, sign-in and quota failures are handled distinctly', async () => {
        await prisma.adminOutbox.deleteMany({ where: { idempotencyKey: { startsWith: 'test:' } } });
        const permanentId = await addJob('test:permanent', t0);
        const rejecting = fakeTransport(() => {
          throw smtpError({
            responseCode: 550,
            permanent: true,
            response: '550 No such user jane@example.test',
          });
        });
        assert.equal((await processDueJobs({ now: t0, transport: rejecting.transport })).failed, 1);
        const permanent = await row(permanentId);
        assert.equal(permanent.status, 'REVIEW_REQUIRED');
        assert.equal(permanent.attempts, 1);
        assert.ok(!(permanent.lastError ?? '').includes('jane@example.test'));

        const authIds = [
          await addJob('test:auth-1', t0),
          await addJob('test:auth-2', new Date(t0.getTime() + 1)),
          await addJob('test:auth-3', new Date(t0.getTime() + 2)),
        ];
        const badLogin = fakeTransport(() => {
          throw smtpError({ code: 'EAUTH', responseCode: 535 });
        });
        const later = new Date(t0.getTime() + 10);
        const result = await processDueJobs({ now: later, transport: badLogin.transport });
        assert.equal(badLogin.calls(), 1, 'a sign-in failure stops the batch');
        assert.equal(result.stoppedEarly, true);
        const authRows = await Promise.all(authIds.map(row));
        assert.match(authRows[0].lastError ?? '', /SMTP_PASSWORD/);
        assert.equal(authRows[0].attempts, 1);
        assert.deepEqual(
          authRows.slice(1).map((job) => [job.status, job.attempts]),
          [
            ['QUEUED', 0],
            ['QUEUED', 0],
          ],
        );
        await prisma.adminOutbox.deleteMany({
          where: { idempotencyKey: { startsWith: 'test:auth' } },
        });

        const quotaId = await addJob('test:quota', t0);
        const quota = fakeTransport(() => {
          throw smtpError({
            responseCode: 550,
            permanent: true,
            response: '550 5.4.5 Daily user sending quota exceeded.',
          });
        });
        assert.equal((await processDueJobs({ now: t0, transport: quota.transport })).waiting, 1);
        const held = await row(quotaId);
        assert.equal(held.status, 'QUEUED');
        assert.equal(held.attempts, 0, 'a quota refusal does not spend an attempt');
        assert.equal(held.nextAttemptAt.getTime(), t0.getTime() + 60 * 60_000);
        await prisma.adminOutbox.deleteMany({ where: { idempotencyKey: { startsWith: 'test:' } } });
      });

      await t.test('concurrent runs claim each job exactly once', async () => {
        const ids = [];
        for (let index = 0; index < 6; index++)
          ids.push(await addJob(`test:parallel-${index}`, t0));
        const deliveries = new Map<string, number>();
        const fake = fakeTransport(async (message) => {
          deliveries.set(message.messageId, (deliveries.get(message.messageId) ?? 0) + 1);
          await new Promise((resolve) => setTimeout(resolve, 5));
        });
        const [first, second] = await Promise.all([
          processDueJobs({ now: t0, transport: fake.transport }),
          processDueJobs({ now: t0, transport: fake.transport }),
        ]);
        assert.equal(first.sent + second.sent, 6);
        assert.equal(deliveries.size, 6);
        assert.ok([...deliveries.values()].every((count) => count === 1));
        await prisma.adminOutbox.deleteMany({ where: { idempotencyKey: { startsWith: 'test:' } } });
      });

      await t.test(
        'interrupted, expired and unaddressable jobs are never sent blindly',
        async () => {
          const interruptedId = await addJob('test:interrupted', t0);
          await prisma.adminOutbox.update({
            where: { id: interruptedId },
            data: {
              status: 'PROCESSING',
              attempts: 1,
              claimedAt: new Date(t0.getTime() - 11 * 60_000),
            },
          });
          const expiredId = await addJob('test:expired', t0, {
            expiresAt: new Date(t0.getTime() - 1),
          });
          process.env.STAFF_NOTIFICATION_EMAIL = 'not-an-address';
          const staffId = await addJob('test:staff', t0, { event: 'DAILY_DIGEST', recipient: '' });
          const fake = fakeTransport(() => {});
          const result = await processDueJobs({ now: t0, transport: fake.transport });
          assert.equal(result.interrupted, 1);
          assert.equal(fake.calls(), 0);
          assert.equal((await row(interruptedId)).status, 'REVIEW_REQUIRED');
          assert.match((await row(interruptedId)).lastError ?? '', /interrupted/);
          assert.equal((await row(expiredId)).status, 'EXPIRED');
          const staff = await row(staffId);
          assert.equal(staff.status, 'QUEUED');
          assert.equal(staff.attempts, 0);
          assert.match(staff.lastError ?? '', /STAFF_NOTIFICATION_EMAIL/);
          process.env.STAFF_NOTIFICATION_EMAIL = 'staff@example.test';
          await prisma.adminOutbox.deleteMany({
            where: { idempotencyKey: { startsWith: 'test:' } },
          });
        },
      );

      await t.test('the daily sending limit holds jobs instead of exhausting Gmail', async () => {
        await prisma.adminOutbox.createMany({
          data: Array.from({ length: 450 }, (_, index) => ({
            idempotencyKey: `test:sent-${index}`,
            event: 'INQUIRY_ACKNOWLEDGEMENT',
            recipient: 'client@example.test',
            subject: 'Sent',
            body: 'Sent',
            status: 'ACCEPTED',
            sentAt: new Date(t0.getTime() - 60 * 60_000),
          })),
        });
        const id = await addJob('test:over-limit', t0);
        const fake = fakeTransport(() => {});
        const result = await processDueJobs({ now: t0, transport: fake.transport });
        assert.equal(fake.calls(), 0);
        assert.equal(result.stoppedEarly, true);
        assert.match((await row(id)).lastError ?? '', /daily sending limit/);
        await prisma.adminOutbox.deleteMany({ where: { idempotencyKey: { startsWith: 'test:' } } });
      });

      await t.test('abuse guards limit acknowledgements and never echo spam names', async () => {
        const now = new Date();
        for (let index = 0; index < 4; index++)
          await enqueueInquiryReceived(
            prisma,
            {
              id: `guard-${index}`,
              inquiryReference: `INQ-GUARD-${index}`,
              fullName: index === 0 ? 'Cheap pills at https://spam.example.test' : 'Repeat Sender',
              email: 'repeat@example.test',
              phoneNumber: null,
              eventInterest: null,
              packageInterest: null,
              preferredContactTime: null,
              sourcePage: 'contact_us',
              message: 'Testing the inquiry acknowledgement limit.',
              submittedAt: now,
            },
            now,
          );
        const acknowledgements = await prisma.adminOutbox.findMany({
          where: { event: 'INQUIRY_ACKNOWLEDGEMENT', recipient: 'repeat@example.test' },
        });
        assert.equal(acknowledgements.length, 4);
        assert.equal(acknowledgements.filter((job) => job.status === 'QUEUED').length, 3);
        assert.equal(acknowledgements.filter((job) => job.status === 'EXPIRED').length, 1);
        assert.ok(
          acknowledgements.every(
            (job) =>
              !job.body.includes('spam.example') && !(job.html ?? '').includes('spam.example'),
          ),
        );
        await prisma.adminOutbox.deleteMany({
          where: { idempotencyKey: { startsWith: 'inquiry:guard-' } },
        });
      });

      await t.test(
        'confirmation sends REQUEST; cancelling sends CANCEL with a higher SEQUENCE',
        async () => {
          clearMail();
          await adminMutate(
            {
              op: 'settings',
              version: 1,
              reviewed: true,
              paymentRule: 'NO_PAYMENT_REQUIRED',
              cashInstructions: 'Pay at the venue after confirmation; staff issue a receipt.',
              contractTerms: 'Venue reviewed terms and cash policy. '.repeat(10),
            },
            owner,
          );
          const id = await createBooking('calendar@example.test', 20);
          await decide(id, 'VERIFY');
          await decide(id, 'APPROVE');
          const confirmed = await decide(id, 'CONFIRM');
          const request = await prisma.adminOutbox.findFirstOrThrow({
            where: { bookingId: id, event: 'RESERVATION_CONFIRMED' },
          });
          assert.equal(request.calendarMethod, 'REQUEST');
          assert.match(
            request.calendar ?? '',
            new RegExp(`\\r\\nSEQUENCE:${confirmed.revision}\\r\\n`),
          );
          assert.match(request.body, /calendar invitation \(invite\.ics\) is attached/);
          const cancelled = await decide(id, 'CANCEL');
          assert.ok(cancelled.revision > confirmed.revision);
          const cancel = await prisma.adminOutbox.findFirstOrThrow({
            where: { bookingId: id, event: 'CANCEL' },
          });
          assert.equal(cancel.calendarMethod, 'CANCEL');
          assert.equal(calendarUid(cancel.calendar), calendarUid(request.calendar));
          assert.match(cancel.calendar ?? '', /\r\nMETHOD:CANCEL\r\n/);
          assert.match(
            cancel.calendar ?? '',
            new RegExp(`\\r\\nSEQUENCE:${cancelled.revision}\\r\\n`),
          );
          const superseded = await row(request.id);
          assert.equal(
            superseded.status,
            'EXPIRED',
            'an unsent confirmation is not sent after cancellation',
          );
          assert.equal(
            await prisma.adminOutbox.count({
              where: { bookingId: id, event: { startsWith: 'STAFF_CALENDAR' } },
            }),
            0,
            'no staff inbox is configured, so no staff calendar copy is prepared',
          );

          const unconfirmed = await createBooking('requested@example.test', 20);
          await decide(unconfirmed, 'CANCEL');
          const plainCancel = await prisma.adminOutbox.findFirstOrThrow({
            where: { bookingId: unconfirmed, event: 'CANCEL' },
          });
          assert.equal(plainCancel.calendar, null, 'no invite was sent, so no cancellation update');
        },
      );

      await t.test(
        'staff calendars get their own copy of the event and Settings inboxes take precedence',
        async () => {
          configureMail();
          try {
            const id = await createBooking('staff-calendar@example.test', 30);
            await decide(id, 'VERIFY');
            await decide(id, 'APPROVE');
            const confirmed = await decide(id, 'CONFIRM');
            const notice = await prisma.adminOutbox.findFirstOrThrow({
              where: { bookingId: id, event: 'RESERVATION_CONFIRMED' },
            });
            const invitation = await prisma.adminOutbox.findFirstOrThrow({
              where: { bookingId: id, event: 'STAFF_CALENDAR_REQUEST' },
            });
            assert.equal(invitation.recipient, 'staff@example.test');
            assert.equal(invitation.replyTo, 'staff-calendar@example.test');
            assert.equal(invitation.calendarMethod, 'REQUEST');
            assert.equal(
              invitation.idempotencyKey,
              `booking:${id}:STAFF_CALENDAR_REQUEST:r${confirmed.revision}`,
            );
            assert.match(invitation.subject, /^Confirmed: Wedding for Calendar Client, /);
            assert.match(invitation.body, /Reservation: ZION-/);
            const staffRequest = unfold(invitation.calendar);
            const clientRequest = unfold(notice.calendar);
            assert.match(staffRequest, /\r\nMETHOD:REQUEST\r\n/);
            assert.equal(calendarUid(staffRequest), calendarUid(clientRequest));
            assert.match(staffRequest, new RegExp(`\\r\\nSEQUENCE:${confirmed.revision}\\r\\n`));
            assert.match(staffRequest, /\r\nATTENDEE;[^\r\n]*:mailto:staff@example\.test\r\n/);
            assert.doesNotMatch(staffRequest, /mailto:staff-calendar@example\.test/);
            assert.match(staffRequest, /\r\nSUMMARY:Wedding: Calendar Client \(ZION-/);
            assert.match(
              clientRequest,
              /\r\nATTENDEE;[^\r\n]*:mailto:staff-calendar@example\.test\r\n/,
            );
            assert.doesNotMatch(clientRequest, /mailto:staff@/, 'the client copy is unchanged');

            const fake = fakeTransport(() => {});
            const delivery = await processDueJobs({
              ids: [notice.id, invitation.id],
              transport: fake.transport,
            });
            assert.equal(delivery.sent, 2);
            const staffMail = fake.sent.find((message) => message.to === 'staff@example.test');
            assert.equal(staffMail?.calendar?.method, 'REQUEST');
            assert.equal(staffMail?.replyTo, 'staff-calendar@example.test');

            // The owner saves new inboxes: new staff email goes there instead of the server default.
            const saved = ['owner@example.test', 'partner@example.test'];
            await prisma.systemSetting.create({
              data: {
                id: 'singleton',
                settings: { admin: { staffNotifications: { emails: saved } } },
              },
            });
            await enqueueInquiryReceived(prisma, {
              id: 'settings-inbox',
              inquiryReference: 'INQ-SETTINGS-1',
              fullName: 'Settings Visitor',
              email: 'settings-visitor@example.test',
              phoneNumber: null,
              eventInterest: null,
              packageInterest: null,
              preferredContactTime: null,
              sourcePage: 'contact_us',
              message: 'Checking which inbox receives this alert.',
              submittedAt: new Date(),
            });
            const alert = await prisma.adminOutbox.findUniqueOrThrow({
              where: { idempotencyKey: 'inquiry:settings-inbox:staff' },
            });
            assert.equal(alert.recipient, saved.join(', '));
            const alertMail = fakeTransport(() => {});
            await processDueJobs({ ids: [alert.id], transport: alertMail.transport });
            assert.deepEqual(
              alertMail.sent.map((message) => message.to),
              [saved.join(', ')],
            );
            const overview = await readAutomationOverview(null);
            assert.deepEqual(overview.staffRecipients, {
              source: 'settings',
              masked: ['o***@example.test', 'p***@example.test'],
            });
            assert.ok(!JSON.stringify(overview).includes('owner@example.test'));

            // The cancellation still reaches the calendar that holds the event.
            const cancelled = await decide(id, 'CANCEL');
            const cancellation = await prisma.adminOutbox.findFirstOrThrow({
              where: { bookingId: id, event: 'STAFF_CALENDAR_CANCEL' },
            });
            assert.equal(cancellation.recipient, 'staff@example.test');
            assert.equal(cancellation.calendarMethod, 'CANCEL');
            assert.match(cancellation.subject, /^Cancelled: Wedding for Calendar Client, /);
            const staffCancel = unfold(cancellation.calendar);
            assert.match(staffCancel, /\r\nMETHOD:CANCEL\r\n/);
            assert.equal(calendarUid(staffCancel), calendarUid(staffRequest));
            assert.ok(cancelled.revision > confirmed.revision);
            assert.match(staffCancel, new RegExp(`\\r\\nSEQUENCE:${cancelled.revision}\\r\\n`));
            assert.match(staffCancel, /\r\nATTENDEE;[^\r\n]*:mailto:staff@example\.test\r\n/);

            // An invitation retried after the cancellation is skipped instead of re-adding it.
            const retried = await addJob('test:staff-retry', new Date(), {
              event: 'STAFF_CALENDAR_REQUEST',
              recipient: 'staff@example.test',
              bookingId: id,
            });
            const lateMail = fakeTransport(() => {});
            const late = await processDueJobs({ ids: [retried], transport: lateMail.transport });
            assert.equal(late.skipped, 1);
            assert.equal(lateMail.calls(), 0);
            assert.match((await row(retried)).lastError ?? '', /no longer confirmed/);

            // A new confirmation invites the saved inboxes. Cancelling before it is sent
            // supersedes it, and no calendar holds the event, so no staff cancellation follows.
            const second = await createBooking('staff-settings@example.test', 40);
            await decide(second, 'VERIFY');
            await decide(second, 'APPROVE');
            await decide(second, 'CONFIRM');
            const unsent = await prisma.adminOutbox.findFirstOrThrow({
              where: { bookingId: second, event: 'STAFF_CALENDAR_REQUEST' },
            });
            assert.equal(unsent.recipient, saved.join(', '));
            assert.match(
              unfold(unsent.calendar),
              /mailto:owner@example\.test\r\n[\s\S]*mailto:partner@example\.test\r\n/,
            );
            await decide(second, 'CANCEL');
            assert.equal((await row(unsent.id)).status, 'EXPIRED');
            assert.equal(
              await prisma.adminOutbox.count({
                where: { bookingId: second, event: 'STAFF_CALENDAR_CANCEL' },
              }),
              0,
            );
          } finally {
            await prisma.systemSetting.deleteMany();
            await prisma.adminOutbox.deleteMany({
              where: { idempotencyKey: { startsWith: 'test:' } },
            });
            clearMail();
          }
        },
      );

      await t.test(
        'booking requests appear in staff calendars as pending events until decided',
        async () => {
          configureMail();
          const { enqueueWebsiteBookingRequest } = await import('./booking-requests');
          const uid = (calendar: string | null) => calendarUid(unfold(calendar));
          const sequence = (calendar: string | null) =>
            Number(unfold(calendar).match(/\r\nSEQUENCE:(\d+)\r\n/)?.[1]);
          const staffRows = (bookingId: string, event: string) =>
            prisma.adminOutbox.findMany({ where: { bookingId, event } });
          const deliver = (id: string) =>
            processDueJobs({ ids: [id], transport: fakeTransport(() => {}).transport });
          try {
            // A website request reaches the staff calendars at once as a pending, free-time event.
            const startsAt = new Date(Date.now() + 60 * 86_400_000);
            const web = await prisma.adminBooking.create({
              data: {
                reference: 'ZION-WEB-PENDING',
                clientName: 'Web Client',
                email: 'web-client@example.test',
                phone: '09123456789',
                eventType: 'Birthdays',
                packageName: 'Milestone Birthday',
                venue: 'Zion Events Place',
                startsAt,
                endsAt: new Date(startsAt.getTime() + 3_600_000),
                guests: 150,
                totalCents: 11_650_000,
                depositCents: 500_000,
                paymentRule: 'NO_PAYMENT_REQUIRED',
                policyVersion: 1,
                createdBy: 'website',
                updatedBy: 'website',
              },
            });
            await enqueueWebsiteBookingRequest(prisma, web);
            await enqueueWebsiteBookingRequest(prisma, web);
            const pendingRows = await staffRows(web.id, 'STAFF_CALENDAR_PENDING');
            assert.equal(pendingRows.length, 1, 'a repeated call adds no second event');
            const [pending] = pendingRows;
            assert.equal(pending.status, 'QUEUED', 'a repeated call keeps the pending event');
            assert.equal(pending.recipient, 'staff@example.test');
            assert.equal(pending.replyTo, 'web-client@example.test');
            assert.equal(pending.calendarMethod, 'REQUEST');
            assert.equal(
              pending.idempotencyKey,
              `booking:${web.id}:STAFF_CALENDAR_PENDING:r${web.revision}`,
            );
            assert.match(pending.subject, /^Pending request: Birthdays for Web Client, /);
            assert.match(pending.body, /\[Pending\]/);
            const pendingEvent = unfold(pending.calendar);
            assert.match(
              pendingEvent,
              /\r\nSUMMARY:\[Pending\] Birthdays: Web Client \(ZION-WEB-PENDING\)\r\n/,
            );
            assert.match(pendingEvent, /\r\nSTATUS:TENTATIVE\r\n/);
            assert.match(pendingEvent, /\r\nTRANSP:TRANSPARENT\r\n/);
            assert.match(pendingEvent, /\r\nATTENDEE;[^\r\n]*:mailto:staff@example\.test\r\n/);
            assert.equal(uid(pending.calendar), `booking-${web.id}@zion-events-place`);
            const acknowledgement = await prisma.adminOutbox.findFirstOrThrow({
              where: { bookingId: web.id, event: 'REQUEST_RECEIVED' },
            });
            assert.equal(acknowledgement.calendar, null, 'the client gets no event for a request');
            const sentPending = fakeTransport(() => {});
            await processDueJobs({ ids: [pending.id], transport: sentPending.transport });
            assert.equal(sentPending.sent[0]?.to, 'staff@example.test');
            assert.equal(sentPending.sent[0]?.calendar?.method, 'REQUEST');

            // Declining removes the pending event from the calendars that received it.
            const declined = await decide(web.id, 'REJECT');
            const [removal] = await staffRows(web.id, 'STAFF_CALENDAR_CANCEL');
            assert.equal(removal.recipient, 'staff@example.test');
            assert.match(removal.subject, /^Request declined: Birthdays for Web Client, /);
            assert.match(unfold(removal.calendar), /\r\nMETHOD:CANCEL\r\n/);
            assert.equal(uid(removal.calendar), uid(pending.calendar));
            assert.ok(declined.revision > web.revision);
            assert.equal(sequence(removal.calendar), declined.revision);
            const rejection = await prisma.adminOutbox.findFirstOrThrow({
              where: { bookingId: web.id, event: 'REJECT' },
            });
            assert.equal(rejection.calendar, null, 'the client had no event to remove');

            // A pending event retried after the decision is skipped.
            const stale = await addJob('test:stale-pending', new Date(), {
              event: 'STAFF_CALENDAR_PENDING',
              recipient: 'staff@example.test',
              bookingId: web.id,
            });
            const staleMail = fakeTransport(() => {});
            const late = await processDueJobs({ ids: [stale], transport: staleMail.transport });
            assert.equal(late.skipped, 1);
            assert.equal(staleMail.calls(), 0);
            assert.match((await row(stale)).lastError ?? '', /no longer pending/);

            // Reviewing the declined request again shows it as pending again.
            await decide(web.id, 'VERIFY');
            const reviewed = await decide(web.id, 'REVIEW_POLICY');
            const pendingAgain = await prisma.adminOutbox.findUniqueOrThrow({
              where: {
                idempotencyKey: `booking:${web.id}:STAFF_CALENDAR_PENDING:r${reviewed.revision}`,
              },
            });
            assert.equal(pendingAgain.recipient, 'staff@example.test');
            assert.equal(sequence(pendingAgain.calendar), reviewed.revision);

            // A staff-entered request: an edit moves its pending event, and confirming turns the
            // same event into the reservation for the current inboxes and those holding it.
            const id = await createBooking('pending-flow@example.test', 70);
            const [first] = await staffRows(id, 'STAFF_CALENDAR_PENDING');
            assert.equal(first.recipient, 'staff@example.test');
            await deliver(first.id);
            const before = await prisma.adminBooking.findUniqueOrThrow({ where: { id } });
            await adminMutate(
              {
                op: 'edit-booking',
                id,
                revision: before.revision,
                booking: bookingRequest('pending-flow@example.test', 75).booking,
                reason: 'The client moved the date.',
              },
              owner,
            );
            const edited = await prisma.adminBooking.findUniqueOrThrow({ where: { id } });
            const moved = await prisma.adminOutbox.findUniqueOrThrow({
              where: { idempotencyKey: `booking:${id}:STAFF_CALENDAR_PENDING:r${edited.revision}` },
            });
            assert.equal(moved.recipient, 'staff@example.test');
            assert.equal(uid(moved.calendar), uid(first.calendar));
            assert.ok(sequence(moved.calendar) > sequence(first.calendar));
            assert.match(
              unfold(moved.calendar),
              new RegExp(`\\r\\nDTSTART:${formatCalendarDate(edited.startsAt)}\\r\\n`),
            );
            await deliver(moved.id);

            await prisma.systemSetting.create({
              data: {
                id: 'singleton',
                settings: { admin: { staffNotifications: { emails: ['owner@example.test'] } } },
              },
            });
            await decide(id, 'VERIFY');
            await decide(id, 'APPROVE');
            const confirmed = await decide(id, 'CONFIRM');
            const invitation = await prisma.adminOutbox.findFirstOrThrow({
              where: { bookingId: id, event: 'STAFF_CALENDAR_REQUEST' },
            });
            assert.equal(invitation.recipient, 'owner@example.test, staff@example.test');
            const confirmedEvent = unfold(invitation.calendar);
            assert.match(confirmedEvent, /\r\nSTATUS:CONFIRMED\r\n/);
            assert.match(confirmedEvent, /\r\nSUMMARY:Wedding: Calendar Client \(ZION-/);
            assert.doesNotMatch(confirmedEvent, /\[Pending\]/);
            assert.equal(uid(invitation.calendar), uid(first.calendar));
            assert.equal(sequence(invitation.calendar), confirmed.revision);
            for (const inbox of ['owner', 'staff'])
              assert.match(
                confirmedEvent,
                new RegExp(`\\r\\nATTENDEE;[^\\r\\n]*:mailto:${inbox}@example\\.test\\r\\n`),
              );
            await deliver(invitation.id);
            await decide(id, 'CANCEL');
            const cancellation = await prisma.adminOutbox.findFirstOrThrow({
              where: { bookingId: id, event: 'STAFF_CALENDAR_CANCEL' },
            });
            assert.equal(cancellation.recipient, 'owner@example.test, staff@example.test');
            assert.match(cancellation.subject, /^Cancelled: Wedding for Calendar Client, /);

            // A pending event that never went out is skipped once the request is confirmed.
            const quick = await createBooking('quick-confirm@example.test', 80);
            const [unsent] = await staffRows(quick, 'STAFF_CALENDAR_PENDING');
            assert.equal(unsent.recipient, 'owner@example.test');
            await decide(quick, 'VERIFY');
            await decide(quick, 'APPROVE');
            await decide(quick, 'CONFIRM');
            const skipped = await row(unsent.id);
            assert.equal(skipped.status, 'EXPIRED');
            assert.match(skipped.lastError ?? '', /confirmed before its pending calendar event/);
            const [quickInvite] = await staffRows(quick, 'STAFF_CALENDAR_REQUEST');
            assert.equal(quickInvite.recipient, 'owner@example.test');
          } finally {
            await prisma.systemSetting.deleteMany();
            await prisma.adminOutbox.deleteMany({
              where: { idempotencyKey: { startsWith: 'test:' } },
            });
            clearMail();
          }
        },
      );

      await t.test(
        'booking automation: payment confirms, unpaid holds are released, events complete',
        async () => {
          configureMail();
          const { completeFinishedEvents, expireUnpaidHolds, scheduleHoldReminders } =
            await import('../admin/booking-automation');
          const { enqueueWebsiteBookingRequest } = await import('./booking-requests');
          const venuePolicy = await prisma.adminPolicy.findUniqueOrThrow({
            where: { id: 'venue' },
          });
          await adminMutate(
            {
              op: 'settings',
              version: venuePolicy.version,
              reviewed: true,
              paymentRule: 'DEPOSIT_REQUIRED',
              cashInstructions: 'Pay the reservation fee in cash at Zion Events Place.',
              contractTerms: 'Venue reviewed terms and cash policy. '.repeat(10),
            },
            owner,
          );
          const create = async (email: string, daysAhead: number) => {
            const request = bookingRequest(email, daysAhead);
            const booking = {
              ...request.booking,
              depositCents: 500_000,
              paymentRule: 'DEPOSIT_REQUIRED',
            };
            return ((await adminMutate({ ...request, booking }, owner)) as { id: string }).id;
          };
          const receipt = (id: string, revision: number, amountCents: number, number: string) =>
            adminMutate(
              {
                op: 'cash-receipt',
                id,
                revision,
                amountCents,
                receiptNumber: number,
                receivedAt: new Date().toISOString(),
                note: '',
              },
              owner,
            );
          const count = (bookingId: string, event: string) =>
            prisma.adminOutbox.count({ where: { bookingId, event } });
          try {
            // Approval holds the date; recording the reservation fee confirms it by itself.
            const paidId = await create('pays@example.test', 90);
            const approved = await decide(paidId, 'APPROVE');
            assert.ok(approved.holdExpiresAt, 'approval sets a payment deadline');
            await receipt(paidId, approved.revision, 500_000, 'AUTO-001');
            const paid = await prisma.adminBooking.findUniqueOrThrow({ where: { id: paidId } });
            assert.equal(paid.reservation, 'CONFIRMED');
            assert.equal(paid.holdExpiresAt, null);
            assert.equal(await count(paidId, 'CASH_RECEIPT'), 1);
            assert.equal(await count(paidId, 'RESERVATION_CONFIRMED'), 1);
            assert.equal(await count(paidId, 'STAFF_CALENDAR_REQUEST'), 1);

            // Staff can give a client more time; the client hears about the new deadline.
            const extendId = await create('extend@example.test', 95);
            await decide(extendId, 'APPROVE');
            await prisma.adminBooking.update({
              where: { id: extendId },
              data: { holdExpiresAt: new Date(Date.now() + 3_600_000) },
            });
            const extended = await decide(extendId, 'EXTEND_HOLD');
            assert.ok(extended.holdExpiresAt! > new Date(Date.now() + 2 * 86_400_000));
            const extensionNotice = await prisma.adminOutbox.findFirstOrThrow({
              where: { bookingId: extendId, event: 'HOLD_EXTENDED' },
            });
            assert.match(extensionNotice.body, /Your payment deadline was extended/);

            // One reminder a day before the deadline, not right after the client heard about it.
            await prisma.adminBooking.update({
              where: { id: extendId },
              data: { holdExpiresAt: new Date(Date.now() + 20 * 3_600_000) },
            });
            assert.equal(await scheduleHoldReminders(new Date()), 0);
            const halfDayLater = new Date(Date.now() + 13 * 3_600_000);
            assert.equal(await scheduleHoldReminders(halfDayLater), 1);
            assert.equal(await scheduleHoldReminders(halfDayLater), 0, 'one reminder per deadline');
            const reminder = await prisma.adminOutbox.findFirstOrThrow({
              where: { bookingId: extendId, event: 'HOLD_REMINDER' },
            });
            assert.match(reminder.subject, /Payment reminder/);
            assert.match(reminder.body, /still on hold for you until/);

            // A deadline that passes without a payment releases the date; a partly paid hold is
            // left to staff.
            const unpaidId = await create('unpaid@example.test', 100);
            await decide(unpaidId, 'APPROVE');
            const unpaidEvent = await prisma.adminOutbox.findFirstOrThrow({
              where: { bookingId: unpaidId, event: 'STAFF_CALENDAR_PENDING' },
            });
            await processDueJobs({
              ids: [unpaidEvent.id],
              transport: fakeTransport(() => {}).transport,
            });
            const partId = await create('partly@example.test', 105);
            const partHeld = await decide(partId, 'APPROVE');
            await receipt(partId, partHeld.revision, 100_000, 'AUTO-002');
            const overdue = new Date(Date.now() - 60_000);
            await prisma.adminBooking.updateMany({
              where: { id: { in: [unpaidId, partId] } },
              data: { holdExpiresAt: overdue },
            });
            assert.equal(await expireUnpaidHolds(new Date()), 1);
            const released = await prisma.adminBooking.findUniqueOrThrow({
              where: { id: unpaidId },
            });
            assert.equal(released.reservation, 'CANCELLED');
            assert.match(released.decisionReason, /payment deadline passed/);
            const expiredNotice = await prisma.adminOutbox.findFirstOrThrow({
              where: { bookingId: unpaidId, event: 'HOLD_EXPIRED' },
            });
            assert.match(expiredNotice.body, /no longer on hold/);
            const removal = await prisma.adminOutbox.findFirstOrThrow({
              where: { bookingId: unpaidId, event: 'STAFF_CALENDAR_CANCEL' },
            });
            assert.match(removal.subject, /^Payment deadline passed: /);
            assert.equal(
              (await prisma.adminBooking.findUniqueOrThrow({ where: { id: partId } })).reservation,
              'REQUESTED',
            );
            assert.equal(await expireUnpaidHolds(new Date()), 0, 'nothing left to release');
            const automationAudit = await prisma.auditLog.findFirstOrThrow({
              where: { userName: 'Booking automation', description: { startsWith: 'Released ' } },
            });
            assert.equal(automationAudit.userRole, 'SYSTEM');

            // The morning after an event: fully paid completes, a balance alerts staff once.
            const morningNow = new Date(
              manilaDayStart(manilaDay(new Date())).getTime() + 9 * 3_600_000,
            );
            const endedAt = new Date(morningNow.getTime() - 30 * 3_600_000);
            for (const id of ['fully-paid', 'balance-due'])
              await prisma.adminBooking.create({
                data: {
                  id,
                  reference: `ZION-${id}`,
                  clientName: 'Finished Client',
                  email: `${id}@example.test`,
                  phone: '09123456789',
                  eventType: 'Debut',
                  packageName: 'Premium',
                  venue: 'Zion Events Place',
                  startsAt: new Date(endedAt.getTime() - 5 * 3_600_000),
                  endsAt: endedAt,
                  guests: 100,
                  totalCents: 300_000,
                  depositCents: 0,
                  paymentRule: 'DEPOSIT_REQUIRED',
                  approval: 'APPROVED',
                  reservation: 'CONFIRMED',
                  verification: 'VERIFIED',
                  policyVersion: 1,
                  createdBy: 'test',
                  updatedBy: 'test',
                },
              });
            await prisma.adminCashPayment.create({
              data: {
                bookingId: 'fully-paid',
                amountCents: 300_000,
                receiptNumber: 'AUTO-PAID',
                receivedAt: endedAt,
                recordedBy: 'test',
                note: '',
              },
            });
            assert.equal(await completeFinishedEvents(morningNow), 2);
            const completed = await prisma.adminBooking.findUniqueOrThrow({
              where: { id: 'fully-paid' },
            });
            assert.equal(completed.reservation, 'COMPLETED');
            assert.equal(await count('fully-paid', 'COMPLETE'), 1);
            assert.equal(
              (await prisma.adminBooking.findUniqueOrThrow({ where: { id: 'balance-due' } }))
                .reservation,
              'CONFIRMED',
            );
            const balance = await prisma.adminOutbox.findFirstOrThrow({
              where: { bookingId: 'balance-due', event: 'BALANCE_AFTER_EVENT' },
            });
            assert.equal(balance.recipient, 'staff@example.test');
            assert.equal(balance.replyTo, 'balance-due@example.test');
            assert.equal(await completeFinishedEvents(morningNow), 0, 'one alert per booking');

            // A website request the system approved tells the client to pay by the deadline.
            const webStart = new Date(Date.now() + 120 * 86_400_000);
            const heldWeb = await prisma.adminBooking.create({
              data: {
                reference: 'ZION-WEB-HELD',
                clientName: 'Held Client',
                email: 'held-client@example.test',
                phone: '09123456789',
                eventType: 'Birthdays',
                packageName: 'Milestone Birthday',
                venue: 'Zion Events Place',
                startsAt: webStart,
                endsAt: new Date(webStart.getTime() + 3_600_000),
                guests: 150,
                totalCents: 11_650_000,
                depositCents: 500_000,
                paymentRule: 'DEPOSIT_REQUIRED',
                approval: 'APPROVED',
                holdExpiresAt: new Date(Date.now() + 3 * 86_400_000),
                policyVersion: 1,
                createdBy: 'website',
                updatedBy: 'website',
              },
            });
            await enqueueWebsiteBookingRequest(prisma, heldWeb, new Date(), {
              reviewReasons: [],
              paymentInstructions: 'Pay the reservation fee in cash at Zion Events Place.',
            });
            const acknowledgement = await prisma.adminOutbox.findFirstOrThrow({
              where: { bookingId: heldWeb.id, event: 'REQUEST_RECEIVED' },
            });
            assert.match(acknowledgement.subject, /Your date is on hold/);
            assert.match(acknowledgement.body, /please pay ₱5,000 before the deadline/);
            const staffAlert = await prisma.adminOutbox.findFirstOrThrow({
              where: { bookingId: heldWeb.id, event: 'BOOKING_REQUEST_STAFF_ALERT' },
            });
            assert.match(staffAlert.subject, /waiting for payment$/);
          } finally {
            clearMail();
          }
        },
      );

      await t.test('reminders and the digest are scheduled once per booking and day', async () => {
        await prisma.adminOutbox.deleteMany({});
        const morning = new Date('2030-03-04T01:00:00Z');
        const base = {
          clientName: 'Reminder Client',
          phone: '09123456789',
          eventType: 'Debut',
          packageName: 'Premium',
          venue: 'Zion Events Place',
          guests: 120,
          totalCents: 5_000_000,
          depositCents: 0,
          paymentRule: 'NO_PAYMENT_REQUIRED',
          approval: 'APPROVED',
          verification: 'VERIFIED',
          policyVersion: 1,
          createdBy: 'test',
          updatedBy: 'test',
        };
        const create = (id: string, startsAt: string, reservation = 'CONFIRMED') =>
          prisma.adminBooking.create({
            data: {
              ...base,
              id,
              reference: `ZION-${id}`,
              email: `${id}@example.test`,
              reservation,
              startsAt: new Date(startsAt),
              endsAt: new Date(new Date(startsAt).getTime() + 4 * 3_600_000),
            },
          });
        await create('week', '2030-03-11T07:00:00Z');
        await create('tomorrow', '2030-03-05T07:00:00Z');
        await create('recent', '2030-03-10T07:00:00Z');
        await create('requested', '2030-03-05T09:00:00Z', 'REQUESTED');
        await prisma.adminOutbox.create({
          data: {
            bookingId: 'recent',
            event: 'RESERVATION_CONFIRMED',
            recipient: 'recent@example.test',
            subject: 'Confirmed',
            body: 'Confirmed',
            status: 'ACCEPTED',
            createdAt: new Date(morning.getTime() - 86_400_000),
          },
        });
        assert.equal(
          await scheduleEventReminders(new Date('2030-03-03T22:30:00Z')),
          0,
          'not before 7:00 Manila',
        );
        assert.equal(await scheduleEventReminders(morning), 2);
        assert.equal(await scheduleEventReminders(new Date(morning.getTime() + 3_600_000)), 0);
        const week = await prisma.adminOutbox.findUniqueOrThrow({
          where: { idempotencyKey: 'reminder:7d:week' },
        });
        const tomorrow = await prisma.adminOutbox.findUniqueOrThrow({
          where: { idempotencyKey: 'reminder:1d:tomorrow' },
        });
        assert.equal(week.event, 'EVENT_REMINDER_7D');
        assert.equal(week.recipient, 'week@example.test');
        assert.equal(week.expiresAt?.toISOString(), '2030-03-08T16:00:00.000Z');
        assert.equal(tomorrow.expiresAt?.toISOString(), '2030-03-05T07:00:00.000Z');
        assert.match(tomorrow.body, /Your event is tomorrow/);
        assert.match(week.body, /Venue: Zion Events Place, 82MH\+QPG/);

        assert.equal(await scheduleDailyDigest(new Date('2030-03-03T22:30:00Z')), 0);
        assert.equal(await scheduleDailyDigest(morning), 1);
        assert.equal(await scheduleDailyDigest(new Date(morning.getTime() + 3_600_000)), 0);
        const digest = await prisma.adminOutbox.findUniqueOrThrow({
          where: { idempotencyKey: 'digest:2030-03-04' },
        });
        assert.equal(digest.event, 'DAILY_DIGEST');
        assert.equal(digest.expiresAt?.toISOString(), '2030-03-04T16:00:00.000Z');
        assert.match(digest.body, /Confirmed events tomorrow: 1/);
        assert.match(digest.body, /Requests under review: \d+/);
        assert.match(digest.body, /Waiting for payment: \d+/);
        assert.match(digest.body, /Emails that failed delivery: \d+/);

        await prisma.adminBooking.update({
          where: { id: 'tomorrow' },
          data: { reservation: 'CANCELLED' },
        });
        configureMail();
        const fake = fakeTransport(() => {});
        const result = await processDueJobs({ now: morning, transport: fake.transport });
        assert.equal(result.sent, 2, 'week reminder and digest');
        assert.equal(
          (await row(tomorrow.id)).status,
          'EXPIRED',
          'no reminder for a cancelled event',
        );
        assert.ok(fake.sent.some((message) => message.to === 'staff@example.test'));
        clearMail();
      });

      await t.test('admin overview and health expose masked data and counts only', async () => {
        await addJob('test:masked', new Date(), { recipient: 'juan@gmail.com' });
        const overview = await readAutomationOverview(null);
        assert.equal(overview.emailConfigured, false);
        assert.deepEqual(overview.staffRecipients, { source: 'none', masked: [] });
        assert.ok(overview.jobs.some((job) => job.recipient === 'j***@gmail.com'));
        assert.ok(!JSON.stringify(overview).includes('juan@gmail.com'));
        assert.ok(!JSON.stringify(overview).includes('week@example.test'));
        assert.equal(
          overview.counts.ACCEPTED,
          await prisma.adminOutbox.count({ where: { status: 'ACCEPTED' } }),
        );
        const failedOnly = await readAutomationOverview('REVIEW_REQUIRED');
        assert.ok(failedOnly.jobs.every((job) => job.status === 'REVIEW_REQUIRED'));
        const health = await readAutomationHealth();
        assert.deepEqual(Object.keys(health).sort(), [
          'cronConfigured',
          'emailConfigured',
          'failed',
          'queued',
        ]);
        const { GET } = await import('../../app/api/health/route');
        const response = await GET();
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.automation.emailConfigured, false);
        assert.equal(typeof body.automation.queued, 'number');
        assert.ok(!JSON.stringify(body).includes('@'));
      });

      await t.test(
        'the cron route requires the exact bearer secret and returns counts only',
        async () => {
          const { GET, POST } = await import('../../app/api/cron/automation/route');
          const call = (authorization?: string, method = 'GET') =>
            (method === 'POST' ? POST : GET)(
              new Request('http://localhost/api/cron/automation', {
                method,
                headers: authorization ? { authorization } : {},
              }),
            );
          clearMail();
          assert.equal((await call('Bearer anything')).status, 401, 'no secret configured');
          process.env.CRON_SECRET = 'too-short-secret';
          assert.equal(
            (await call('Bearer too-short-secret')).status,
            401,
            'weak secrets are refused',
          );
          const secret = randomBytes(32).toString('hex');
          process.env.CRON_SECRET = secret;
          for (const header of [
            undefined,
            `Bearer ${secret}x`,
            `bearer ${secret}`,
            secret,
            `Bearer  ${secret}`,
          ])
            assert.equal((await call(header)).status, 401);
          const response = await call(`Bearer ${secret}`);
          assert.equal(response.status, 200);
          assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
          const body = await response.json();
          assert.equal(body.ok, true);
          assert.equal(body.delivery.mailConfigured, false);
          assert.ok(!JSON.stringify(body).includes('@'), 'no addresses in the cron response');
          assert.equal((await call(`Bearer ${secret}`, 'POST')).status, 200);
          assert.ok(await prisma.automationState.findUnique({ where: { key: 'last-run' } }));
          clearMail();
        },
      );
    } finally {
      globalThis.fetch = originalFetch;
      clearMail();
      await prisma.$disconnect();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    }
  },
);
