// Isolated UI verification only. No real database, credentials, emails, or venue records are used.
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
console.log('Preparing isolated preview database…');
const db = new PGlite();
await db.waitReady;
console.log('Generating isolated database schema…');
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
console.log('Isolated schema loaded. Starting test-only preview…');
const adminSql = readFileSync('prisma/admin.sql', 'utf8');
await db.exec(adminSql.slice(adminSql.indexOf('-- Admin-only data')));
const passwordHash = await bcrypt.hash('Isolated-preview-only-2026!', 12);
await db.query(
  'INSERT INTO users (id,username,email,password_hash,full_name,role,status,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())',
  [
    'qa-owner',
    'qa-owner',
    'owner@example.test',
    passwordHash,
    'Preview Owner',
    'SUPERADMIN',
    'ACTIVE',
  ],
);
await db.query(
  'INSERT INTO users (id,username,email,password_hash,full_name,role,status,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())',
  [
    'qa-client',
    'qa-client',
    'client@example.test',
    passwordHash,
    'Preview Client',
    'CLIENT',
    'ACTIVE',
  ],
);
const pgServer = createServer(db, { logLevel: LogLevel.Error });
await new Promise((resolve) => pgServer.listen(0, '127.0.0.1', resolve));
const pgPort = pgServer.address().port;
const appPort = Number(process.env.ADMIN_PREVIEW_PORT || 3011);
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
      ADMIN_ISOLATED_PREVIEW: '1',
      DATABASE_URL: `postgresql://postgres@127.0.0.1:${pgPort}/postgres`,
      DIRECT_URL: `postgresql://postgres@127.0.0.1:${pgPort}/postgres`,
      DATABASE_POOL_MAX: '1',
      AUTH_SECRET: randomBytes(48).toString('hex'),
      AUTH_URL: `http://localhost:${appPort}`,
      NEXT_PUBLIC_APP_URL: `http://localhost:${appPort}`,
      ADMIN_RESEND_API_KEY: '',
      ADMIN_MAIL_FROM: '',
      N8N_WEBHOOK_ENABLED: 'false',
    },
  },
);
console.log(
  `Isolated admin preview: http://localhost:${appPort}/admin (temporary test database only)`,
);
async function close() {
  child.kill();
  pgServer.close();
  await db.close();
  process.exit();
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
child.on('exit', close);
