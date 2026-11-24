import test from 'node:test';
import assert from 'node:assert/strict';
import {
  localDeveloperAccessConfig,
  localDeveloperAccessForRequest,
  developerAccessWeekMs,
} from './local-access';

const started = Date.parse('2026-11-16T00:00:00Z');
const env = {
  NODE_ENV: 'development',
  DEPLOYMENT_ENV: 'local',
  DEVELOPER_LOCAL_ACCESS_ENABLED: 'true',
  DEVELOPER_LOCAL_ACCESS_ID: 'a'.repeat(32),
  DEVELOPER_ORIGIN: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/isolated',
  DEVELOPER_LOCAL_ACCESS_STARTED_AT: new Date(started).toISOString(),
  DEVELOPER_LOCAL_ACCESS_UNTIL: new Date(started + developerAccessWeekMs).toISOString(),
};
test('temporary developer access has a fixed maximum week and never works in production or against remote data', () => {
  assert.ok(localDeveloperAccessConfig(env, started));
  assert.ok(localDeveloperAccessConfig(env, started + developerAccessWeekMs - 1));
  assert.equal(localDeveloperAccessConfig(env, started - 1), null);
  assert.equal(localDeveloperAccessConfig(env, started + developerAccessWeekMs), null);
  for (const override of [
    { NODE_ENV: 'production' },
    { NODE_ENV: 'test' },
    { DEPLOYMENT_ENV: 'production' },
    { VERCEL: '1' },
    { VERCEL_ENV: 'preview' },
    { DEVELOPER_LOCAL_ACCESS_ENABLED: 'false' },
    { DATABASE_URL: 'postgresql://postgres@database.example.test/db' },
    { DEVELOPER_ORIGIN: 'https://developers.example.test' },
    { DEVELOPER_LOCAL_ACCESS_STARTED_AT: '' },
    { DEVELOPER_LOCAL_ACCESS_UNTIL: '' },
    {
      DEVELOPER_LOCAL_ACCESS_UNTIL: new Date(started + developerAccessWeekMs + 1).toISOString(),
    },
  ])
    assert.equal(localDeveloperAccessConfig({ ...env, ...override }, started), null);
});
test('temporary developer access rejects other hosts, cross-origin requests, and remote forwarding', () => {
  const headers = {
    host: 'localhost:3001',
    origin: 'http://localhost:3001',
    'sec-fetch-site': 'same-origin',
  };
  assert.ok(localDeveloperAccessForRequest(new Headers(headers), env, started));
  assert.ok(localDeveloperAccessForRequest(new Headers({ host: 'localhost:3001' }), env, started));
  for (const override of [
    { host: 'localhost:3000' },
    { host: 'localhost:3001.attacker.test' },
    { origin: 'http://localhost:3000' },
    { origin: 'https://attacker.test' },
    { 'sec-fetch-site': 'cross-site' },
    { 'sec-fetch-site': 'same-site' },
    { forwarded: 'for=127.0.0.1' },
    { 'x-forwarded-host': 'attacker.test' },
    { 'x-forwarded-proto': 'https' },
    { 'x-forwarded-for': '203.0.113.1' },
    { 'x-forwarded-for': '127.0.0.1, 203.0.113.1' },
  ]) {
    const requestHeaders = new Headers(headers);
    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined) requestHeaders.set(key, value);
    }
    assert.equal(localDeveloperAccessForRequest(requestHeaders, env, started), null);
  }
});
