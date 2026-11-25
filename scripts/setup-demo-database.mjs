// Fills an EMPTY hosted test database (for example the zentra-staging project on Supabase) with
// every table and the same clearly labeled demo content as the local preview, so a shared online
// preview works end to end. It refuses to touch a database that already has tables or enum types;
// a lone Prisma migration-history table (left by another project's `migrate`) is ignored and kept.
//
//   npm run db:demo:setup                                   check only; changes nothing
//   npm run db:demo:setup -- --apply --allow-remote         create tables and demo content
//
// Uses DIRECT_URL (a session connection) from .env.local. The online demo staff sign-in is
// generated here and saved only in .local/HOSTED-ADMIN-SIGN-IN.txt (ignored by Git).
import { randomBytes } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pg from 'pg';
import { DEMO_ADMIN, buildSchema, seed } from './demo-database.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
config({ path: path.join(root, '.env.local'), quiet: true });
config({ path: path.join(root, '.env'), quiet: true });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Add DIRECT_URL to .env.local first.');
if (connectionString.includes('[YOUR-PASSWORD]'))
  throw new Error('Replace [YOUR-PASSWORD] in .env.local with the database password first.');

const target = new URL(connectionString);
const isLocal = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(target.hostname);
const apply = process.argv.includes('--apply');
if (apply && !isLocal && !process.argv.includes('--allow-remote'))
  throw new Error('Changing a remote database requires --allow-remote after explicit approval.');

// The schema stores timestamp-without-time-zone values as UTC. node-postgres would otherwise
// serialize Date parameters in this computer's time zone (UTC+8 in Manila) and shift them.
pg.defaults.parseInputDatesAsUTC = true;

// Enable row-level security on every table and remove the Supabase Data API roles' access. The
// site connects as the table owner, so it is unaffected; anonymous API keys can read nothing.
const HARDEN_SQL = `
DO $$
DECLARE
  item record;
  role_name text;
BEGIN
  FOR item IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', item.tablename);
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', item.tablename, role_name);
      END IF;
    END LOOP;
  END LOOP;
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', role_name);
    END IF;
  END LOOP;
END $$;`;

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15_000 });
await client.connect();
const signInFile = path.join(root, '.local', 'HOSTED-ADMIN-SIGN-IN.txt');
let inTransaction = false;
try {
  await client.query(`SET TIME ZONE 'UTC'`);
  const existing = (
    await client.query(
      `SELECT (SELECT count(*) FROM pg_tables
                WHERE schemaname = 'public' AND tablename <> '_prisma_migrations')::int AS tables,
              (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE n.nspname = 'public' AND t.typtype = 'e')::int AS enums`,
    )
  ).rows[0];
  console.log(`Database: ${target.hostname}:${target.port || 5432}`);
  if (existing.tables > 0 || existing.enums > 0) {
    console.log(
      `Already set up (${existing.tables} tables, ${existing.enums} enum types in "public"). Nothing changed.`,
    );
    process.exitCode = apply ? 1 : 0;
  } else if (!apply) {
    console.log(
      'Empty database: ready. Run with -- --apply --allow-remote to add tables and demo content.',
    );
  } else {
    const adminPassword = `Zentra-${randomBytes(12).toString('base64url')}`;
    // Saved before the commit so the only copy of the password can never be lost.
    mkdirSync(path.dirname(signInFile), { recursive: true });
    writeFileSync(
      signInFile,
      `Online test admin (demo data in the hosted test database; share privately)\n` +
        `Sign in at: <your Vercel link>/admin\nEmail: ${DEMO_ADMIN.email}\nPassword: ${adminPassword}\n`,
    );
    const db = {
      exec: (sql) => client.query(sql),
      query: (sql, params) => client.query(sql, params),
    };
    await client.query('BEGIN');
    inTransaction = true;
    console.log('Creating tables…');
    await buildSchema(db);
    await client.query(HARDEN_SQL);
    console.log('Adding demo content…');
    await seed(db, { adminPassword, label: 'Demo' });
    await client.query('COMMIT');
    inTransaction = false;
    const counts = (
      await client.query(
        `SELECT (SELECT count(*) FROM pg_tables WHERE schemaname = 'public')::int AS tables,
                (SELECT count(*) FROM event_categories)::int AS categories,
                (SELECT count(*) FROM packages)::int AS packages,
                (SELECT count(*) FROM testimonies)::int AS reviews,
                (SELECT count(*) FROM zion_admin_bookings)::int AS bookings,
                (SELECT count(*) FROM inquiries)::int AS inquiries`,
      )
    ).rows[0];
    console.log(
      `Done: ${counts.tables} tables, ${counts.categories} event types, ${counts.packages} packages, ` +
        `${counts.reviews} reviews, ${counts.bookings} bookings, ${counts.inquiries} inquiries.`,
    );
    console.log('Staff sign-in saved in .local/HOSTED-ADMIN-SIGN-IN.txt');
  }
} catch (error) {
  if (inTransaction) {
    await client.query('ROLLBACK').catch(() => {});
    rmSync(signInFile, { force: true });
    console.error('Rolled back: the database is unchanged.');
  }
  throw error;
} finally {
  await client.end();
}
