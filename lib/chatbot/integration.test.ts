import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';

test(
  'public chatbot HTTP handler respects publication, visibility, versioning, settings, and failures',
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
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
    await db.exec(readFileSync('prisma/receptionist.sql', 'utf8'));
    await db.exec("SET TIME ZONE 'Asia/Manila'");
    const server = createServer(db, { logLevel: LogLevel.Error });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    Object.assign(process.env, {
      DATABASE_URL: `postgresql://postgres@127.0.0.1:${address.port}/postgres`,
      DATABASE_POOL_MAX: '1',
      NODE_ENV: 'test',
      AUTH_SECRET: randomBytes(48).toString('hex'),
      RECEPTIONIST_STATE_KEY: randomBytes(32).toString('hex'),
      RECEPTIONIST_BOOKING_ORCHESTRATION_ENABLED: 'false',
    });
    const { prisma } = await import('../prisma');
    const { POST, GET, DELETE } = await import('../../app/api/client/chatbot/route');
    const { receptionistPool, findConversation, runConversationTurn } =
      await import('../../services/chatbot/state-store');
    const { publishedVisitorFaqs, visitorSources } = await import('../../services/chatbot/sources');
    const { DEFAULT_PUBLIC_SYSTEM_SETTINGS } = await import('../system-settings-types');
    async function ask(question: string, origin = 'http://localhost:3001') {
      return POST(
        new Request('http://localhost:3001/api/client/chatbot', {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        }),
      );
    }
    try {
      assert.equal((await ask('Hi', 'https://evil.test')).status, 403);
      const first = await ask('Where are you located?');
      assert.equal(first.status, 200);
      assert.equal(first.headers.get('Cache-Control'), 'no-store');
      assert.match(JSON.stringify(await first.json()), /San Pedro/);
      assert.equal((await publishedVisitorFaqs()).length, 6);
      await prisma.eventCategory.create({
        data: {
          id: 'category',
          categoryKey: 'wedding',
          name: 'Wedding',
          slug: 'wedding-reception',
          updatedAt: new Date(),
        },
      });
      await prisma.package.create({
        data: {
          id: 'package',
          eventCategoryId: 'category',
          packageName: 'DRAFT NAME',
          slug: 'classic',
          price: 999999,
          internalNotes: 'PRIVATE PACKAGE NOTE',
          currentVersion: 1,
        },
      });
      await prisma.packageVersion.create({
        data: {
          packageId: 'package',
          versionNumber: 1,
          snapshotData: {
            packageName: 'Classic',
            price: 90000,
            currency: 'PHP',
            paxIncluded: 100,
            description: 'Reviewed package',
            inclusions: [{ inclusionName: 'Tables', description: 'Included tables' }],
            internalNotes: 'PRIVATE SNAPSHOT NOTE',
          },
        },
      });
      await prisma.packageVersion.create({
        data: {
          packageId: 'package',
          versionNumber: 2,
          snapshotData: { packageName: 'DRAFT PACKAGE', price: 888888 },
        },
      });
      const packageAnswer = JSON.stringify(await (await ask('Wedding package price')).json());
      assert.match(packageAnswer, /90,000/);
      assert.doesNotMatch(packageAnswer, /999999|888888|DRAFT|PRIVATE/);
      await prisma.adminPolicy.create({
        data: {
          id: 'venue',
          reviewed: false,
          cashInstructions: 'PRIVATE CASH NOTE',
          contractTerms: 'PRIVATE CONTRACT',
          updatedBy: 'PRIVATE STAFF',
        },
      });
      assert.equal(
        (await visitorSources(DEFAULT_PUBLIC_SYSTEM_SETTINGS)).some(
          (source) => source.id === 'reviewed-payment-rule',
        ),
        false,
      );
      await prisma.adminPolicy.update({ where: { id: 'venue' }, data: { reviewed: true } });
      const reviewedSources = await visitorSources(DEFAULT_PUBLIC_SYSTEM_SETTINGS);
      assert.match(
        reviewedSources.find((source) => source.id === 'reviewed-payment-rule')?.text ?? '',
        /requires a deposit/,
      );
      assert.doesNotMatch(
        JSON.stringify(reviewedSources),
        /PRIVATE CASH|PRIVATE CONTRACT|PRIVATE STAFF/,
      );
      const faq = await prisma.supportFaqEntry.create({
        data: {
          question: 'DRAFT QUESTION',
          answer: 'PRIVATE DRAFT ANSWER',
          internalNotes: 'PRIVATE FAQ NOTE',
        },
      });
      const published = await prisma.supportFaqVersion.create({
        data: {
          faqEntryId: faq.id,
          question: 'Is parking included?',
          answer: 'Published parking answer.',
          publicationStatus: 'PUBLISHED',
          publishedAt: new Date(Date.now() - 10000),
          clientVisible: true,
          versionNumber: 1,
        },
      });
      await prisma.supportFaqEntry.update({
        where: { id: faq.id },
        data: { currentPublishedVersionId: published.id },
      });
      assert.deepEqual(
        (await publishedVisitorFaqs()).map((entry) => entry.answer),
        ['Published parking answer.'],
      );
      const answer = JSON.stringify(await (await ask('Parking')).json());
      assert.match(answer, /Published parking answer/);
      assert.doesNotMatch(answer, /PRIVATE|DRAFT/);
      for (const data of [
        { expiresAt: new Date(Date.now() - 1000) },
        { expiresAt: null, publishedAt: new Date(Date.now() + 60000) },
        { publishedAt: new Date(Date.now() - 10000), clientVisible: false },
        { clientVisible: true, publicationStatus: 'DRAFT' as const },
      ]) {
        await prisma.supportFaqVersion.update({ where: { id: published.id }, data });
        assert.equal((await publishedVisitorFaqs()).length, 0, JSON.stringify(data));
      }
      await prisma.supportFaqVersion.update({
        where: { id: published.id },
        data: { publicationStatus: 'PUBLISHED' },
      });
      await prisma.supportFaqEntry.update({ where: { id: faq.id }, data: { status: 'HIDDEN' } });
      assert.equal((await publishedVisitorFaqs()).length, 0);
      await prisma.package.update({ where: { id: 'package' }, data: { clientVisible: false } });
      assert.ok(
        (await visitorSources(DEFAULT_PUBLIC_SYSTEM_SETTINGS)).every(
          (source) => source.kind !== 'package',
        ),
      );
      await prisma.package.update({ where: { id: 'package' }, data: { clientVisible: true } });
      await prisma.eventCategory.update({
        where: { id: 'category' },
        data: { clientVisible: false },
      });
      assert.ok(
        (await visitorSources(DEFAULT_PUBLIC_SYSTEM_SETTINGS)).every(
          (source) => source.kind !== 'package',
        ),
      );
      await prisma.systemSetting.create({
        data: {
          id: 'singleton',
          settings: { client: { packagesVisible: false, faqVisible: false } },
        },
      });
      assert.equal((await (await ask('Wedding package price')).json()).kind, 'handoff');
      await prisma.systemSetting.update({
        where: { id: 'singleton' },
        data: {
          settings: {
            client: { maintenanceMode: true, disabledMessage: 'Please contact the venue.' },
          },
        },
      });
      assert.equal((await ask('Location')).status, 503);
      await prisma.systemSetting.deleteMany();
      // Fresh anonymous sessions share memory only through their own opaque cookie.
      await prisma.eventCategory.update({
        where: { id: 'category' },
        data: { clientVisible: true },
      });
      function visitor() {
        let cookie = '';
        let revision: number | undefined;
        return {
          get cookie() {
            return cookie;
          },
          request(method = 'GET') {
            return new Request('http://localhost:3001/api/client/chatbot', {
              method,
              headers: { Origin: 'http://localhost:3001', Cookie: cookie },
            });
          },
          async say(
            question: string,
            action?: { type: string; value?: string },
            turnId = randomUUID(),
            expectedRevision = revision,
          ) {
            const request = new Request('http://localhost:3001/api/client/chatbot', {
              method: 'POST',
              headers: {
                Origin: 'http://localhost:3001',
                'Content-Type': 'application/json',
                Cookie: cookie,
              },
              body: JSON.stringify({ question, turnId, expectedRevision, action }),
            });
            const response = await POST(request);
            const setCookie = response.headers.get('set-cookie');
            if (setCookie) cookie = setCookie.split(';')[0];
            const payload = await response.json();
            if (payload.context) revision = payload.context.revision;
            return { response, payload, request };
          },
        };
      }
      const alice = visitor();
      const bob = visitor();
      await alice.say('My name is Alice Santos, alice@example.test.');
      await bob.say('My name is Bob Cruz, bob@example.test.');
      const aliceResume = await (await GET(alice.request())).json();
      const bobResume = await (await GET(bob.request())).json();
      assert.equal(aliceResume.reply.context.name, 'Alice Santos');
      assert.equal(bobResume.reply.context.name, 'Bob Cruz');
      assert.doesNotMatch(JSON.stringify(aliceResume), /bob@example|Bob Cruz/);
      const rawStored = await receptionistPool.query<{
        encrypted_state: string;
        token_hash: string;
      }>('SELECT encrypted_state,token_hash FROM zion_receptionist_conversations');
      assert.doesNotMatch(JSON.stringify(rawStored.rows), /alice@example|Alice Santos|Bob Cruz/);
      assert.ok(rawStored.rows.every((row) => /^[a-f0-9]{64}$/.test(row.token_hash)));
      const protectedTables = await db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM pg_class WHERE relname IN ('zion_receptionist_conversations','zion_receptionist_requests') AND relrowsecurity=true",
      );
      assert.equal(protectedTables.rows[0].count, 2);
      assert.equal(
        (
          await db.query<{ allowed: boolean }>(
            "SELECT has_table_privilege('anon','zion_receptionist_conversations','SELECT') AS allowed",
          )
        ).rows[0].allowed,
        false,
      );

      const oldRevision = aliceResume.reply.context.revision;
      await alice.say('Where are you located?');
      assert.equal(
        (await alice.say('Visiting hours', undefined, randomUUID(), oldRevision)).response.status,
        409,
      );
      const human = visitor();
      await human.say('I would like a human');
      await human.say('Maria Santos');
      await human.say('maria@example.test');
      await human.say('Is your email office@zion.example and your phone 09987654321?');
      await human.say('I want a person', { type: 'request_human' });
      assert.equal(await prisma.inquiry.count(), 0);
      const escalationTurn = randomUUID();
      const submitted = await human.say(
        'Send inquiry to the team',
        { type: 'confirm_escalation' },
        escalationTurn,
      );
      assert.equal(submitted.response.status, 200);
      assert.match(submitted.payload.message, /saved in the Zion staff inbox/);
      const repeated = await human.say(
        'Send inquiry to the team',
        { type: 'confirm_escalation' },
        escalationTurn,
      );
      assert.equal(repeated.response.status, 200);
      assert.equal(await prisma.inquiry.count(), 1);
      assert.equal(await prisma.notification.count({ where: { source: 'zeni_receptionist' } }), 1);
      const inquiry = await prisma.inquiry.findFirst({
        where: { sourcePage: 'zeni_receptionist' },
      });
      assert.equal(inquiry?.status, 'NEW');
      assert.equal(inquiry?.email, 'maria@example.test');
      assert.notEqual(inquiry?.phoneNumber, '09987654321');
      assert.match(inquiry?.message ?? '', /explicitly consented/);
      assert.equal((await DELETE(human.request('DELETE'))).status, 200);
      assert.equal((await (await GET(human.request())).json()).reply, null);
      assert.equal(await prisma.inquiry.count(), 1);

      const booker = visitor();
      const ready = await booker.say(
        'Book a wedding Classic for 100 guests at Selah Hall on 2099-12-24 at 14:00 to 19:00. My name is Juan Cruz, juan@example.test.',
      );
      assert.equal(ready.payload.context.awaiting, 'terms');
      await booker.say('I acknowledge the published terms', { type: 'accept_terms' });
      const bookingTurn = randomUUID();
      const unavailable = await booker.say(
        'Send my request',
        { type: 'confirm_handoff' },
        bookingTurn,
      );
      assert.equal(unavailable.response.status, 200);
      assert.match(unavailable.payload.message, /not connected/);
      assert.equal(unavailable.payload.context.status, 'failed');
      const replay = await booker.say('Send my request', { type: 'confirm_handoff' }, bookingTurn);
      assert.equal(replay.response.status, 200);
      assert.equal(await prisma.adminBooking.count(), 0);
      const requests = await receptionistPool.query(
        'SELECT encrypted_request FROM zion_receptionist_requests',
      );
      assert.equal(requests.rows.length, 1);
      assert.doesNotMatch(JSON.stringify(requests.rows), /juan@example|Juan Cruz/);

      const availability = visitor();
      await availability.say('My name is Private Person, private@example.test.');
      await availability.say('Is Selah Hall available on 2099-12-24 at 14:00 to 19:00?');
      const checked = await availability.say('Check this schedule', { type: 'confirm_handoff' });
      assert.equal(checked.payload.context.status, 'available');
      assert.match(checked.payload.message, /admin calendar has no confirmed conflict/);
      const savedAvailability = await findConversation(availability.request());
      assert.ok(savedAvailability);
      const ledger = await receptionistPool.query<{
        request_id: string;
        encrypted_request: string;
      }>(
        'SELECT request_id,encrypted_request FROM zion_receptionist_requests WHERE conversation_id=$1',
        [savedAvailability.state.id],
      );
      const { openConversation } = await import('./session-security');
      const requestBody = openConversation(
        ledger.rows[0].encrypted_request,
        `request:${ledger.rows[0].request_id}`,
      ) as Record<string, unknown>;
      assert.equal(requestBody.intent, 'availability_check');
      assert.equal('client' in requestBody, false);
      assert.doesNotMatch(JSON.stringify(requestBody), /Private Person|private@example/);

      await prisma.adminBooking.create({
        data: {
          id: 'private-calendar-event',
          reference: 'PRIVATE-BOOKING-REFERENCE',
          clientName: 'PRIVATE CALENDAR CLIENT',
          email: 'private-calendar@example.test',
          phone: '09123456789',
          eventType: 'Wedding',
          packageName: 'PRIVATE PACKAGE',
          venue: 'Zion Events Place',
          startsAt: new Date('2099-12-24T06:00:00Z'),
          endsAt: new Date('2099-12-24T11:00:00Z'),
          guests: 100,
          totalCents: 9000000,
          depositCents: 3000000,
          paymentRule: 'DEPOSIT_REQUIRED',
          policyVersion: 1,
          createdBy: 'PRIVATE STAFF',
          updatedBy: 'PRIVATE STAFF',
          reservation: 'CONFIRMED',
          notes: 'PRIVATE CALENDAR NOTE',
        },
      });
      const blocked = visitor();
      await blocked.say('Is Pavilion Garden available on 2099-12-24 at 14:00 to 19:00?');
      const conflict = await blocked.say('Check this schedule', { type: 'confirm_handoff' });
      assert.equal(conflict.payload.context.status, 'unavailable');
      assert.doesNotMatch(
        JSON.stringify(conflict.payload),
        /PRIVATE|private-calendar|30,000|90,000/,
      );
      const adjacent = visitor();
      await adjacent.say('Is the pool available on 2099-12-24 at 19:00 to 21:00?');
      assert.equal(
        (await adjacent.say('Check this schedule', { type: 'confirm_handoff' })).payload.context
          .status,
        'available',
      );

      // The real encrypted request ledger owns retry/lease decisions, independent of transport mocks.
      const { bookingRequestLedger } = await import('../../services/chatbot/request-ledger');
      const { receptionistBookingRequestSchema } =
        await import('../../services/orchestration/receptionist-booking.contract');
      const canonical = receptionistBookingRequestSchema.parse(requestBody);
      const requestFingerprint = createHash('sha256')
        .update(JSON.stringify(canonical))
        .digest('hex');
      const acquisition = {
        request: canonical,
        requestFingerprint,
        leaseMs: 30000,
        maxAttempts: 2,
      };
      const lease = await bookingRequestLedger.acquire(acquisition);
      assert.equal(lease.kind, 'acquired');
      if (lease.kind !== 'acquired') throw new Error('Expected request lease.');
      assert.equal((await bookingRequestLedger.acquire(acquisition)).kind, 'busy');
      assert.equal(
        (await bookingRequestLedger.acquire({ ...acquisition, requestFingerprint: 'incorrect' }))
          .kind,
        'conflict',
      );
      const result = {
        schemaVersion: canonical.schemaVersion,
        requestId: canonical.requestId,
        conversationId: canonical.conversationId,
        turnId: canonical.turnId,
        stateRevision: canonical.stateRevision,
        respondedAt: new Date().toISOString(),
        provenance: {
          source: 'orchestration_adapter' as const,
          authoritative: false,
          observedAt: new Date().toISOString(),
        },
        status: 'ERROR' as const,
        errorCode: 'NOT_CONFIGURED' as const,
        retryable: false,
      };
      const completion = {
        requestId: canonical.requestId,
        requestFingerprint,
        leaseToken: lease.leaseToken,
        result,
      };
      await assert.rejects(
        bookingRequestLedger.complete({ ...completion, leaseToken: randomUUID() }),
        /no longer owned/,
      );
      await bookingRequestLedger.fail({ ...completion, retryAt: new Date(Date.now() + 30000) });
      assert.equal((await bookingRequestLedger.acquire(acquisition)).kind, 'busy');
      await receptionistPool.query(
        "UPDATE zion_receptionist_requests SET retry_at=now()-interval '1 second' WHERE request_id=$1",
        [canonical.requestId],
      );
      const retryLease = await bookingRequestLedger.acquire(acquisition);
      assert.equal(retryLease.kind, 'acquired');
      if (retryLease.kind !== 'acquired') throw new Error('Expected retry lease.');
      assert.equal(retryLease.attempt, 2);
      await bookingRequestLedger.complete({ ...completion, leaseToken: retryLease.leaseToken });
      assert.equal((await bookingRequestLedger.acquire(acquisition)).kind, 'replay');

      // A failed turn retains its original identity and encrypted recovery command.
      const interrupted = visitor();
      await interrupted.say('Hello');
      const savedInterrupted = await findConversation(interrupted.request());
      assert.ok(savedInterrupted);
      const recoveryId = randomUUID();
      await assert.rejects(
        runConversationTurn(
          savedInterrupted.session,
          {
            turnId: recoveryId,
            fingerprint: 'recovery',
            recovery: { question: 'Original question', turnId: recoveryId },
          },
          async () => {
            throw new Error('Simulated worker interruption');
          },
        ),
      );
      assert.equal((await (await GET(interrupted.request())).json()).retry.turnId, recoveryId);
      await assert.rejects(
        runConversationTurn(
          savedInterrupted.session,
          { turnId: randomUUID(), fingerprint: 'different' },
          async () => ({ kind: 'greeting', message: 'Wrong.', sources: [], suggestions: [] }),
        ),
        /interrupted/,
      );
      await runConversationTurn(
        savedInterrupted.session,
        { turnId: recoveryId, fingerprint: 'recovery' },
        async () => ({
          kind: 'greeting',
          message: 'Recovered once.',
          sources: [],
          suggestions: [],
        }),
      );
      assert.equal((await (await GET(interrupted.request())).json()).retry, undefined);

      const expiryTurn = randomUUID();
      let expiryExecutions = 0;
      const expiredReply = await runConversationTurn(
        savedInterrupted.session,
        { turnId: expiryTurn, fingerprint: 'expired-result' },
        async (state) => {
          expiryExecutions++;
          state.booking.status = 'available';
          state.booking.intent = 'availability_check';
          state.booking.resultObservedAt = new Date(Date.now() - 600000).toISOString();
          state.booking.resultExpiresAt = new Date(Date.now() - 1000).toISOString();
          return {
            kind: 'booking',
            message: 'A previous operational snapshot.',
            sources: [],
            suggestions: [],
          };
        },
      );
      assert.equal(expiredReply.kind, 'booking');
      const expiredReplay = await runConversationTurn(
        savedInterrupted.session,
        { turnId: expiryTurn, fingerprint: 'expired-result' },
        async () => {
          expiryExecutions++;
          throw new Error('A replay must not execute again.');
        },
      );
      assert.match(expiredReplay.message, /result has expired/);
      assert.equal(expiryExecutions, 1);
      assert.equal(expiredReplay.context?.status, 'stale');
      const staleRestore = await (await GET(interrupted.request())).json();
      assert.equal(staleRestore.reply.context.status, 'stale');
      assert.equal(staleRestore.reply.context.previousStatus, 'available');
      assert.match(staleRestore.reply.message, /previous result needs a fresh check/);
      assert.equal(staleRestore.reply.actions[0].type, 'check_availability');

      const sensitive = visitor();
      await sensitive.say('My card number is 4111111111111111');
      const sensitiveState = await findConversation(sensitive.request());
      assert.ok(sensitiveState);
      assert.doesNotMatch(JSON.stringify(sensitiveState), /4111111111111111/);

      // A durable lease blocks a second turn without duplicating a side effect.
      const savedAlice = await findConversation(alice.request());
      assert.ok(savedAlice);
      let unlock: () => void = () => {};
      let started: () => void = () => {};
      const began = new Promise<void>((resolve) => {
        started = resolve;
      });
      const waiting = new Promise<void>((resolve) => {
        unlock = resolve;
      });
      const firstTurn = runConversationTurn(
        savedAlice.session,
        { turnId: randomUUID(), fingerprint: 'first' },
        async () => {
          started();
          await waiting;
          return { kind: 'greeting', message: 'Done.', sources: [], suggestions: [] };
        },
      );
      await began;
      await assert.rejects(
        runConversationTurn(
          savedAlice.session,
          { turnId: randomUUID(), fingerprint: 'second' },
          async () => ({ kind: 'greeting', message: 'Wrong.', sources: [], suggestions: [] }),
        ),
        /still being processed/,
      );
      unlock();
      await firstTurn;
      await receptionistPool.query(
        "UPDATE zion_receptionist_conversations SET expires_at=now()-interval '1 second' WHERE id=$1",
        [savedAlice.state.id],
      );
      const expired = await GET(alice.request());
      assert.equal((await expired.json()).reply, null);
      assert.match(expired.headers.get('set-cookie') ?? '', /Max-Age=0/);

      await db.exec('DROP TABLE support_faq_entries CASCADE');
      const storageFailure = await ask('Parking');
      assert.equal(storageFailure.status, 503);
      assert.doesNotMatch(
        JSON.stringify(await storageFailure.json()),
        /SELECT|support_faq|postgres|PRIVATE/,
      );
    } finally {
      await prisma.$disconnect();
      await receptionistPool.end();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    }
  },
);
