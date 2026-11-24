// Trusted local operator action. Grants a fixed week; never runs during server startup.
import { config as loadEnv } from 'dotenv';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { localDeveloperAccessConfig, developerAccessWeekMs } from '../lib/developer/local-access';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });
if (process.env.NODE_ENV && process.env.NODE_ENV !== 'development')
  throw new Error('Temporary access is available only for local development.');
const startedAt = Date.now(),
  expiresAt = startedAt + developerAccessWeekMs;
const leaseId = randomBytes(16).toString('hex');
const originArg = process.argv.find((value) => value.startsWith('--origin='))?.slice(9);
const origin =
  originArg || process.env.DEVELOPER_ORIGIN || process.env.AUTH_URL || 'http://localhost:3001';
const updates: Record<string, string> = {
  DEVELOPER_PANEL_ENABLED: 'true',
  DEVELOPER_ORIGIN: origin,
  DEVELOPER_LOCAL_ACCESS_ENABLED: 'true',
  DEVELOPER_LOCAL_ACCESS_ID: leaseId,
  DEVELOPER_LOCAL_ACCESS_STARTED_AT: new Date(startedAt).toISOString(),
  DEVELOPER_LOCAL_ACCESS_UNTIL: new Date(expiresAt).toISOString(),
};
const valid = localDeveloperAccessConfig({
  ...process.env,
  ...updates,
  NODE_ENV: 'development',
});
if (!valid)
  throw new Error(
    'Temporary access requires a loopback HTTP origin, a local PostgreSQL database, and a local development environment.',
  );
const existingKey = process.env.DEVELOPER_ENCRYPTION_KEY;
if (existingKey && !/^[a-f0-9]{64}$/i.test(existingKey))
  throw new Error('The existing developer encryption key is invalid; it was not changed.');
if (!existingKey) updates.DEVELOPER_ENCRYPTION_KEY = randomBytes(32).toString('hex');
if (!process.env.DEVELOPER_EMAIL_ALLOWLIST?.trim()) updates.DEVELOPER_EMAIL_ALLOWLIST = valid.email;
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 5000,
});
try {
  await pool.query(readFileSync(new URL('../prisma/developer.sql', import.meta.url), 'utf8'));
} finally {
  await pool.end();
}
const file = '.env.local';
let contents = existsSync(file) ? readFileSync(file, 'utf8') : '';
for (const [key, value] of Object.entries(updates)) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  contents = pattern.test(contents)
    ? contents.replace(pattern, () => line)
    : `${contents.trimEnd()}\n${line}\n`;
}
writeFileSync(file, contents, { mode: 0o600 });
console.log(
  JSON.stringify(
    {
      access: 'temporary-local',
      url: `${valid.origin}/developer`,
      expiresAt: new Date(expiresAt).toISOString(),
      expiresInManila: new Date(expiresAt).toLocaleString('en-PH', {
        timeZone: 'Asia/Manila',
        dateStyle: 'full',
        timeStyle: 'long',
      }),
      nextStep:
        'Restart the loopback development server. No password or authenticator is needed during this window.',
    },
    null,
    2,
  ),
);
