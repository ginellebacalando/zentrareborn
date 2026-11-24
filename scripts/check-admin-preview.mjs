// HTTP security checks for scripts/preview-admin.mjs only. Never uses live credentials.
import assert from 'node:assert/strict';

const base = `http://localhost:${Number(process.env.ADMIN_PREVIEW_PORT || 3011)}`;
const jar = new Map();
function capture(response) {
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';', 1)[0],
      split = pair.indexOf('=');
    jar.set(pair.slice(0, split), pair.slice(split + 1));
  }
}
function cookies() {
  return [...jar].map(([key, value]) => `${key}=${value}`).join('; ');
}
async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    redirect: 'manual',
    ...options,
    headers: { Cookie: cookies(), ...options.headers },
  });
  capture(response);
  return response;
}
async function login(email) {
  jar.clear();
  const csrf = await (await request('/api/auth/csrf')).json();
  return (
    await request('/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        Origin: base,
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Auth-Return-Redirect': '1',
      },
      body: new URLSearchParams({
        csrfToken: csrf.csrfToken,
        email,
        password: 'Isolated-preview-only-2026!',
        callbackUrl: `${base}/admin/dashboard`,
      }),
    })
  ).json();
}

assert.equal((await request('/api/admin/dashboard')).status, 401);
assert.equal((await request('/admin/dashboard')).status, 307);
assert.equal(
  (
    await request('/api/admin/bookings', {
      method: 'POST',
      headers: { Origin: 'https://invalid.example' },
      body: '{}',
    })
  ).status,
  403,
);
assert.equal(
  (
    await request('/api/admin/bookings', {
      method: 'POST',
      headers: { Origin: base },
      body: '{}',
    })
  ).status,
  401,
);
const denied = await login('client@example.test');
assert.match(denied.url, /CredentialsSignin/);
assert.equal((await request('/api/admin/dashboard')).status, 401);
const accepted = await login('owner@example.test');
assert.doesNotMatch(accepted.url, /error=/);
const profile = await (await request('/api/admin/profile')).json();
assert.equal(profile.user.id, 'qa-owner', 'Only the isolated preview fixture may be tested');
assert.equal((await request('/api/admin/dashboard')).status, 200);
assert.equal((await request('/api/admin/bookings?from=2026-02-31')).status, 400);
assert.equal((await request('/api/admin/bookings?from=2026-12-31&to=2026-12-01')).status, 400);
assert.equal(
  (
    await request('/api/admin/logs', {
      method: 'POST',
      headers: { Origin: base },
      body: JSON.stringify({ op: 'profile' }),
    })
  ).status,
  400,
);
assert.equal(
  (
    await request('/api/admin/bookings', {
      method: 'POST',
      headers: { Origin: base, 'Sec-Fetch-Site': 'cross-site' },
      body: '{}',
    })
  ).status,
  403,
);
assert.equal(
  (
    await request('/api/admin/bookings', {
      method: 'POST',
      headers: { Origin: base },
      body: 'invalid-json',
    })
  ).status,
  400,
);
const oldSession = cookies(),
  csrf = await (await request('/api/auth/csrf')).json();
await request('/api/auth/signout', {
  method: 'POST',
  headers: {
    Origin: base,
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Auth-Return-Redirect': '1',
  },
  body: new URLSearchParams({
    csrfToken: csrf.csrfToken,
    callbackUrl: `${base}/admin`,
  }),
});
const revoked = await fetch(`${base}/api/admin/dashboard`, {
  headers: { Cookie: oldSession },
});
assert.equal(
  revoked.status,
  401,
  'A signed-out JWT must be rejected by database session revocation',
);
console.log(
  'Admin HTTP checks passed: authentication, client-role denial, CSRF/origin checks, input validation, protected modules, and session revocation. Isolated test data only.',
);
