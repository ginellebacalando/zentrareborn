import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';
import { cleanLiveMessage, staffFirstName } from './live-chat';

test('live chat text helpers keep messages plain and share only a first name', () => {
  assert.equal(cleanLiveMessage('  Hello\u0007 there \r\n\r\n\r\n\r\nPo  '), 'Hello there\n\nPo');
  assert.equal(cleanLiveMessage('x'.repeat(700)).length, 600);
  assert.equal(staffFirstName('Maria Santos'), 'Maria');
  assert.equal(staffFirstName('owner@zentra.test'), 'Zion staff');
  assert.equal(staffFirstName(''), 'Zion staff');
});

test(
  'Zeni hands a visitor to available staff, staff reply in the same chat, then hand back to Zeni',
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
    await db.exec(readFileSync('prisma/live-chat.sql', 'utf8'));
    // The installer is idempotent.
    await db.exec(readFileSync('prisma/live-chat.sql', 'utf8'));
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
      ZENI_LLM_ENABLED: 'false',
    });
    const { POST } = await import('../../app/api/client/chatbot/route');
    const live = await import('../../app/api/client/chatbot/live/route');
    const staffSide = await import('../../services/chatbot/live-chat');
    const { receptionistPool } = await import('../../services/chatbot/state-store');
    const { prisma } = await import('../prisma');

    const origin = 'http://localhost:3001';
    let cookie = '';
    async function ask(question: string, action?: { type: string }) {
      const response = await POST(
        new Request(`${origin}/api/client/chatbot`, {
          method: 'POST',
          headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, turnId: randomUUID(), ...(action ? { action } : {}) }),
        }),
      );
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      assert.equal(response.status, 200);
      return (await response.json()) as { message: string; live?: { status: string } };
    }
    async function poll(after?: string) {
      const response = await live.GET(
        new Request(`${origin}/api/client/chatbot/live${after ? `?after=${after}` : ''}`, {
          headers: { Cookie: cookie },
        }),
      );
      return (await response.json()).chat as {
        status: string;
        staffName: string | null;
        position: number | null;
        messages: Array<{ id: string; sender: string; author: string; body: string }>;
      } | null;
    }
    async function say(text: string) {
      return live.POST(
        new Request(`${origin}/api/client/chatbot/live`, {
          method: 'POST',
          headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        }),
      );
    }
    const maria = { id: 'staff-maria', fullName: 'Maria Santos', username: 'maria' };
    const jose = { id: 'staff-jose', fullName: 'Jose Cruz', username: 'jose' };

    try {
      await ask('Hi');
      assert.equal(await poll(), null);

      // Nobody is on live chat: Zeni explains and keeps the email hand-off.
      const offline = await ask('Talk to staff', { type: 'request_human' });
      assert.equal(offline.live, undefined);
      assert.match(offline.message, /isn’t available for live chat/);

      // Maria switches live chat on; asking again puts the visitor in the queue.
      await staffSide.setStaffPresence(maria, true);
      assert.equal(await staffSide.liveStaffOnline(), 1);
      const handoff = await ask('Talk to staff', { type: 'request_human' });
      assert.equal(handoff.live?.status, 'WAITING');
      let chat = await poll();
      assert.equal(chat?.status, 'WAITING');
      assert.equal(chat?.position, 1);
      assert.equal(chat?.messages[0]?.sender, 'SYSTEM');

      assert.equal((await say('Hello, is December 5 free?')).status, 200);
      const queue = await staffSide.staffLiveOverview(maria);
      assert.equal(queue.waiting.length, 1);
      assert.equal(queue.waiting[0].lastMessage, 'Hello, is December 5 free?');
      const chatId = queue.waiting[0].id;

      await staffSide.claimLiveChat(chatId, maria);
      await assert.rejects(staffSide.claimLiveChat(chatId, jose), /already took/);
      await staffSide.sendStaffMessage(chatId, maria, 'Hi! I’m Maria. Let me check that date.');
      await assert.rejects(staffSide.sendStaffMessage(chatId, jose, 'Hello'), /Another staff/);

      const lastSeen = chat?.messages.at(-1)?.id;
      chat = await poll(lastSeen);
      assert.equal(chat?.status, 'ACTIVE');
      assert.equal(chat?.staffName, 'Maria');
      assert.equal(chat?.position, null);
      assert.ok(chat?.messages.some((message) => message.body.includes('joined the chat')));
      const reply = chat?.messages.find((message) => message.sender === 'STAFF');
      assert.equal(reply?.author, 'Maria');

      await staffSide.finishLiveChat(chatId, maria, 'return', 'Visit booked for Saturday.');
      chat = await poll();
      assert.equal(chat?.status, 'RETURNED');
      assert.match(chat?.messages.at(-1)?.body ?? '', /handed you back to Zeni/);
      assert.equal((await say('Are you still there?')).status, 409);

      // A chat nobody takes in time is missed; asking again goes to the email hand-off.
      assert.equal((await ask('Talk to staff', { type: 'request_human' })).live?.status, 'WAITING');
      await receptionistPool.query(
        "UPDATE zion_live_chats SET created_at = now() - interval '6 minutes' WHERE status='WAITING'",
      );
      chat = await poll();
      assert.equal(chat?.status, 'MISSED');
      const again = await ask('Leave a message for our team', { type: 'request_human' });
      assert.equal(again.live, undefined);

      // Later, finished chats leave the visitor's window, and the visitor can reach staff again
      // and end the chat themselves.
      await receptionistPool.query(
        "UPDATE zion_live_chats SET ended_at = now() - interval '20 minutes' WHERE status IN ('MISSED','RETURNED')",
      );
      assert.equal(await poll(), null);
      assert.equal((await ask('Talk to staff', { type: 'request_human' })).live?.status, 'WAITING');
      const ended = await live.DELETE(
        new Request(`${origin}/api/client/chatbot/live`, {
          method: 'DELETE',
          headers: { Origin: origin, Cookie: cookie },
        }),
      );
      assert.equal(ended.status, 200);
      chat = await poll();
      assert.equal(chat?.status, 'RETURNED');

      // Visitor messages need the website origin.
      const foreign = await live.POST(
        new Request(`${origin}/api/client/chatbot/live`, {
          method: 'POST',
          headers: {
            Origin: 'https://evil.test',
            Cookie: cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: 'hi' }),
        }),
      );
      assert.equal(foreign.status, 403);
    } finally {
      await receptionistPool.end().catch(() => {});
      await prisma.$disconnect().catch(() => {});
      server.close();
      await db.close();
    }
  },
);
