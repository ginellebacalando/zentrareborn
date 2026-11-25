// Checks (default) or applies prisma/payment-proofs.sql: the private table for GCash and bank
// transfer payment screenshots and the method of each recorded payment. The SQL is additive and
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
  const [table, method] = await Promise.all([
    pool.query(
      "SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname='zion_payment_proofs'",
    ),
    pool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='zion_admin_cash_payments' AND column_name='method'",
    ),
  ]);
  const missing = [];
  if (!table.rowCount) missing.push('payment proofs table');
  else if (!table.rows[0].relrowsecurity) missing.push('payment proofs row security');
  if (!method.rowCount) missing.push('payment method column');
  return missing;
}

try {
  let missing = await missingParts();
  if (!process.argv.includes('--apply')) {
    console.log(
      missing.length
        ? `Payment proofs schema: missing ${missing.join(', ')}. Check only; no changes made. Apply with npm run db:payment-proofs:check -- --apply`
        : 'Payment proofs schema: installed. Check only; no changes made.',
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
        readFileSync(new URL('../prisma/payment-proofs.sql', import.meta.url), 'utf8'),
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
      throw new Error(`Payment proofs schema needs review: missing ${missing.join(', ')}.`);
    console.log('Payment proofs schema is installed. Existing data was not changed.');
  }
} finally {
  await pool.end();
}
