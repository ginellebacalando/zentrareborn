// Local development: the whole site, Zeni and the admin panel on an embedded PostgreSQL (PGlite)
// filled with clearly labeled demo data. It never connects to Supabase or any remote database,
// sends no email and needs no secrets.
//
//   npm run dev:local              start on http://localhost:3002
//   npm run dev:local -- --reset   rebuild the local database from scratch
//
// The database lives in .local/ (ignored by Git) and is rebuilt automatically whenever the schema
// files change. The demo staff sign-in is generated per computer and saved in
// .local/DEMO-ADMIN-SIGN-IN.txt; it exists only in this local database. The schema and demo
// content come from scripts/demo-database.mjs, shared with the hosted test-database setup.
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_ADMIN, SEED_VERSION, buildSchema, seed, sqlFiles } from './demo-database.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const localDir = path.join(root, '.local');
const dataDir = path.join(localDir, 'pgdata');
const appPort = Number(process.env.DEV_LOCAL_PORT || 3002);
const appUrl = `http://localhost:${appPort}`;

function schemaFingerprint() {
  const hash = createHash('sha256').update(SEED_VERSION);
  for (const file of [path.join('prisma', 'schema.prisma'), ...sqlFiles()]) {
    hash.update(file).update(readFileSync(file));
  }
  return hash.digest('hex');
}

/** Per-computer secrets for the local preview, kept in the ignored .local/ folder. */
function localSecrets() {
  mkdirSync(localDir, { recursive: true });
  const file = path.join(localDir, 'secrets.json');
  const stored = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const secrets = {
    authSecret: stored.authSecret ?? randomBytes(48).toString('hex'),
    cronSecret: stored.cronSecret ?? randomBytes(32).toString('hex'),
    demoAdminPassword: stored.demoAdminPassword ?? `Zentra-${randomBytes(9).toString('base64url')}`,
  };
  writeFileSync(file, `${JSON.stringify(secrets, null, 2)}\n`);
  writeFileSync(
    path.join(localDir, 'DEMO-ADMIN-SIGN-IN.txt'),
    `Local demo admin (exists only in this computer's demo database)\nEmail: ${DEMO_ADMIN.email}\nPassword: ${secrets.demoAdminPassword}\n`,
  );
  return secrets;
}

async function openDatabase(demoAdminPassword) {
  mkdirSync(localDir, { recursive: true });
  const fingerprintFile = path.join(localDir, 'schema-fingerprint');
  const fingerprint = schemaFingerprint();
  const stale =
    !existsSync(fingerprintFile) || readFileSync(fingerprintFile, 'utf8').trim() !== fingerprint;
  if (process.argv.includes('--reset') || stale) {
    if (existsSync(dataDir))
      console.log('Schema or demo data changed: rebuilding the local database…');
    rmSync(dataDir, { recursive: true, force: true });
  }
  const fresh = !existsSync(path.join(dataDir, 'PG_VERSION'));
  const db = new PGlite(dataDir);
  await db.waitReady;
  // PGlite inherits the computer's time zone (UTC+8 here); Supabase runs in UTC, and the app stores
  // timestamp-without-time-zone values as UTC. Pin the session and the database to UTC.
  await db.exec(`SET TIME ZONE 'UTC'; ALTER DATABASE postgres SET timezone TO 'UTC';`);
  if (fresh) {
    console.log('Creating the local demo database (first run takes a minute)…');
    await buildSchema(db);
    await seed(db, { adminPassword: demoAdminPassword });
    writeFileSync(fingerprintFile, fingerprint);
  }
  return db;
}

if (!existsSync(path.join('public', 'fonts', 'licensed', 'fonts.css'))) {
  execFileSync(process.execPath, ['scripts/install-licensed-fonts.mjs'], { stdio: 'inherit' });
}

const secrets = localSecrets();
const db = await openDatabase(secrets.demoAdminPassword);
const pgServer = createServer(db, { logLevel: LogLevel.Error });
await new Promise((resolve) => pgServer.listen(0, '127.0.0.1', resolve));
const databaseUrl = `postgresql://postgres@127.0.0.1:${pgServer.address().port}/postgres`;

const child = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    'dev',
    '--webpack',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(appPort),
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
      DATABASE_POOL_MAX: '1',
      AUTH_SECRET: secrets.authSecret,
      AUTH_URL: appUrl,
      NEXT_PUBLIC_APP_URL: appUrl,
      CRON_SECRET: secrets.cronSecret,
      // Demo data uses example.test addresses. Real sending is opt-in (`-- --send-email`), so Gmail
      // settings in .env.local never send mail from the local demo by accident (Next does not
      // override variables that are already set, even when empty).
      ...(process.argv.includes('--send-email') ? {} : { SMTP_USER: '', SMTP_PASSWORD: '' }),
    },
  },
);

console.log(
  `\nZENTRA local preview: ${appUrl}  (admin: ${appUrl}/admin, sign-in in .local/DEMO-ADMIN-SIGN-IN.txt)\n` +
    'Local demo database only; nothing here touches Supabase or sends email.\n',
);

let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  child.kill();
  pgServer.close();
  await db.close();
  process.exit();
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
child.on('exit', close);
