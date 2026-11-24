import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import pg from 'pg';
config({ path: '.env.local', quiet: true });
config({ quiet: true });
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Database connection is not configured.');
const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });
try {
  const { rows } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('zion_receptionist_conversations','zion_receptionist_requests')",
  );
  if (!process.argv.includes('--apply')) {
    console.log(
      `Receptionist schema: ${rows.length}/2 tables installed. Check only; no changes made.`,
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
    if (rows.length === 2) console.log('Receptionist tables already exist; no changes made.');
    else if (rows.length)
      throw new Error('Partial installation detected. Review the schema before continuing.');
    else {
      await pool.query(
        readFileSync(new URL('../prisma/receptionist.sql', import.meta.url), 'utf8'),
      );
      console.log(
        'Installed two additive private receptionist tables. Existing records were preserved.',
      );
    }
  }
  if (rows.length === 2 || process.argv.includes('--apply')) {
    const expected = {
      zion_receptionist_conversations: [
        'id',
        'token_hash',
        'revision',
        'encrypted_state',
        'expires_at',
        'processing_turn_id',
        'processing_token',
        'processing_until',
        'processing_fingerprint',
        'encrypted_pending',
      ],
      zion_receptionist_requests: [
        'request_id',
        'conversation_id',
        'state_revision',
        'fingerprint',
        'status',
        'lease_until',
        'lease_token',
        'encrypted_request',
        'encrypted_result',
        'retry_at',
        'attempts',
      ],
    };
    const columns = await pool.query(
      "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[])",
      [Object.keys(expected)],
    );
    for (const [table, names] of Object.entries(expected))
      for (const name of names)
        if (!columns.rows.some((row) => row.table_name === table && row.column_name === name))
          throw new Error(`Receptionist schema needs review: missing ${table}.${name}.`);
    const protections = await pool.query(
      'SELECT relname,relrowsecurity FROM pg_class WHERE relname=ANY($1::text[])',
      [Object.keys(expected)],
    );
    if (protections.rows.length !== 2 || protections.rows.some((row) => !row.relrowsecurity))
      throw new Error('Receptionist row security needs review.');
    console.log('Verified receptionist state/recovery columns and row security.');
  }
} finally {
  await pool.end();
}
