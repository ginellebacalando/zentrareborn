// Checks (default) or applies prisma/visits.sql: the private table of ocular visits and calendar
// appointments. The SQL is additive and idempotent; existing data is never changed.
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import pg from 'pg';

config({ path: '.env.local', quiet: true });
config({ quiet: true });
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Database connection is not configured.');
const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });

async function missingParts() {
  const table = await pool.query(
    "SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname='zion_visits'",
  );
  const missing = [];
  if (!table.rowCount) missing.push('visits table');
  else if (!table.rows[0].relrowsecurity) missing.push('visits row security');
  // Calendar appointments (docs/visits.md): what a visit is for, its title and its place.
  const purpose = await pool.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='zion_visits' AND column_name='purpose'",
  );
  if (table.rowCount && !purpose.rowCount) missing.push('appointment fields');
  return missing;
}

try {
  let missing = await missingParts();
  if (!process.argv.includes('--apply')) {
    console.log(
      missing.length
        ? `Visits schema: missing ${missing.join(', ')}. Check only; no changes made. Apply with npm run db:visits:check -- --apply`
        : 'Visits schema: installed. Check only; no changes made.',
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
      await client.query(readFileSync(new URL('../prisma/visits.sql', import.meta.url), 'utf8'));
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    missing = await missingParts();
    if (missing.length)
      throw new Error(`Visits schema needs review: missing ${missing.join(', ')}.`);
    console.log('Visits schema is installed. Existing data was not changed.');
  }
} finally {
  await pool.end();
}
