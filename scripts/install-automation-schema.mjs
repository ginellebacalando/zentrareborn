// Checks (default) or applies prisma/automation.sql. The SQL is additive and idempotent.
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import pg from 'pg';
config({ path: '.env.local', quiet: true });
config({ quiet: true });
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Database connection is not configured.');
const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
const outboxColumns = [
  'replyTo',
  'html',
  'calendar',
  'calendarMethod',
  'idempotencyKey',
  'maxAttempts',
  'claimedAt',
  'expiresAt',
];

async function inspect() {
  const outbox = await pool.query(
    "SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='zion_admin_outbox'",
  );
  const columns = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='zion_admin_outbox'",
  );
  const state = await pool.query(
    "SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='zion_automation_state' AND c.relkind='r'",
  );
  const index = await pool.query(
    "SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='zion_admin_outbox_idempotencyKey_key'",
  );
  const present = new Set(columns.rows.map((row) => row.column_name));
  const missing = [
    ...outboxColumns.filter((name) => !present.has(name)).map((name) => `outbox.${name}`),
    ...(index.rowCount ? [] : ['idempotency index']),
    ...(state.rowCount ? [] : ['zion_automation_state']),
    ...(state.rowCount && !state.rows[0].relrowsecurity ? ['row security'] : []),
  ];
  return { outbox: outbox.rowCount === 1, missing };
}

try {
  let status = await inspect();
  if (!status.outbox)
    throw new Error(
      'zion_admin_outbox is missing. Install the admin schema first: npm run db:admin:check -- --apply',
    );
  if (!process.argv.includes('--apply')) {
    console.log(
      status.missing.length
        ? `Automation schema: missing ${status.missing.join(', ')}. Check only; no changes made. Apply with npm run db:automation:check -- --apply`
        : 'Automation schema: installed. Check only; no changes made.',
    );
  } else {
    const target = new URL(connectionString);
    if (
      !['localhost', '127.0.0.1', '[::1]', '::1'].includes(target.hostname) &&
      !process.argv.includes('--allow-remote')
    )
      throw new Error(
        'Remote schema installation requires --allow-remote after explicit approval.',
      );
    await pool.query(readFileSync(new URL('../prisma/automation.sql', import.meta.url), 'utf8'));
    status = await inspect();
    if (status.missing.length)
      throw new Error(`Automation schema needs review: missing ${status.missing.join(', ')}.`);
    console.log(
      'Automation schema is installed. Existing outbox rows and booking history were preserved.',
    );
  }
} finally {
  await pool.end();
}
