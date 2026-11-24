import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  ConversationError,
  hashSession,
  newSessionToken,
  openConversation,
  sealConversation,
  sessionCookie,
  sessionCookieName,
  sessionToken,
} from './session-security';

const originalKey = process.env.RECEPTIONIST_STATE_KEY;
const originalMode = process.env.NODE_ENV;
Object.assign(process.env, { RECEPTIONIST_STATE_KEY: randomBytes(32).toString('hex') });
after(() => {
  if (originalKey === undefined) delete process.env.RECEPTIONIST_STATE_KEY;
  else process.env.RECEPTIONIST_STATE_KEY = originalKey;
  if (originalMode === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
  else Object.assign(process.env, { NODE_ENV: originalMode });
});

test('conversation data is encrypted and authenticated against its own record identity', () => {
  const payload = { name: 'Example Visitor', email: 'visitor@example.test' };
  const sealed = sealConversation(payload, 'conversation:one');
  assert.doesNotMatch(sealed, /Example|visitor|email/);
  assert.deepEqual(openConversation(sealed, 'conversation:one'), payload);
  assert.throws(() => openConversation(sealed, 'conversation:two'), ConversationError);
  const parts = sealed.split('.');
  parts[2] = Buffer.from('tampered').toString('base64url');
  assert.throws(() => openConversation(parts.join('.'), 'conversation:one'), ConversationError);
});

test('rotated encryption keys cannot restore a previous conversation', () => {
  const sealed = sealConversation({ message: 'private' }, 'request:one');
  const key = process.env.RECEPTIONIST_STATE_KEY;
  process.env.RECEPTIONIST_STATE_KEY = randomBytes(32).toString('hex');
  assert.throws(() => openConversation(sealed, 'request:one'), ConversationError);
  process.env.RECEPTIONIST_STATE_KEY = key;
});

test('opaque cookies use production host/secure flags and reject malformed session tokens', () => {
  Object.assign(process.env, { NODE_ENV: 'production' });
  const token = newSessionToken();
  assert.equal(token.length, 43);
  assert.equal(hashSession(token).length, 64);
  assert.notEqual(hashSession(token), token);
  const cookie = sessionCookie(token);
  assert.match(cookie, /^__Host-zion-receptionist=/);
  for (const flag of ['Path=/', 'HttpOnly', 'SameSite=Strict', 'Secure', 'Max-Age=86400'])
    assert.ok(cookie.includes(flag));
  assert.equal(
    sessionToken(
      new Request('https://example.test', {
        headers: { Cookie: `${sessionCookieName()}=${token}` },
      }),
    ),
    token,
  );
  assert.equal(
    sessionToken(
      new Request('https://example.test', { headers: { Cookie: `${sessionCookieName()}=forged` } }),
    ),
    null,
  );
  assert.match(sessionCookie('', 0), /Max-Age=0/);
});
