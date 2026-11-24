// HTTP checks against the disposable developer preview only. No live credentials.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOTP, Secret } from 'otpauth';
import pg from 'pg';

const base = 'http://localhost:3012';
const fixture = JSON.parse(readFileSync('.next/developer-fixture.json', 'utf8'));
const db = new pg.Pool({ connectionString: fixture.databaseUrl, max: 1 });
const jar = new Map();
async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    redirect: 'manual',
    ...options,
    headers: {
      Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
      ...options.headers,
    },
  });
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(';');
    const split = pair.indexOf('=');
    jar.set(pair.slice(0, split), pair.slice(split + 1));
  }
  return response;
}
const jsonHeaders = { Origin: base, 'Content-Type': 'application/json' };
const code = () =>
  new TOTP({
    secret: Secret.fromBase32(fixture.secret),
    period: 30,
    digits: 6,
    algorithm: 'SHA1',
  }).generate();
async function staffLogin(role) {
  jar.clear();
  const csrf = await (await request('/api/auth/csrf')).json();
  await request('/api/auth/callback/credentials', {
    method: 'POST',
    headers: {
      Origin: base,
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Auth-Return-Redirect': '1',
    },
    body: new URLSearchParams({
      csrfToken: csrf.csrfToken,
      email: `${role}@example.test`,
      password: fixture.adminPassword,
      callbackUrl: `${base}/admin/dashboard`,
    }),
  });
}
try {
  assert.equal((await request('/developer')).status, 307);
  assert.equal((await request('/api/developer/control')).status, 401);
  assert.equal((await request('/api/developer/control?section=content')).status, 401);
  assert.equal((await request('/api/developer/knowledge-feed')).status, 404);
  assert.equal(
    (
      await request('/api/developer/session', {
        method: 'POST',
        headers: { ...jsonHeaders, Origin: 'https://attacker.test' },
        body: '{}',
      })
    ).status,
    403,
  );
  for (const role of ['admin', 'superadmin']) {
    await staffLogin(role);
    assert.equal(
      (await request('/api/admin/dashboard')).status,
      200,
      `${role} fixture can access its own admin API`,
    );
    assert.equal(
      (await request('/api/developer/control')).status,
      401,
      `${role} has no developer access`,
    );
  }
  jar.clear();
  const login = await request('/api/developer/session', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      email: fixture.email,
      password: fixture.password,
      code: code(),
    }),
  });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(login.headers.get('set-cookie'), /SameSite=strict/i);
  assert.match(login.headers.get('set-cookie'), /Max-Age=1800/i);
  assert.equal((await request('/developer')).status, 200);
  const session = await (await request('/api/developer/session')).json();
  assert.ok(session.csrf);
  const secondTabSession = await (await request('/api/developer/session')).json();
  assert.equal(
    secondTabSession.csrf,
    session.csrf,
    'opening another tab preserves form CSRF tokens',
  );
  const overview = await request('/api/developer/control');
  assert.equal(overview.status, 200);
  assert.match(overview.headers.get('cache-control'), /no-store/);
  assert.equal(
    (
      await request('/api/developer/control', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ op: 'review-resolve', id: 'missing-review', code: code() }),
      })
    ).status,
    403,
  );
  const mutateHeaders = { ...jsonHeaders, 'x-developer-csrf': session.csrf };
  assert.equal(
    (
      await request('/api/developer/control', {
        method: 'POST',
        headers: mutateHeaders,
        body: JSON.stringify({
          op: 'source-test',
          question: 'venue tour hours',
        }),
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request('/api/developer/control', {
        method: 'POST',
        headers: mutateHeaders,
        body: JSON.stringify({ op: 'review-resolve', id: 'missing-review', code: code() }),
      })
    ).status,
    403,
    'login MFA cannot be replayed for a system change',
  );
  assert.equal(
    (
      await request('/api/developer/knowledge-feed', {
        headers: { Authorization: `Bearer ${fixture.feedToken}` },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request('/api/developer/control', {
        headers: { Cookie: '', Authorization: `Bearer ${fixture.feedToken}` },
      })
    ).status,
    401,
    'feed token has no control-plane permissions',
  );
  assert.equal(
    (
      await request('/api/developer/knowledge-feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fixture.feedToken}`,
        },
        body: JSON.stringify({
          topic: 'pricing',
          question: 'private visitor transcript',
        }),
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await request('/api/developer/knowledge-feed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fixture.feedToken}`,
        },
        body: JSON.stringify({ topic: 'pricing' }),
      })
    ).status,
    200,
  );
  await db.query('UPDATE zion_developer_sessions SET revoked_at=now()');
  assert.equal((await request('/api/developer/control')).status, 401);
  console.log(
    'Developer HTTP checks passed: staff isolation, origin/CSRF checks, mandatory MFA, replay denial, scoped feed, cache headers, and session revocation.',
  );
} finally {
  // Reset only this disposable fixture for the subsequent visual test.
  await db.query('UPDATE zion_developer_accounts SET last_totp_step=-1');
  await db.query('DELETE FROM zion_developer_rate_limits');
  await db.end();
}
