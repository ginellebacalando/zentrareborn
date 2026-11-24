// Disposable, loopback-only fixture. Never uses real users, credentials, or integrations.
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Secret } from 'otpauth';
import { sealSecret } from '../lib/developer/security';

const fixture = new PGlite();
await fixture.waitReady;
console.log('Preparing disposable developer preview database…');
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
const adminSql = readFileSync('prisma/admin.sql', 'utf8');
await fixture.exec(adminSql.slice(adminSql.indexOf('-- Admin-only data')));
await fixture.exec(readFileSync('prisma/developer.sql', 'utf8'));
const email = 'developer@example.test',
  id = randomUUID(),
  key = randomBytes(32),
  password = randomBytes(24).toString('base64url'),
  secret = new Secret({ size: 20 }).base32;
await fixture.query(
  "INSERT INTO zion_developer_accounts (id,email,name,password_hash,totp_secret) VALUES ($1,$2,'Preview Developer',$3,$4)",
  [id, email, await bcrypt.hash(password, 12), sealSecret(secret, key, id)],
);
const adminPassword = 'Isolated-staff-fixture-2026!';
for (const role of ['CLIENT', 'ADMIN', 'SUPERADMIN']) {
  await fixture.query(
    'INSERT INTO users (id,username,email,password_hash,full_name,role,status,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,\'ACTIVE\',now())',
    [
      role,
      role,
      `${role.toLowerCase()}@example.test`,
      await bcrypt.hash(adminPassword, 12),
      `Preview ${role}`,
      role,
    ],
  );
}
const server = createServer(fixture, { logLevel: LogLevel.Error });
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address !== 'object') throw new Error('Preview database unavailable.');
const port = 3012,
  origin = `http://localhost:${port}`,
  databaseUrl = `postgresql://postgres@127.0.0.1:${address.port}/postgres`;
const feedToken = randomBytes(32).toString('base64url');
mkdirSync('.next', { recursive: true });
const credentialFile = '.next/developer-fixture.json';
writeFileSync(
  credentialFile,
  JSON.stringify({
    email,
    password,
    secret,
    adminPassword,
    databaseUrl,
    feedToken,
  }),
  { mode: 0o600 },
);
const child = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'dev',
    '--webpack',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(port),
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      DEVELOPER_ISOLATED_PREVIEW: '1',
      ADMIN_ISOLATED_PREVIEW: '0',
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
      DATABASE_POOL_MAX: '1',
      AUTH_SECRET: randomBytes(48).toString('hex'),
      AUTH_URL: origin,
      NEXT_PUBLIC_APP_URL: origin,
      ADMIN_LOCAL_ACCESS_ENABLED: 'false',
      DEVELOPER_PANEL_ENABLED: 'true',
      DEVELOPER_ORIGIN: origin,
      DEVELOPER_EMAIL_ALLOWLIST: email,
      DEVELOPER_ENCRYPTION_KEY: key.toString('hex'),
      DEVELOPER_KNOWLEDGE_TOKEN: feedToken,
      DEVELOPER_OUTBOUND_HOSTS: '',
      N8N_API_BASE_URL: '',
      N8N_API_KEY: '',
      N8N_WEBHOOK_ENABLED: 'false',
      N8N_INQUIRY_WEBHOOK_URL: '',
      N8N_KNOWLEDGE_SYNC_URL: '',
      N8N_KNOWLEDGE_SYNC_SECRET: '',
      ADMIN_RESEND_API_KEY: '',
      ADMIN_MAIL_FROM: '',
      SUPABASE_SECRET_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    },
  },
);
console.log(
  `Developer fixture available at ${origin}/developer/access. Fixture enrollment is stored only in the ignored .next directory.`,
);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  child.kill();
  try {
    unlinkSync(credentialFile);
  } catch {}
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await fixture.close();
}
process.once('SIGINT', () => {
  void close().then(() => process.exit(0));
});
process.once('SIGTERM', () => {
  void close().then(() => process.exit(0));
});
child.once('exit', () => {
  void close().then(() => process.exit(0));
});
