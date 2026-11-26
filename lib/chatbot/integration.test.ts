import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';
import type { ChatSource } from './types';

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
    // The installer is idempotent: running it again keeps tables and rows.
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
      // Never call the language model from tests, even if the shell has a key.
      ZENI_LLM_ENABLED: 'false',
    });
    const { prisma } = await import('../prisma');
    const { POST, GET, DELETE } = await import('../../app/api/client/chatbot/route');
    const { receptionistPool, findConversation, runConversationTurn } =
      await import('../../services/chatbot/state-store');
    const { publishedVisitorFaqs, visitorSources } = await import('../../services/chatbot/sources');
    const { listOpenZeniGaps, resolveZeniGapGroup } = await import('../../services/chatbot/gaps');
    const { previewReceptionistTurn } = await import('../../services/chatbot/receptionist');
    const { zeniAdminOverview } = await import('../../services/chatbot/admin-overview');
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
      const packageReply = await (await ask('Wedding package price')).json();
      const packageAnswer = JSON.stringify(packageReply);
      assert.match(packageAnswer, /90,000/);
      assert.doesNotMatch(packageAnswer, /999999|888888|DRAFT|PRIVATE/);
      // The card's "starts at" price comes only from the published package version.
      assert.ok(
        packageReply.cards.some(
          (card: { startsAt?: string }) => card.startsAt === 'Starts at ₱90,000',
        ),
      );
      assert.ok(
        packageReply.links.some((link: { href: string }) => link.href.startsWith('/booking?')),
      );
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
      // A hidden catalog package (or its hidden category) never reaches Zeni. The package
      // booklets on the event pages are page content with no catalog price, so they stay.
      const catalogPackage = (source: ChatSource) =>
        source.kind === 'package' && !source.id.startsWith('booklet:');
      await prisma.package.update({ where: { id: 'package' }, data: { clientVisible: false } });
      assert.ok(!(await visitorSources(DEFAULT_PUBLIC_SYSTEM_SETTINGS)).some(catalogPackage));
      await prisma.package.update({ where: { id: 'package' }, data: { clientVisible: true } });
      await prisma.eventCategory.update({
        where: { id: 'category' },
        data: { clientVisible: false },
      });
      assert.ok(!(await visitorSources(DEFAULT_PUBLIC_SYSTEM_SETTINGS)).some(catalogPackage));
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
        "SELECT count(*)::int AS count FROM pg_class WHERE relname IN ('zion_receptionist_conversations','zion_zeni_gaps') AND relrowsecurity=true",
      );
      assert.equal(protectedTables.rows[0].count, 2);
      for (const table of ['zion_receptionist_conversations', 'zion_zeni_gaps'])
        for (const role of ['anon', 'authenticated'])
          assert.equal(
            (
              await db.query<{ allowed: boolean }>(
                `SELECT has_table_privilege('${role}','${table}','SELECT') AS allowed`,
              )
            ).rows[0].allowed,
            false,
            `${role} on ${table}`,
          );

      const oldRevision = aliceResume.reply.context.revision;
      await alice.say('Where are you located?');
      assert.equal(
        (await alice.say('Visiting hours', undefined, randomUUID(), oldRevision)).response.status,
        409,
      );
      // A Taglish guest gets errors in Taglish too.
      const taglishConflict = await alice.say(
        'Saan po kayo?',
        undefined,
        randomUUID(),
        oldRevision,
      );
      assert.equal(taglishConflict.response.status, 409);
      assert.match(taglishConflict.payload.error, /po/);

      const human = visitor();
      await human.say('I would like a human');
      await human.say('Maria Santos');
      await human.say('maria@example.test');
      await human.say('Is your email office@zion.example and your phone 09987654321?');
      await human.say('I want a person', { type: 'request_human' });
      assert.equal(await prisma.inquiry.count(), 0);
      const escalationTurn = randomUUID();
      const submitted = await human.say(
        'Send to staff',
        { type: 'confirm_escalation' },
        escalationTurn,
      );
      assert.equal(submitted.response.status, 200);
      assert.match(submitted.payload.message, /staff inbox/);
      const repeated = await human.say(
        'Send to staff',
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
      // The staff alert and the visitor acknowledgement are queued with the inquiry.
      assert.equal(
        await prisma.adminOutbox.count({
          where: { event: { in: ['INQUIRY_STAFF_ALERT', 'INQUIRY_ACKNOWLEDGEMENT'] } },
        }),
        2,
      );
      assert.equal((await DELETE(human.request('DELETE'))).status, 200);
      assert.equal((await (await GET(human.request())).json()).reply, null);
      assert.equal(await prisma.inquiry.count(), 1);

      // A new booking never submits anything: it offers a pre-filled booking link.
      const booker = visitor();
      const booking = await booker.say('I would like to book a wedding for 100 guests');
      assert.equal(booking.payload.kind, 'booking');
      assert.ok(
        booking.payload.links.some(
          (link: { href: string }) => link.href === '/booking?event=wedding&guests=100&source=zeni',
        ),
      );
      const calendarCard = booking.payload.cards.find(
        (card: { type: string }) => card.type === 'calendar',
      );
      assert.ok(calendarCard);
      assert.deepEqual(calendarCard.unavailable, []);
      assert.equal(await prisma.adminBooking.count(), 0);

      const availability = visitor();
      await availability.say('My name is Private Person, private@example.test.');
      const checked = await availability.say(
        'Is Selah Hall available on 2099-12-24 at 14:00 to 19:00?',
      );
      assert.equal(checked.payload.kind, 'availability');
      assert.equal(checked.payload.context.status, 'available');
      assert.match(checked.payload.message, /no confirmed event/);
      assert.ok(
        checked.payload.links.some(
          (link: { href: string; primary?: boolean }) =>
            link.primary && /date=2099-12-24&start=14%3A00&end=19%3A00/.test(link.href),
        ),
      );
      assert.doesNotMatch(JSON.stringify(checked.payload.links), /Private|private@example/);

      const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
      soon.setUTCHours(6, 0, 0, 0);
      for (const [id, startsAt, endsAt] of [
        ['private-calendar-event', '2099-12-24T06:00:00Z', '2099-12-24T11:00:00Z'],
        [
          'private-soon-event',
          soon.toISOString(),
          new Date(soon.getTime() + 5 * 3600000).toISOString(),
        ],
      ])
        await prisma.adminBooking.create({
          data: {
            id,
            reference: `PRIVATE-BOOKING-REFERENCE-${id}`,
            clientName: 'PRIVATE CALENDAR CLIENT',
            email: 'private-calendar@example.test',
            phone: '09123456789',
            eventType: 'Wedding',
            packageName: 'PRIVATE PACKAGE',
            venue: 'Zion Events Place',
            startsAt: new Date(startsAt),
            endsAt: new Date(endsAt),
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
      const conflict = await blocked.say(
        'Is Pavilion Garden available on 2099-12-24 at 14:00 to 19:00?',
      );
      assert.equal(conflict.payload.context.status, 'unavailable');
      assert.match(conflict.payload.message, /confirmed event/);
      assert.doesNotMatch(
        JSON.stringify(conflict.payload),
        /PRIVATE|private-calendar|private-soon|30,000|90,000/,
      );
      const card = conflict.payload.cards.find(
        (item: { type: string }) => item.type === 'calendar',
      );
      const soonKey = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(soon);
      assert.deepEqual(card.unavailable, [soonKey]);
      assert.equal(card.selected, '2099-12-24');
      const adjacent = visitor();
      assert.equal(
        (await adjacent.say('Is the pool available on 2099-12-24 at 19:00 to 21:00?')).payload
          .context.status,
        'available',
      );
      // Without a remembered time window, tapping a calendar date checks the whole day.
      const tapped = await visitor().say('Check December 24, 2099', {
        type: 'check_availability',
        value: '2099-12-24',
      });
      assert.equal(tapped.payload.context.status, 'unavailable');

      // Unanswered questions are logged once per conversation, without personal details.
      const curious = visitor();
      const question =
        "Can we fly drones over the venue? I'm Maria Santos, maria@example.test, 0917 123 4567";
      const gapReply = await curious.say(question);
      assert.equal(gapReply.payload.kind, 'handoff');
      await curious.say(question);
      const gaps = await receptionistPool.query<{ question: string; reason: string }>(
        'SELECT question, reason, language FROM zion_zeni_gaps WHERE reason=$1',
        ['no_source'],
      );
      const drones = gaps.rows.filter((row) => /drones/.test(row.question));
      assert.equal(drones.length, 1);
      assert.doesNotMatch(drones[0].question, /Maria|Santos|maria@example|0917/);
      const open = await listOpenZeniGaps();
      assert.equal(open.available, true);
      const group = open.open.find((item) => /drones/.test(item.question));
      assert.ok(group);
      assert.ok(group.reasons.includes('no_source'));
      assert.equal(await resolveZeniGapGroup(group.hash, 'Test Admin'), 1);
      assert.equal(await resolveZeniGapGroup(group.hash, 'Test Admin'), 0);
      const afterResolve = await listOpenZeniGaps();
      assert.ok(afterResolve.open.every((item) => item.hash !== group.hash));
      assert.ok(afterResolve.resolvedLast30Days >= 1);

      // The admin test console runs the pipeline without storing anything.
      const conversationsBefore = await receptionistPool.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM zion_receptionist_conversations',
      );
      const gapsBefore = await receptionistPool.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM zion_zeni_gaps',
      );
      const previewSources = await visitorSources(DEFAULT_PUBLIC_SYSTEM_SETTINGS);
      const preview = await previewReceptionistTurn(
        'What are your visiting hours?',
        previewSources,
        DEFAULT_PUBLIC_SYSTEM_SETTINGS,
      );
      assert.equal(preview.reply.kind, 'answer');
      assert.equal(preview.diagnostics.llm.status, 'disabled');
      const unknown = await previewReceptionistTurn(
        'Do you rent hot air balloons?',
        previewSources,
        DEFAULT_PUBLIC_SYSTEM_SETTINGS,
      );
      assert.equal(unknown.diagnostics.gap?.reason, 'no_source');
      assert.deepEqual(
        (
          await receptionistPool.query<{ count: number }>(
            'SELECT count(*)::int AS count FROM zion_receptionist_conversations',
          )
        ).rows,
        conversationsBefore.rows,
      );
      assert.deepEqual(
        (
          await receptionistPool.query<{ count: number }>(
            'SELECT count(*)::int AS count FROM zion_zeni_gaps',
          )
        ).rows,
        gapsBefore.rows,
      );
      const overview = await zeniAdminOverview();
      assert.equal(overview.ai.enabled, false);
      assert.equal(overview.handoffs.total, 1);
      assert.deepEqual(
        overview.knowledge.map((item) => item.id),
        ['packages', 'booklets', 'faqs', 'facilities', 'policies'],
      );
      assert.equal(overview.knowledge[0].count, 1);
      assert.doesNotMatch(JSON.stringify(overview), /maria@example|Maria Santos|PRIVATE/);

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
          state.booking.dates = ['2099-12-24'];
          state.booking.resultObservedAt = new Date(Date.now() - 600000).toISOString();
          state.booking.resultExpiresAt = new Date(Date.now() - 1000).toISOString();
          return {
            kind: 'availability',
            message: 'A previous calendar snapshot.',
            sources: [],
            suggestions: [],
          };
        },
      );
      assert.equal(expiredReply.kind, 'availability');
      const expiredReplay = await runConversationTurn(
        savedInterrupted.session,
        { turnId: expiryTurn, fingerprint: 'expired-result' },
        async () => {
          expiryExecutions++;
          throw new Error('A replay must not execute again.');
        },
      );
      assert.match(expiredReplay.message, /expired/);
      assert.equal(expiryExecutions, 1);
      assert.equal(expiredReplay.context?.status, 'stale');
      assert.equal(expiredReplay.actions?.[0]?.value, '2099-12-24');
      const staleRestore = await (await GET(interrupted.request())).json();
      assert.equal(staleRestore.reply.context.status, 'stale');
      assert.equal(staleRestore.reply.context.previousStatus, 'available');
      assert.match(staleRestore.reply.message, /expired/);
      assert.equal(staleRestore.reply.actions[0].type, 'check_availability');

      const sensitive = visitor();
      await sensitive.say('My card number is 4111111111111111');
      const sensitiveState = await findConversation(sensitive.request());
      assert.ok(sensitiveState);
      assert.doesNotMatch(JSON.stringify(sensitiveState), /4111111111111111/);

      // A durable lease blocks a second turn without duplicating a side effect.
      const savedAlice = await findConversation(alice.request());
      assert.ok(savedAlice);
      assert.ok(savedAlice.state.recentTurns.length <= 6);
      assert.doesNotMatch(JSON.stringify(savedAlice.state.recentTurns), /alice@example/);
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
