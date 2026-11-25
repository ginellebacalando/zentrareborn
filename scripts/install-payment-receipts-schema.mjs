// Checks (default) or applies prisma/payment-receipts.sql: the acknowledgment number of every
// recorded payment and the counter that issues them. The SQL is additive and idempotent; it only
// fills the new number on payments recorded before it, and changes no other value.
import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import pg from 'pg';

config({ path: '.env.local', quiet: true });
config({ quiet: true });
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Database connection is not configured.');
const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });

async function missingParts() {
  const [column, sequence, unnumbered] = await Promise.all([
    pool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='zion_admin_cash_payments' AND column_name='acknowledgmentNumber'",
    ),
    pool.query(
      "SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S' AND c.relname='zion_acknowledgment_number_seq'",
    ),
    pool
      .query(
        'SELECT count(*)::int AS count FROM "zion_admin_cash_payments" WHERE "acknowledgmentNumber" IS NULL',
      )
      .catch(() => ({ rows: [{ count: 0 }] })),
  ]);
  const missing = [];
  if (!column.rowCount) missing.push('acknowledgment number column');
  if (!sequence.rowCount) missing.push('acknowledgment number counter');
  if (column.rowCount && unnumbered.rows[0].count > 0)
    missing.push(`numbers for ${unnumbered.rows[0].count} earlier payment(s)`);
  return missing;
}

try {
  let missing = await missingParts();
  if (!process.argv.includes('--apply')) {
    console.log(
      missing.length
        ? `Payment receipts schema: missing ${missing.join(', ')}. Check only; no changes made. Apply with npm run db:payment-receipts:check -- --apply`
        : 'Payment receipts schema: installed. Check only; no changes made.',
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
        readFileSync(new URL('../prisma/payment-receipts.sql', import.meta.url), 'utf8'),
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
      throw new Error(`Payment receipts schema needs review: missing ${missing.join(', ')}.`);
    console.log(
      'Payment receipts schema is installed. Earlier payments got their acknowledgment numbers; no other data changed.',
    );
  }
} finally {
  await pool.end();
}
