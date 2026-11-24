// Destructive, explicitly approved local reset. Defaults to inspection; never accepts a remote database.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { config } from 'dotenv';

const workspace = fileURLToPath(new URL('../', import.meta.url));
config({ path: path.join(workspace, '.env.local'), quiet: true });
config({ path: path.join(workspace, '.env'), quiet: true });
const url = new URL(process.env.DATABASE_URL);
assert.ok(
  ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname),
  'Only the explicitly approved local database is allowed.',
);
assert.equal(
  decodeURIComponent(url.pathname.slice(1)),
  'ZenTra',
  'Refusing to reset any other database.',
);
assert.equal(url.port || '5432', '5432', 'Refusing a different PostgreSQL instance.');

// Exact inventory verified for this request; a changed target fails closed.
const expectedTables = [
  'Event',
  'Task',
  'TaskList',
  '_prisma_migrations',
  'account_tokens',
  'assistant_conversations',
  'assistant_feedback',
  'assistant_interactions',
  'assistant_test_logs',
  'assistant_unanswered_questions',
  'audit_logs',
  'booking_orchestration_contexts',
  'booking_package_snapshots',
  'booking_timeline',
  'bookings',
  'client_access_grants',
  'command_center_jobs',
  'content_items',
  'content_versions',
  'contract_send_attempts',
  'contract_templates',
  'contract_timeline',
  'contract_versions',
  'contracts',
  'dashboard_tasks',
  'email_logs',
  'event_categories',
  'gallery_collections',
  'inquiries',
  'inquiry_activity',
  'inquiry_notes',
  'knowledge_chunks',
  'knowledge_document_versions',
  'knowledge_documents',
  'knowledge_index_generations',
  'knowledge_sources',
  'media_assets',
  'n8n_workflow_logs',
  'notifications',
  'orchestration_rate_limits',
  'package_inclusions',
  'package_versions',
  'packages',
  'password_history',
  'payment_history',
  'payment_milestones',
  'payment_records',
  'sessions',
  'support_categories',
  'support_faq_entries',
  'support_faq_versions',
  'system_settings',
  'task_template_items',
  'task_template_migration_runs',
  'task_templates',
  'testimonies',
  'users',
  'zion_admin_bookings',
  'zion_admin_cash_payments',
  'zion_admin_contracts',
  'zion_admin_outbox',
  'zion_admin_policy',
  'zion_admin_rate_limits',
].sort();
const dataTables = expectedTables.filter((name) => name !== '_prisma_migrations');
const qualified = (name) => `public."${name.replaceAll('"', '""')}"`;
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 10000,
});
const client = await pool.connect();
let inTransaction = false;
let backupFolder;
let committed = false;

async function counts() {
  const result = [];
  for (const table of expectedTables) {
    const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM ${qualified(table)}`);
    result.push({ table, count: rows[0].count });
  }
  return result;
}
async function structure() {
  const queries = [
    "SELECT tablename,tableowner,rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    "SELECT table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default,is_identity,identity_generation,is_generated,generation_expression FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
    "SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname",
    "SELECT c.conname,c.conrelid::regclass::text AS table_name,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' ORDER BY table_name,c.conname",
    "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
    "SELECT * FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname",
    "SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname",
  ];
  const result = [];
  for (const query of queries) result.push((await client.query(query)).rows);
  return JSON.stringify(result);
}
const nativeEnv = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGDATABASE: 'ZenTra',
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGSSLMODE: url.searchParams.get('sslmode') || 'prefer',
  PGCONNECT_TIMEOUT: '10',
};
const pgBin = 'C:/Program Files/PostgreSQL/18/bin';
function native(program, args) {
  return execFileSync(path.join(pgBin, `${program}.exe`), args, {
    env: nativeEnv,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 45000,
    maxBuffer: 8 * 1024 * 1024,
  });
}

try {
  const database = (await client.query('SELECT current_database() AS name')).rows[0].name;
  assert.equal(database, 'ZenTra');
  const tables = (
    await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows
    .map((row) => row.tablename)
    .sort();
  assert.deepEqual(tables, expectedTables, 'Table inventory changed; inspect before resetting.');
  const schemas = (
    await client.query('SELECT DISTINCT schemaname FROM pg_tables WHERE schemaname<>ALL($1)', [
      ['pg_catalog', 'information_schema'],
    ])
  ).rows.map((row) => row.schemaname);
  assert.deepEqual(
    schemas,
    ['public'],
    'Unexpected application schemas; reset requires another scope review.',
  );
  assert.equal(
    (await client.query('SELECT COUNT(*)::int AS count FROM pg_largeobject_metadata')).rows[0]
      .count,
    0,
    'Large objects require a separate reset review.',
  );
  assert.equal(
    (await client.query('SELECT COUNT(*)::int AS count FROM pg_inherits')).rows[0].count,
    0,
    'Inherited tables require a separate reset review.',
  );
  assert.equal(
    (await client.query("SELECT COUNT(*)::int AS count FROM pg_matviews WHERE schemaname='public'"))
      .rows[0].count,
    0,
    'Materialized views require a separate reset review.',
  );
  assert.equal(
    (
      await client.query(
        "SELECT COUNT(*)::int AS count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND (t.tgtype::integer & 32)<>0",
      )
    ).rows[0].count,
    0,
    'TRUNCATE triggers require a separate reset review.',
  );
  if (!process.argv.includes('--execute')) {
    console.log(
      JSON.stringify(
        {
          mode: 'inspection only; no changes',
          database,
          dataTables: dataTables.length,
          counts: await counts(),
        },
        null,
        2,
      ),
    );
  } else {
    assert.ok(
      process.argv.includes('--confirm-local-ZenTra-full-data-reset'),
      'The exact full-reset confirmation flag is required.',
    );
    const email = z
      .email()
      .max(255)
      .parse(
        process.argv
          .find((arg) => arg.startsWith('--admin-email='))
          ?.slice('--admin-email='.length),
      )
      .toLowerCase();
    const password = `Zion-${randomBytes(24).toString('base64url')}!`;
    const passwordHash = await bcrypt.hash(password, 12);
    const userId = randomUUID();
    const backupRoot = path.resolve(workspace, '..', 'Zion-Database-Backups');
    backupFolder = path.join(
      backupRoot,
      `database-reset-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`,
    );
    const relative = path.relative(backupRoot, backupFolder);
    assert.ok(
      relative && !relative.startsWith('..') && !path.isAbsolute(relative),
      'Invalid backup path.',
    );
    await mkdir(backupRoot, { recursive: true });
    await mkdir(backupFolder);
    assert.equal(process.platform, 'win32', 'This private-backup ACL setup is Windows-specific.');
    const sid = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '[Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
      ],
      { encoding: 'utf8', windowsHide: true },
    ).trim();
    assert.match(sid, /^S-1-5-21-\d+-\d+-\d+-\d+$/);
    execFileSync(
      'icacls.exe',
      [backupFolder, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F'],
      { windowsHide: true, stdio: 'pipe' },
    );
    const backupPath = path.join(backupFolder, 'ZenTra-before-reset.dump');
    const credentialPath = path.join(backupFolder, 'admin-login.txt');
    const beforeStructure = await structure();
    await client.query('BEGIN');
    inTransaction = true;
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='30s'");
    // Prevent writes during the snapshot, while allowing pg_dump to read the same data.
    await client.query(`LOCK TABLE ${expectedTables.map(qualified).join(', ')} IN SHARE MODE`);
    const before = await counts();
    const migrationRows = (
      await client.query('SELECT * FROM public._prisma_migrations ORDER BY id')
    ).rows;
    console.log('Creating full PostgreSQL backup before any data removal…');
    native('pg_dump', ['--format=custom', '--no-password', `--file=${backupPath}`]);
    const backupSize = (await stat(backupPath)).size;
    assert.ok(backupSize > 1024, 'Backup is unexpectedly small.');
    const archive = native('pg_restore', ['--list', backupPath]);
    for (const table of expectedTables)
      assert.ok(
        archive.includes(`TABLE DATA public ${table} `),
        `Backup is missing table data: ${table}`,
      );
    const sha256 = createHash('sha256')
      .update(await readFile(backupPath))
      .digest('hex');
    await writeFile(
      credentialPath,
      `Zion Events Place — fresh SUPERADMIN\n\nOpen: http://localhost:3001/admin\nEmail: ${email}\nTemporary password: ${password}\n\nA password change is mandatory on first sign-in.\nUse Admin profile to choose your own password (at least 12 characters).\nKeep this file private. Delete it after changing your password.\n`,
      { flag: 'wx' },
    );
    await writeFile(
      path.join(backupFolder, 'manifest.json'),
      JSON.stringify(
        {
          status: 'backup verified; reset not yet committed',
          database,
          createdAt: new Date().toISOString(),
          sha256,
          backupSize,
          before,
        },
        null,
        2,
      ),
      { flag: 'wx' },
    );
    console.log(
      `Backup verified (${backupSize} bytes). Resetting ${dataTables.length} explicitly listed application tables…`,
    );
    // No DROP, CASCADE, disabled triggers, RLS changes, or migration-history deletion.
    await client.query(
      `TRUNCATE TABLE ${dataTables.map(qualified).join(', ')} RESTART IDENTITY RESTRICT`,
    );
    await client.query(
      'INSERT INTO public.users (id,username,email,password_hash,full_name,role,status,must_change_password,"createdAt","updatedAt",last_password_changed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,NOW(),NOW(),NOW())',
      [
        userId,
        'zion-owner',
        email,
        passwordHash,
        'Zion Events Place Owner',
        'SUPERADMIN',
        'PASSWORD_RESET_REQUIRED',
      ],
    );
    await client.query(
      'INSERT INTO public.audit_logs (id,timestamp,user_id,user_name,user_role,action,module,description,status,source) VALUES ($1,NOW(),$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        randomUUID(),
        userId,
        'Zion Events Place Owner',
        'SUPERADMIN',
        'CREATE',
        'Authentication',
        'User-approved fresh local database reset completed; backup retained; old accounts and sessions removed; mandatory password change required.',
        'SUCCESS',
        'zion-admin',
      ],
    );
    const after = await counts();
    for (const row of after) {
      const expected =
        row.table === '_prisma_migrations'
          ? migrationRows.length
          : ['users', 'audit_logs'].includes(row.table)
            ? 1
            : 0;
      assert.equal(row.count, expected, `Unexpected rows after reset: ${row.table}`);
    }
    assert.equal(
      await structure(),
      beforeStructure,
      'Database definitions or security settings changed; rolling back.',
    );
    assert.deepEqual(
      (await client.query('SELECT * FROM public._prisma_migrations ORDER BY id')).rows,
      migrationRows,
      'Migration history changed.',
    );
    const owner = (
      await client.query(
        'SELECT password_hash,role,status,must_change_password FROM public.users WHERE id=$1',
        [userId],
      )
    ).rows[0];
    assert.ok(await bcrypt.compare(password, owner.password_hash));
    assert.equal(owner.role, 'SUPERADMIN');
    assert.equal(owner.status, 'PASSWORD_RESET_REQUIRED');
    assert.equal(owner.must_change_password, true);
    await client.query('COMMIT');
    inTransaction = false;
    committed = true;
    const removedRows = before
      .filter((row) => row.table !== '_prisma_migrations')
      .reduce((sum, row) => sum + row.count, 0);
    await writeFile(
      path.join(backupFolder, 'manifest.json'),
      JSON.stringify(
        {
          status: 'reset committed and verified',
          database,
          createdAt: new Date().toISOString(),
          sha256,
          backupSize,
          removedRows,
          before,
          after,
          adminEmail: email,
          credentialsFile: 'admin-login.txt',
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify(
        {
          reset: 'complete',
          database,
          clearedApplicationTables: dataTables.length,
          removedRows,
          remaining:
            'one fresh SUPERADMIN and one new reset audit entry; migration history preserved',
          adminEmail: email,
          credentialsFile: credentialPath,
          backupFile: backupPath,
          securityAndSchema: 'unchanged',
        },
        null,
        2,
      ),
    );
  }
} catch (error) {
  if (inTransaction) await client.query('ROLLBACK').catch(() => {});
  console.error(
    committed
      ? 'Reset committed, but final file reporting failed; inspect the database and retained backup.'
      : 'Reset not committed; existing data has been retained.',
  );
  if (backupFolder) console.error(`Private backup/credential location: ${backupFolder}`);
  console.error(error instanceof Error ? error.message : 'Reset failed');
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
