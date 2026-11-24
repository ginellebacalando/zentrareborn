// Local recovery only. Inspection is the default; no accounts or business rows are deleted.
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import pg from 'pg';
import { z } from 'zod';

const workspace = fileURLToPath(new URL('../', import.meta.url));
config({ path: path.join(workspace, '.env.local'), quiet: true });
config({ path: path.join(workspace, '.env'), quiet: true });
const url = new URL(process.env.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
assert.equal(decodeURIComponent(url.pathname.slice(1)), 'ZenTra');
assert.equal(url.port || '5432', '5432');
const email = z
  .email()
  .max(255)
  .parse(process.argv.find((arg) => arg.startsWith('--admin-email='))?.slice(14))
  .toLowerCase();
const execute = process.argv.includes('--execute');
if (execute) assert.ok(process.argv.includes('--confirm-password-only'));
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 10000,
});
const client = await pool.connect();
let inTransaction = false;
let committed = false;
let credentialPath;

async function recordCounts() {
  const tables = (
    await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
    )
  ).rows;
  const result = {};
  for (const { tablename } of tables) {
    const quoted = tablename.replaceAll('"', '""');
    result[tablename] = (
      await client.query(`SELECT COUNT(*)::int AS count FROM public."${quoted}"`)
    ).rows[0].count;
  }
  return result;
}

async function securitySnapshot() {
  const rows = (
    await client.query(
      "SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname",
    )
  ).rows;
  const policies = (
    await client.query(
      "SELECT * FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname",
    )
  ).rows;
  return { rows, policies };
}

try {
  assert.equal((await client.query('SELECT current_database() AS name')).rows[0].name, 'ZenTra');
  const found = (
    await client.query(
      'SELECT id,email,role,status,must_change_password FROM public.users WHERE email=$1',
      [email],
    )
  ).rows;
  assert.equal(found.length, 1, 'An existing account is required; nothing will be created.');
  assert.equal(found[0].role, 'SUPERADMIN', 'Refusing to reset a different role.');
  assert.ok(
    ['ACTIVE', 'PASSWORD_RESET_REQUIRED'].includes(found[0].status),
    'Disabled or locked accounts need a separate authorization review.',
  );
  if (!execute) {
    console.log(
      JSON.stringify({ mode: 'inspection only; no changes', account: found[0] }, null, 2),
    );
  } else {
    const password = `Zion-${randomBytes(24).toString('base64url')}!`;
    const passwordHash = await bcrypt.hash(password, 12);
    const root = path.resolve(workspace, '..', 'Zion-Database-Backups');
    const folder = path.join(
      root,
      `password-reset-${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`,
    );
    const relative = path.relative(root, folder);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    assert.equal(process.platform, 'win32', 'Private file ACL setup requires Windows.');
    await mkdir(root, { recursive: true });
    await mkdir(folder);
    const sid = execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '[Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
      ],
      { encoding: 'utf8', windowsHide: true, timeout: 10000 },
    ).trim();
    assert.match(sid, /^S-1-5-21-\d+-\d+-\d+-\d+$/);
    execFileSync(
      'icacls.exe',
      [folder, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F'],
      { windowsHide: true, stdio: 'pipe', timeout: 10000 },
    );
    credentialPath = path.join(folder, 'admin-login.txt');
    await writeFile(
      credentialPath,
      `Zion Events Place — SUPERADMIN password reset\n\nOpen: http://localhost:3001/admin\nEmail: ${email}\nTemporary password: ${password}\n\nPassword-only reset; existing business data is preserved.\nChange this password in Admin profile after signing in (at least 12 characters).\nKeep this file private. Delete it after changing your password.\n`,
      { flag: 'wx' },
    );
    const manifestPath = path.join(folder, 'manifest.json');
    await writeFile(
      manifestPath,
      JSON.stringify(
        {
          status: 'prepared; not yet committed',
          kind: 'password-only',
          adminEmail: email,
        },
        null,
        2,
      ),
      { flag: 'wx' },
    );

    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    inTransaction = true;
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='15s'");
    const user = (
      await client.query('SELECT * FROM public.users WHERE id=$1 FOR UPDATE', [found[0].id])
    ).rows[0];
    assert.equal(user?.email, email);
    assert.equal(user.role, 'SUPERADMIN');
    assert.ok(['ACTIVE', 'PASSWORD_RESET_REQUIRED'].includes(user.status));
    assert.equal(
      (
        await client.query(
          "SELECT COUNT(*)::int AS count FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1) AND NOT t.tgisinternal",
          [['users', 'sessions', 'account_tokens', 'zion_admin_rate_limits', 'audit_logs']],
        )
      ).rows[0].count,
      0,
      'Custom triggers require a separate side-effect review.',
    );
    const before = await recordCounts();
    const security = await securitySnapshot();
    const otherUsers = (
      await client.query('SELECT * FROM public.users WHERE id<>$1 ORDER BY id', [user.id])
    ).rows;
    const key = createHash('sha256').update(`login:${email}`).digest('hex');
    const timestamp = (await client.query('SELECT NOW() AS at')).rows[0].at;
    const update = await client.query(
      'UPDATE public.users SET password_hash=$2,status=$3,must_change_password=TRUE,last_password_changed_at=NOW(),password_change_attempt_count=0,password_change_locked_until=NULL,"updatedAt"=NOW() WHERE id=$1',
      [user.id, passwordHash, 'PASSWORD_RESET_REQUIRED'],
    );
    assert.equal(update.rowCount, 1);
    const sessions = await client.query(
      'UPDATE public.sessions SET revoked_at=NOW() WHERE user_id=$1 AND revoked_at IS NULL',
      [user.id],
    );
    const tokens = await client.query(
      'UPDATE public.account_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL',
      [user.id],
    );
    await client.query(
      'UPDATE public.zion_admin_rate_limits SET attempts=0,"windowAt"=NOW() WHERE key=$1',
      [key],
    );
    await client.query(
      'INSERT INTO public.audit_logs (id,timestamp,user_id,user_name,user_role,action,module,description,status,source) VALUES ($1,NOW(),$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        randomUUID(),
        user.id,
        user.full_name || user.username,
        user.role,
        'PASSWORD_CHANGE',
        'Authentication',
        'User-approved local password-only recovery; previous sessions and recovery tokens invalidated; mandatory password change required. Business records preserved.',
        'SUCCESS',
        'zion-admin',
      ],
    );
    const after = await recordCounts();
    assert.deepEqual(Object.keys(after), Object.keys(before));
    for (const table of Object.keys(before))
      assert.equal(
        after[table],
        before[table] + (table === 'audit_logs' ? 1 : 0),
        `${table}: records unexpectedly added or removed`,
      );
    assert.deepEqual(await securitySnapshot(), security, 'Security rules changed; rolling back.');
    assert.deepEqual(
      (await client.query('SELECT * FROM public.users WHERE id<>$1 ORDER BY id', [user.id])).rows,
      otherUsers,
    );
    const owner = (await client.query('SELECT * FROM public.users WHERE id=$1', [user.id])).rows[0];
    assert.ok(await bcrypt.compare(password, owner.password_hash));
    assert.equal(owner.status, 'PASSWORD_RESET_REQUIRED');
    assert.equal(owner.must_change_password, true);
    for (const [field, value] of Object.entries(user)) {
      if (
        ![
          'password_hash',
          'status',
          'must_change_password',
          'last_password_changed_at',
          'password_change_attempt_count',
          'password_change_locked_until',
          'updatedAt',
        ].includes(field)
      )
        assert.deepEqual(owner[field], value, `Unrelated profile field changed: ${field}`);
    }
    assert.ok(owner.last_password_changed_at.getTime() >= timestamp.getTime() - 1);
    assert.equal(
      (
        await client.query(
          'SELECT COUNT(*)::int AS count FROM public.sessions WHERE user_id=$1 AND revoked_at IS NULL',
          [user.id],
        )
      ).rows[0].count,
      0,
    );
    assert.equal(
      (
        await client.query(
          'SELECT COUNT(*)::int AS count FROM public.account_tokens WHERE user_id=$1 AND used_at IS NULL',
          [user.id],
        )
      ).rows[0].count,
      0,
    );
    await client.query('COMMIT');
    inTransaction = false;
    committed = true;
    await writeFile(
      manifestPath,
      JSON.stringify(
        {
          status: 'committed and verified',
          kind: 'password-only',
          adminEmail: email,
          createdAt: new Date().toISOString(),
          revokedSessions: sessions.rowCount,
          invalidatedTokens: tokens.rowCount,
          allRecordCountsPreserved: true,
          newAuditEntries: 1,
          securityRulesPreserved: true,
          before,
          after,
          credentialsFile: 'admin-login.txt',
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify(
        {
          reset: 'password-only complete',
          adminEmail: email,
          credentialsFile: credentialPath,
          revokedSessions: sessions.rowCount,
          businessData: 'preserved',
          securityRules: 'unchanged',
          passwordChange: 'required',
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
      ? 'Reset committed; final file reporting failed.'
      : 'Reset not committed; existing password and data retained.',
  );
  if (credentialPath)
    console.error(
      `Private credential file: ${credentialPath}${committed ? '' : ' (not activated)'}`,
    );
  console.error(error instanceof Error ? error.message : 'Password reset failed');
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
