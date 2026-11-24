import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  localAdminAccessConfig,
  localAdminAutoLoginToken,
  validateLocalAdminAccess,
} from './local-access';

const token = 'a'.repeat(43);
const now = Date.parse('2026-11-13T00:00:00Z');
const environment = {
  NODE_ENV: 'development',
  DEPLOYMENT_ENV: 'local',
  ADMIN_LOCAL_ACCESS_ENABLED: 'true',
  ADMIN_LOCAL_ACCESS_EMAIL: 'owner@example.test',
  ADMIN_LOCAL_ACCESS_TOKEN_HASH: createHash('sha256').update(token).digest('hex'),
  ADMIN_LOCAL_ACCESS_UNTIL: new Date(now + 60_000).toISOString(),
  AUTH_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/ZenTra',
};
function request(headers: Record<string, string> = {}) {
  return new Request('http://localhost:3001/api/auth/callback/credentials', {
    method: 'POST',
    headers: {
      host: 'localhost:3001',
      origin: 'http://localhost:3001',
      'sec-fetch-site': 'same-origin',
      ...headers,
    },
  });
}

test('local access requires an explicit development configuration and local database', () => {
  assert.equal(localAdminAccessConfig(environment, now)?.email, 'owner@example.test');
  for (const override of [
    { NODE_ENV: 'production' },
    { NODE_ENV: 'test' },
    { ADMIN_LOCAL_ACCESS_ENABLED: 'false' },
    { ADMIN_LOCAL_ACCESS_ENABLED: undefined },
    { DEPLOYMENT_ENV: 'production' },
    { DEPLOYMENT_ENV: 'preview' },
    { DATABASE_URL: 'postgresql://postgres@database.example/ZenTra' },
    { DATABASE_URL: 'invalid' },
    { AUTH_URL: 'http://localhost.attacker.example:3001' },
    { AUTH_URL: 'https://localhost:3001' },
    { ADMIN_LOCAL_ACCESS_EMAIL: '' },
    { ADMIN_LOCAL_ACCESS_TOKEN_HASH: 'invalid' },
    { ADMIN_LOCAL_ACCESS_UNTIL: new Date(now).toISOString() },
  ]) {
    assert.equal(localAdminAccessConfig({ ...environment, ...override }, now), null);
  }
});

test('only the correct unexpired token works for the configured local origin', () => {
  assert.equal(
    validateLocalAdminAccess(token, request(), environment, now)?.email,
    'owner@example.test',
  );
  assert.equal(validateLocalAdminAccess('b'.repeat(43), request(), environment, now), null);
  assert.equal(validateLocalAdminAccess(undefined, request(), environment, now), null);
  assert.equal(validateLocalAdminAccess(token, request(), environment, now + 60_000), null);
  assert.equal(
    validateLocalAdminAccess(token, request(), { ...environment, NODE_ENV: 'production' }, now),
    null,
  );
});

test('cross-site and remotely forwarded requests cannot use local access', () => {
  const rejectedHeaders: Record<string, string>[] = [
    { host: 'other.example' },
    { origin: 'https://other.example' },
    { origin: 'null' },
    { 'sec-fetch-site': 'cross-site' },
    { forwarded: 'for=127.0.0.1' },
    { 'x-forwarded-host': 'other.example' },
    { 'x-forwarded-for': '192.168.1.10' },
    { 'x-forwarded-for': '127.0.0.1, 192.168.1.10' },
  ];
  for (const headers of rejectedHeaders) {
    assert.equal(validateLocalAdminAccess(token, request(headers), environment, now), null);
  }
  const missingOrigin = request();
  missingOrigin.headers.delete('origin');
  assert.equal(validateLocalAdminAccess(token, missingOrigin, environment, now), null);
  assert.ok(
    validateLocalAdminAccess(
      token,
      request({
        'x-forwarded-host': 'localhost:3001',
        'x-forwarded-for': '::1',
      }),
      environment,
      now,
    ),
  );
});

test('automatic local sign-in is opt-in and checks the token and incoming loopback request', () => {
  const autoEnvironment = {
    ...environment,
    ADMIN_LOCAL_ACCESS_AUTO_LOGIN: 'true',
    ADMIN_LOCAL_ACCESS_TOKEN: token,
  };
  const navigation = new Headers({ host: 'localhost:3001', 'sec-fetch-site': 'none' });
  assert.equal(localAdminAutoLoginToken(navigation, autoEnvironment, now), token);
  assert.equal(localAdminAutoLoginToken(request().headers, autoEnvironment, now), token);
  for (const override of [
    { ADMIN_LOCAL_ACCESS_AUTO_LOGIN: 'false' },
    { ADMIN_LOCAL_ACCESS_ENABLED: 'false' },
    { ADMIN_LOCAL_ACCESS_TOKEN: 'b'.repeat(43) },
    { ADMIN_LOCAL_ACCESS_TOKEN: undefined },
    { NODE_ENV: 'production' },
    { DEPLOYMENT_ENV: 'preview' },
    { DATABASE_URL: 'postgresql://postgres@remote.example/ZenTra' },
  ])
    assert.equal(
      localAdminAutoLoginToken(navigation, { ...autoEnvironment, ...override }, now),
      null,
    );
  assert.equal(localAdminAutoLoginToken(navigation, autoEnvironment, now + 60_000), null);
  for (const override of [
    { host: '192.168.1.10:3001' },
    { origin: 'https://other.example' },
    { 'sec-fetch-site': 'cross-site' },
    { forwarded: 'for=127.0.0.1' },
    { 'x-forwarded-host': 'other.example' },
    { 'x-forwarded-for': '192.168.1.10' },
  ]) {
    const headers = new Headers(navigation);
    for (const [key, value] of Object.entries(override)) headers.set(key, value);
    assert.equal(localAdminAutoLoginToken(headers, autoEnvironment, now), null);
  }
});
