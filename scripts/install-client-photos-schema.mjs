// Checks (default) or applies prisma/client-photos.sql: the private table of optional client
// photos and the Front desk's event arrivals (docs/client-photos.md). The SQL is additive and
// idempotent; existing data is never changed.
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import pg from 'pg';

config({ path: '.env.local', quiet: true });
config({ quiet: true });
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Database connection is not configured.');
const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });

async function missingParts() {
  const tables = await pool.query(
    "SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN ('zion_client_photos','zion_event_arrivals')",
  );
  const found = new Map(tables.rows.map((row) => [row.relname, row.relrowsecurity]));
  const missing = [];
  for (const [table, label] of [
    ['zion_client_photos', 'client photos table'],
    ['zion_event_arrivals', 'event arrivals table'],
  ]) {
    if (!found.has(table)) missing.push(label);
    else if (!found.get(table)) missing.push(`${label} row security`);
  }
  return missing;
}

try {
  let missing = await missingParts();
  if (!process.argv.includes('--apply')) {
    console.log(
      missing.length
        ? `Client photos schema: missing ${missing.join(', ')}. Check only; no changes made. Apply with npm run db:client-photos:check -- --apply`
        : 'Client photos schema: installed. Check only; no changes made.',
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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        readFileSync(new URL('../prisma/client-photos.sql', import.meta.url), 'utf8'),
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    missing = await missingParts();
    if (missing.length)
      throw new Error(`Client photos schema needs review: missing ${missing.join(', ')}.`);
    console.log('Client photos schema is installed. Existing data was not changed.');
  }
} finally {
  await pool.end();
}
