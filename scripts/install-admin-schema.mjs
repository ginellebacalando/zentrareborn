import { readFileSync } from 'node:fs';
import { config } from 'dotenv';
import pg from 'pg';
config({ path: '.env.local', quiet: true });
config({ quiet: true });
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Database connection is not configured.');
const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10000,
});
try {
  const { rows } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'zion_admin_%'",
  );
  if (!process.argv.includes('--apply')) {
    console.log(`Admin schema: ${rows.length}/6 tables installed. Check only; no changes made.`);
  } else {
    const target = new URL(connectionString);
    if (
      !['localhost', '127.0.0.1', '::1'].includes(target.hostname) &&
      !process.argv.includes('--allow-remote')
    )
      throw new Error(
        'Remote schema installation requires --allow-remote after explicit approval.',
      );
    if (rows.length === 6) console.log('All admin tables already exist; no changes made.');
    else if (rows.length)
      throw new Error('Partial installation detected. Review schema rather than overwriting data.');
    else {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(readFileSync(new URL('../prisma/admin.sql', import.meta.url), 'utf8'));
        await client.query('COMMIT');
        console.log('Installed six additive private admin tables. Existing data untouched.');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  }
} finally {
  await pool.end();
}
