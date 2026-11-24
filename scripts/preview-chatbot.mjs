// Disposable public-chatbot preview. The real database and outbound services are never used.
import { PGlite } from '@electric-sql/pglite';
import { createServer, LogLevel } from 'pglite-server';
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const db = new PGlite();
await db.waitReady;
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
await db.exec(readFileSync('prisma/receptionist.sql', 'utf8'));
await db.exec(`
  INSERT INTO event_categories (id,category_key,name,slug,updated_at)
  VALUES ('preview-category','wedding','Wedding','wedding-reception',now());
  INSERT INTO packages (id,event_category_id,package_name,slug,price,current_version,updated_at)
  VALUES ('preview-package','preview-category','Preview Classic','preview-classic',90000,1,now());
  INSERT INTO package_versions (id,package_id,version_number,snapshot_data)
  VALUES ('preview-version','preview-package',1,'{"packageName":"Preview Classic (demonstration only)","price":90000,"currency":"PHP","paxIncluded":100,"description":"Isolated preview data, not a real quote.","inclusions":[{"inclusionName":"Tables and chairs"}]}');
`);
const server = createServer(db, { logLevel: LogLevel.Error });
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const databaseUrl = `postgresql://postgres@127.0.0.1:${server.address().port}/postgres`;
const port = 3013;
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
      CHATBOT_ISOLATED_PREVIEW: '1',
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
      DATABASE_POOL_MAX: '1',
      AUTH_SECRET: randomBytes(48).toString('hex'),
      RECEPTIONIST_STATE_KEY: randomBytes(32).toString('hex'),
      RECEPTIONIST_BOOKING_ORCHESTRATION_ENABLED: 'false',
      AUTH_URL: `http://localhost:${port}`,
      NEXT_PUBLIC_APP_URL: `http://localhost:${port}`,
      DEVELOPER_PANEL_ENABLED: 'false',
      ADMIN_LOCAL_ACCESS_ENABLED: 'false',
      DEVELOPER_LOCAL_ACCESS_ENABLED: 'false',
      ADMIN_RESEND_API_KEY: '',
      ADMIN_MAIL_FROM: '',
      N8N_WEBHOOK_ENABLED: 'false',
      N8N_INQUIRY_WEBHOOK_URL: '',
      N8N_KNOWLEDGE_SYNC_URL: '',
      N8N_API_KEY: '',
    },
  },
);
console.log(
  `Disposable chatbot preview: http://localhost:${port}/faq (demonstration package only)`,
);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  child.kill();
  server.close();
  await db.close();
  process.exit();
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
child.on('exit', close);
