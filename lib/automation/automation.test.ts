import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';
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
          const startsAt = new Date(Date.now() + 20 * 86_400_000);
          const booking = (bookingEmail: string) => ({
            op: 'create-booking',
            booking: {
              clientName: 'Calendar Client',
              email: bookingEmail,
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
          });
          const act = async (id: string, action: string) => {
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
          const { id } = (await adminMutate(booking('calendar@example.test'), owner)) as {
            id: string;
          };
          await act(id, 'VERIFY');
          await act(id, 'APPROVE');
          const confirmed = await act(id, 'CONFIRM');
          const request = await prisma.adminOutbox.findFirstOrThrow({
            where: { bookingId: id, event: 'RESERVATION_CONFIRMED' },
          });
          assert.equal(request.calendarMethod, 'REQUEST');
          assert.match(
            request.calendar ?? '',
            new RegExp(`\\r\\nSEQUENCE:${confirmed.revision}\\r\\n`),
          );
          assert.match(request.body, /calendar invitation \(invite\.ics\) is attached/);
          const cancelled = await act(id, 'CANCEL');
          assert.ok(cancelled.revision > confirmed.revision);
          const cancel = await prisma.adminOutbox.findFirstOrThrow({
            where: { bookingId: id, event: 'CANCEL' },
          });
          const uid = (calendar: string | null) => calendar?.match(/\r\nUID:([^\r]+)/)?.[1];
          assert.equal(cancel.calendarMethod, 'CANCEL');
          assert.equal(uid(cancel.calendar), uid(request.calendar));
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

          const { id: unconfirmed } = (await adminMutate(
            booking('requested@example.test'),
            owner,
          )) as { id: string };
          await act(unconfirmed, 'CANCEL');
          const plainCancel = await prisma.adminOutbox.findFirstOrThrow({
            where: { bookingId: unconfirmed, event: 'CANCEL' },
          });
          assert.equal(plainCancel.calendar, null, 'no invite was sent, so no cancellation update');
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
        assert.match(digest.body, /Requests awaiting approval: \d+/);
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
