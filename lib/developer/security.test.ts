import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Secret } from 'otpauth';
import {
  developerConfig,
  assertDeveloperGate,
  assertDeveloperOrigin,
  equalSecret,
  openSecret,
  sealSecret,
  totpFor,
  totpStep,
  readDeveloperJson,
} from './security';

test('developer gateway fails closed and enforces HTTPS and the production ingress secret', () => {
  const saved = { ...process.env };
  try {
    Object.assign(process.env, {
      NODE_ENV: 'development',
      DEVELOPER_PANEL_ENABLED: 'true',
      DEVELOPER_ORIGIN: 'http://localhost:3000',
      DEVELOPER_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
      DEVELOPER_EMAIL_ALLOWLIST: 'dev@example.test',
    });
    assert.ok(developerConfig());
    process.env.DEVELOPER_PANEL_ENABLED = 'false';
    assert.equal(developerConfig(), null);
    assert.throws(() => assertDeveloperGate(new Headers()));
    process.env.DEVELOPER_PANEL_ENABLED = 'true';
    process.env.DEVELOPER_EMAIL_ALLOWLIST = '';
    assert.equal(developerConfig(), null);
    process.env.DEVELOPER_EMAIL_ALLOWLIST = 'dev@example.test';
    assert.throws(() =>
      assertDeveloperOrigin(
        new Request('http://localhost:3000/api/developer/control', {
          method: 'POST',
          headers: { Origin: 'https://attacker.test' },
        }),
      ),
    );
    assert.throws(() =>
      assertDeveloperOrigin(
        new Request('http://localhost:3000/api/developer/control', {
          method: 'POST',
        }),
      ),
    );
    assert.doesNotThrow(() =>
      assertDeveloperOrigin(
        new Request('http://localhost:3000/api/developer/control', {
          method: 'POST',
          headers: { Origin: 'http://localhost:3000' },
        }),
      ),
    );
    Object.assign(process.env, {
      NODE_ENV: 'production',
      DEVELOPER_ORIGIN: 'https://developers.example.test',
      DEVELOPER_GATEWAY_SECRET: '',
    });
    assert.equal(developerConfig(), null);
    process.env.DEVELOPER_GATEWAY_SECRET = randomBytes(32).toString('base64url');
    assert.ok(developerConfig());
    assert.throws(() => assertDeveloperGate(new Headers()));
    assert.throws(() => assertDeveloperGate(new Headers({ 'x-zion-developer-gateway': 'forged' })));
    assert.ok(
      assertDeveloperGate(
        new Headers({
          'x-zion-developer-gateway': process.env.DEVELOPER_GATEWAY_SECRET,
        }),
      ),
    );
    process.env.DEVELOPER_ORIGIN = 'http://developers.example.test';
    assert.equal(developerConfig(), null);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
test('MFA seeds are authenticated and bound to the developer identity', () => {
  const key = randomBytes(32),
    secret = new Secret({ size: 20 }).base32;
  const sealed = sealSecret(secret, key, 'account-a');
  assert.ok(!sealed.includes(secret));
  assert.equal(openSecret(sealed, key, 'account-a'), secret);
  assert.throws(() => openSecret(sealed, key, 'account-b'));
  assert.throws(() => openSecret(sealed, randomBytes(32), 'account-a'));
  const timestamp = 1700000000000,
    code = totpFor(secret).generate({ timestamp });
  assert.equal(totpStep(secret, code, timestamp), Math.floor(timestamp / 30000));
  assert.equal(totpStep(secret, '123', timestamp), null);
  assert.equal(totpStep(secret, code, timestamp + 90000), null);
  assert.ok(equalSecret('secret', 'secret'));
  assert.ok(!equalSecret('secret', 'other'));
});
test('JSON input is bounded before parsing', async () => {
  await assert.rejects(
    readDeveloperJson(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'a'.repeat(71000) }),
      }),
    ),
    /too large/,
  );
  await assert.rejects(
    readDeveloperJson(new Request('http://localhost', { method: 'POST', body: '{}' })),
    /JSON required/,
  );
});
