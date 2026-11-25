// Checks (default) or applies prisma/booking-holds.sql: the payment deadline column of the booking
// automation and the amount rule that lets a custom proposal wait for its price. The SQL is
// additive and idempotent; existing data is never changed.
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import pg from 'pg';

config({ path: '.env.local', quiet: true });
config({ quiet: true });
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Database connection is not configured.');
const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });

async function missingParts() {
  const [column, rule] = await Promise.all([
    pool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='zion_admin_bookings' AND column_name='holdExpiresAt'",
    ),
    pool.query(
      "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname='admin_booking_amounts'",
    ),
  ]);
  const missing = [];
  if (!column.rowCount) missing.push('payment deadline column');
  if (rule.rowCount && !/"totalCents" >= 0/.test(rule.rows[0].definition))
    missing.push('custom proposal amount rule');
  return missing;
}

try {
  let missing = await missingParts();
  if (!process.argv.includes('--apply')) {
    console.log(
      missing.length
        ? `Booking holds schema: missing ${missing.join(', ')}. Check only; no changes made. Apply with npm run db:booking-holds:check -- --apply`
        : 'Booking holds schema: installed. Check only; no changes made.',
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
        readFileSync(new URL('../prisma/booking-holds.sql', import.meta.url), 'utf8'),
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
      throw new Error(`Booking holds schema needs review: missing ${missing.join(', ')}.`);
    console.log('Booking holds schema is installed. Existing data was not changed.');
  }
} finally {
  await pool.end();
}
