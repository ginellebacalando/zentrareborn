import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Secret } from 'otpauth';
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';

test(
  'isolated developer authentication, publication, orchestration, and audit boundaries',
  { timeout: 180000 },
  async () => {
    const fixture = new PGlite();
    await fixture.waitReady;
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
    await fixture.exec(generated.slice(generated.indexOf('-- CreateSchema')));
    await fixture.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
    await fixture.exec(readFileSync('prisma/developer.sql', 'utf8'));
    const protectedTables = await fixture.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM pg_class WHERE relname LIKE 'zion_developer_%' AND relkind='r' AND relrowsecurity=true",
    );
    assert.equal(protectedTables.rows[0].count, 8);
    const anonymousAccess = await fixture.query<{ allowed: boolean }>(
      "SELECT has_table_privilege('anon','zion_developer_accounts','SELECT') AS allowed",
    );
    assert.equal(anonymousAccess.rows[0].allowed, false);
    const server = createServer(fixture, { logLevel: LogLevel.Error });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    Object.assign(process.env, {
      NODE_ENV: 'development',
      DATABASE_URL: `postgresql://postgres@127.0.0.1:${address.port}/postgres`,
      DEVELOPER_PANEL_ENABLED: 'true',
      DEVELOPER_ORIGIN: 'http://localhost:3012',
      DEVELOPER_EMAIL_ALLOWLIST: 'developer@example.test',
      DEVELOPER_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
      N8N_WEBHOOK_ENABLED: 'false',
      N8N_API_BASE_URL: '',
      N8N_API_KEY: '',
      DEVELOPER_LOCAL_ACCESS_ENABLED: 'false',
    });
    const { developerDb, rateLimit } = await import('./db');
    const { sealSecret, totpFor } = await import('./security');
    const {
      loginDeveloper,
      developerFromToken,
      consumeTotp,
      createLocalDeveloperSession,
      verifyDeveloperChange,
    } = await import('./auth');
    const {
      saveDocument,
      changeDocument,
      publishedKnowledge,
      previewKnowledge,
      reportKnowledgeGap,
    } = await import('../../services/developer/knowledge');
    const {
      saveContent,
      contentAction,
      listContent,
      saveFaq,
      faqAction,
      readFaqs,
      saveFaqCategory,
    } = await import('../../services/developer/content');
    const { mutateDeveloper, readOverview } = await import('../../services/developer/control');
    const { readOrchestrationSettings } =
      await import('../../services/orchestration/developer-settings');
    const { allowedWorkflows, approvedIntegrationUrl } =
      await import('../../services/developer/integrations');
    const id = randomUUID(),
      email = 'developer@example.test',
      password = 'Unique-isolated-developer-2026!',
      secret = new Secret({ size: 20 }).base32;
    const headers = new Headers();
    try {
      await developerDb.query(
        "INSERT INTO zion_developer_accounts (id,email,name,password_hash,totp_secret) VALUES ($1,$2,'Test Developer',$3,$4)",
        [
          id,
          email,
          await bcrypt.hash(password, 12),
          sealSecret(secret, Buffer.from(process.env.DEVELOPER_ENCRYPTION_KEY!, 'hex'), id),
        ],
      );
      for (const role of ['CLIENT', 'ADMIN', 'SUPERADMIN']) {
        await developerDb.query(
          'INSERT INTO users (id,username,email,role,status,"updatedAt") VALUES ($1,$2,$3,$4::"Role",\'ACTIVE\',now())',
          [role, role, `${role.toLowerCase()}@example.test`, role],
        );
        await assert.rejects(
          loginDeveloper(
            {
              email: `${role.toLowerCase()}@example.test`,
              password,
              code: totpFor(secret).generate(),
            },
            headers,
          ),
          /Sign-in failed/,
        );
      }
      await assert.rejects(
        loginDeveloper({ email, password, code: '' }, headers),
        /Sign-in failed/,
      );
      const login = await loginDeveloper(
        { email, password, code: totpFor(secret).generate() },
        headers,
      );
      assert.ok(login.token.length >= 43);
      await assert.rejects(consumeTotp(id, totpFor(secret).generate()), /fresh|new authenticator/);
      const actor = await developerFromToken(login.token, headers);
      assert.ok(actor);
      assert.equal(actor.email, email);
      assert.equal(await developerFromToken('forged-cookie', headers), null);
      process.env.DEVELOPER_EMAIL_ALLOWLIST = 'someone-else@example.test';
      assert.equal(await developerFromToken(login.token, headers), null);
      process.env.DEVELOPER_EMAIL_ALLOWLIST = email;
      await developerDb.query(
        "UPDATE zion_developer_sessions SET last_seen_at=now()-interval '11 minutes' WHERE id=$1",
        [actor.sessionId],
      );
      assert.equal(await developerFromToken(login.token, headers), null);
      await developerDb.query('UPDATE zion_developer_sessions SET last_seen_at=now() WHERE id=$1', [
        actor.sessionId,
      ]);
      const draft = {
        kind: 'knowledge' as const,
        title: 'Venue opening hours',
        content: 'The verified venue tour hours are Monday through Friday, 9 AM to 5 PM.',
        source: 'Reviewed venue policy',
        revision: 0,
      };
      const created = await saveDocument(draft, actor);
      assert.equal((await publishedKnowledge()).documents.length, 0);
      await changeDocument(created.id, 1, 'publish', actor);
      let snapshot = await publishedKnowledge();
      assert.equal(snapshot.documents[0].content, draft.content);
      assert.equal(snapshot.documents[0].revision, 1);
      await saveDocument(
        {
          ...draft,
          id: created.id,
          revision: 1,
          content: 'Unpublished weekend hours should never appear in retrieval.',
        },
        actor,
      );
      snapshot = await publishedKnowledge();
      assert.equal(snapshot.documents[0].content, draft.content);
      await assert.rejects(
        saveDocument({ ...draft, id: created.id, revision: 1 }, actor),
        /changed/,
      );
      assert.equal((await previewKnowledge('venue opening hours')).matches.length, 1);
      await changeDocument(created.id, 2, 'archive', actor);
      assert.equal((await publishedKnowledge()).documents.length, 0);
      await changeDocument(created.id, 2, 'restore', actor, 1);
      assert.equal((await publishedKnowledge()).documents.length, 0);
      const template = await saveDocument(
        {
          kind: 'template',
          title: 'General event workflow',
          content: JSON.stringify({
            steps: [
              {
                title: 'Verify inquiry',
                description: 'Check the submitted inquiry',
                priority: 'high',
                assignedRole: 'ADMIN',
                required: true,
                dueOffsetDays: 0,
              },
            ],
          }),
          source: 'general',
          revision: 0,
        },
        actor,
      );
      await changeDocument(template.id, 1, 'publish', actor);
      assert.equal((await publishedKnowledge()).documents[0].kind, 'template');
      await assert.rejects(
        saveDocument(
          {
            kind: 'template',
            title: 'Invalid template',
            content: JSON.stringify({ steps: [{ title: 'bad' }] }),
            source: 'general',
            revision: 0,
          },
          actor,
        ),
        /checklist steps/,
      );
      await saveFaqCategory({ name: 'Venue', status: 'active', clientVisible: true }, actor);
      const category = (await readFaqs()).categories[0];
      await saveFaq(
        {
          question: 'What are the venue hours?',
          answer: 'Tours are available on weekdays from 9 AM to 5 PM.',
          categoryId: category.id,
          clientVisible: true,
          lock: null,
        },
        actor,
      );
      let faq = (await readFaqs()).faqs[0];
      assert.equal((await publishedKnowledge()).faqs.length, 0);
      await faqAction(faq.id, faq.lock, 'publish', actor);
      assert.equal(
        (await publishedKnowledge()).faqs[0].answer,
        'Tours are available on weekdays from 9 AM to 5 PM.',
      );
      faq = (await readFaqs()).faqs[0];
      await saveFaq(
        {
          id: faq.id,
          question: faq.question,
          answer: 'Unpublished hours',
          categoryId: null,
          clientVisible: false,
          lock: faq.lock,
        },
        actor,
      );
      assert.equal(
        (await publishedKnowledge()).faqs[0].answer,
        'Tours are available on weekdays from 9 AM to 5 PM.',
      );
      const savedFaqDraft = (await readFaqs()).faqs[0];
      assert.equal(savedFaqDraft.category_id, null);
      assert.equal(savedFaqDraft.client_visible, false);
      await saveFaqCategory(
        {
          id: category.id,
          name: 'Venue',
          status: 'hidden',
          clientVisible: true,
        },
        actor,
      );
      assert.equal((await publishedKnowledge()).faqs.length, 0);
      await saveContent(
        {
          type: 'ABOUT',
          title: 'About Zion',
          slug: 'about-zion',
          payload: {
            title: 'About Zion',
            blocks: [{ type: 'paragraph', text: 'Reviewed venue information.' }],
          },
          latestVersionId: null,
        },
        actor,
      );
      let item = (await listContent())[0];
      let v = item.versions[0];
      await assert.rejects(contentAction(item.id, v.id, 'publish', actor), /Approval/);
      await contentAction(item.id, v.id, 'review', actor);
      await contentAction(item.id, v.id, 'approve', actor);
      await contentAction(item.id, v.id, 'publish', actor);
      assert.equal((await publishedKnowledge()).content.length, 1);
      await contentAction(item.id, v.id, 'rollback', actor);
      item = (await listContent())[0];
      v = item.versions[0];
      assert.equal(v.status, 'DRAFT');
      assert.equal((await publishedKnowledge()).content.length, 1);
      await assert.rejects(
        saveContent(
          {
            type: 'ABOUT',
            title: 'bad link',
            slug: 'bad-link',
            payload: {
              title: 'bad',
              blocks: [{ type: 'link', label: 'bad', href: 'javascript:alert(1)' }],
            },
            latestVersionId: null,
          },
          actor,
        ),
        /validation/,
      );
      let settings = await readOrchestrationSettings();
      assert.equal(settings.value.inquiryEnabled, false);
      await mutateDeveloper(
        {
          op: 'settings',
          revision: 0,
          value: {
            inquiryEnabled: false,
            timeoutMs: 12000,
            maxAttempts: 3,
            retryBaseMs: 40000,
          },
          code: '',
        },
        actor,
      );
      settings = await readOrchestrationSettings();
      assert.equal(settings.value.timeoutMs, 12000);
      assert.equal(settings.revision, 1);
      await assert.rejects(
        mutateDeveloper({ op: 'settings', revision: 0, value: settings.value, code: '' }, actor),
        /changed/,
      );
      process.env.DEVELOPER_OUTBOUND_HOSTS = 'localhost';
      await assert.rejects(approvedIntegrationUrl('https://localhost'), /Private network/);
      process.env.N8N_DEVELOPER_WORKFLOW_IDS = 'workflow-one,../../admin';
      assert.deepEqual(allowedWorkflows(), ['workflow-one']);
      await assert.rejects(
        mutateDeveloper({ op: 'workflow', id: 'not-approved', active: true, code: '' }, actor),
        /not approved/,
      );
      await reportKnowledgeGap('pricing');
      await reportKnowledgeGap('pricing');
      const overview = await readOverview(actor);
      assert.equal(overview.review[0].occurrences, 2);
      assert.ok(overview.audit.length > 0);
      assert.ok(!JSON.stringify(overview).includes(secret));
      assert.ok(!JSON.stringify(overview).includes(password));
      await rateLimit('test-throttle', 1);
      await assert.rejects(rateLimit('test-throttle', 1), /Too many/);
      await mutateDeveloper({ op: 'session-revoke', id: actor.sessionId, code: '' }, actor);
      assert.equal(await developerFromToken(login.token, headers), null);
      const localStarted = Date.now();
      Object.assign(process.env, {
        DEVELOPER_LOCAL_ACCESS_ENABLED: 'true',
        DEVELOPER_LOCAL_ACCESS_ID: 'b'.repeat(32),
        DEVELOPER_LOCAL_ACCESS_STARTED_AT: new Date(localStarted).toISOString(),
        DEVELOPER_LOCAL_ACCESS_UNTIL: new Date(localStarted + 7 * 86400000).toISOString(),
      });
      const localHeaders = new Headers({
        host: 'localhost:3012',
        origin: 'http://localhost:3012',
        'sec-fetch-site': 'same-origin',
      });
      const localSession = await createLocalDeveloperSession(localHeaders);
      const localActor = await developerFromToken(localSession.token, localHeaders);
      assert.ok(localActor?.localDevelopmentAccess);
      assert.equal(Date.parse(localActor.expiresAt), localStarted + 7 * 86400000);
      await verifyDeveloperChange(localActor, '', localHeaders);
      const temporaryDraft = await saveDocument(
        {
          kind: 'knowledge',
          title: 'Local access test',
          content: 'Temporary local development access can save a normal validated draft.',
          source: 'isolated test',
          revision: 0,
        },
        localActor,
      );
      assert.ok(temporaryDraft.id);
      await developerDb.query(
        "UPDATE zion_developer_sessions SET last_seen_at=now()-interval '11 minutes' WHERE id=$1",
        [localActor.sessionId],
      );
      assert.ok(await developerFromToken(localSession.token, localHeaders));
      const foreignHeaders = new Headers({
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      });
      assert.equal(await developerFromToken(localSession.token, foreignHeaders), null);
      await assert.rejects(createLocalDeveloperSession(foreignHeaders), /unavailable/);
      await assert.rejects(verifyDeveloperChange(actor, '', localHeaders), /Verification failed/);
      await assert.rejects(
        verifyDeveloperChange({ ...actor, localDevelopmentAccess: true }, '', localHeaders),
        /expired/,
      );
      process.env.DEVELOPER_LOCAL_ACCESS_ENABLED = 'false';
      assert.equal(await developerFromToken(localSession.token, localHeaders), null);
      await assert.rejects(verifyDeveloperChange(localActor, '', localHeaders), /expired/);
      process.env.DEVELOPER_LOCAL_ACCESS_ENABLED = 'true';
      process.env.DEVELOPER_LOCAL_ACCESS_UNTIL = new Date(Date.now() - 1).toISOString();
      assert.equal(await developerFromToken(localSession.token, localHeaders), null);
      await assert.rejects(createLocalDeveloperSession(localHeaders), /unavailable/);
      process.env.DEVELOPER_LOCAL_ACCESS_UNTIL = new Date(
        localStarted + 7 * 86400000,
      ).toISOString();
      Object.assign(process.env, {
        NODE_ENV: 'production',
        DEVELOPER_ORIGIN: 'https://developer.example.test',
        DEVELOPER_GATEWAY_SECRET: randomBytes(32).toString('base64url'),
      });
      const gatewayHeaders = new Headers({
        host: 'developer.example.test',
        'x-zion-developer-gateway': process.env.DEVELOPER_GATEWAY_SECRET || '',
      });
      assert.equal(await developerFromToken(localSession.token, gatewayHeaders), null);
      await assert.rejects(createLocalDeveloperSession(gatewayHeaders), /unavailable/);
      Object.assign(process.env, {
        NODE_ENV: 'development',
        DEVELOPER_ORIGIN: 'http://localhost:3012',
        DEVELOPER_LOCAL_ACCESS_ENABLED: 'false',
      });
      const logs = (await developerDb.query('SELECT * FROM zion_developer_audit')).rows;
      assert.ok(logs.some((row) => row.action === 'SOURCE_PUBLISH'));
      assert.ok(!JSON.stringify(logs).includes(draft.content));
    } finally {
      await developerDb.end();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await fixture.close();
    }
  },
);
