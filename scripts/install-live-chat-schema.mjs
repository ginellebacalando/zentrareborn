// Checks (default) or applies prisma/live-chat.sql: the live chat tables that let Zeni hand a
// visitor to a staff member. The SQL is additive and idempotent; existing data is never changed.
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import pg from 'pg';

config({ path: '.env.local', quiet: true });
config({ quiet: true });
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Database connection is not configured.');
const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
const TABLES = ['zion_live_chats', 'zion_live_chat_messages', 'zion_live_chat_staff'];

async function missingTables() {
  const { rows } = await pool.query(
    "SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname = ANY($1)",
    [TABLES],
  );
  const present = new Map(rows.map((row) => [row.relname, row.relrowsecurity]));
  return TABLES.flatMap((name) =>
    !present.has(name) ? [name] : present.get(name) ? [] : [`${name} row security`],
  );
}

try {
  let missing = await missingTables();
  if (!process.argv.includes('--apply')) {
    console.log(
      missing.length
        ? `Live chat schema: missing ${missing.join(', ')}. Check only; no changes made. Apply with npm run db:live-chat:check -- --apply`
        : 'Live chat schema: installed. Check only; no changes made.',
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
    await pool.query(readFileSync(new URL('../prisma/live-chat.sql', import.meta.url), 'utf8'));
    missing = await missingTables();
    if (missing.length)
      throw new Error(`Live chat schema needs review: missing ${missing.join(', ')}.`);
    console.log('Live chat schema is installed. Existing data was not changed.');
  }
} finally {
  await pool.end();
}
