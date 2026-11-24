import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import pg from 'pg';
config({ path: '.env.local', quiet: true });
config({ quiet: true });
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Database connection is not configured.');
const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000 });

// Zeni's additive tables: encrypted conversation memory and the redacted unanswered-questions log.
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
  zion_zeni_gaps: [
    'id',
    'question',
    'question_hash',
    'topic',
    'language',
    'reason',
    'created_at',
    'resolved_at',
    'resolved_by',
  ],
};
const tables = Object.keys(expected);

try {
  const { rows } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename=ANY($1::text[])",
    [tables],
  );
  if (!process.argv.includes('--apply')) {
    console.log(
      `Zeni schema: ${rows.length}/${tables.length} tables installed (${rows.map((row) => row.tablename).join(', ') || 'none'}). Check only; no changes made.`,
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
    if (rows.length === tables.length) console.log('Zeni tables already exist; no changes made.');
    else {
      // The SQL only creates missing tables (IF NOT EXISTS); the checks below catch a table
      // that exists with an incompatible shape.
      await pool.query(
        readFileSync(new URL('../prisma/receptionist.sql', import.meta.url), 'utf8'),
      );
      console.log(
        `Installed ${tables.length - rows.length} missing additive Zeni table(s). Existing records were preserved.`,
      );
    }
  }
  if (rows.length === tables.length || process.argv.includes('--apply')) {
    const columns = await pool.query(
      "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[])",
      [tables],
    );
    for (const [table, names] of Object.entries(expected))
      for (const name of names)
        if (!columns.rows.some((row) => row.table_name === table && row.column_name === name))
          throw new Error(`Zeni schema needs review: missing ${table}.${name}.`);
    const protections = await pool.query(
      'SELECT relname,relrowsecurity FROM pg_class WHERE relname=ANY($1::text[])',
      [tables],
    );
    if (
      protections.rows.length !== tables.length ||
      protections.rows.some((row) => !row.relrowsecurity)
    )
      throw new Error('Zeni row security needs review.');
    console.log('Verified Zeni conversation and unanswered-question columns and row security.');
  }
} finally {
  await pool.end();
}
